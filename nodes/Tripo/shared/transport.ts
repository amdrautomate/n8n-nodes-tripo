import {
	NodeApiError,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type JsonObject,
} from 'n8n-workflow';
import { encodeMultipart, type MultipartFile } from './multipart';

export const TRIPO_BASE_URL = 'https://openapi.tripo3d.com/v3';
export const USER_AGENT = 'n8n-nodes-tripo';
const CREDENTIAL = 'tripoApi';

export interface TripoRequest {
	method: IHttpRequestMethods;
	/** Path relative to /v3, starting with "/". */
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
	/** When present the body is multipart/form-data (file upload). */
	files?: MultipartFile[];
}

/** Hints for Tripo's business error codes. */
const CODE_HINTS: Record<number, string> = {
	1000: 'The API key is not valid or was deleted. Check the Tripo API credential.',
	1001: 'The request had no Authorization header. Check the Tripo API credential.',
	1004: 'A parameter is not valid for the chosen model version (for example texture_quality "fast" without texture model v3.5, or smart_uv without retopology v3.0).',
	1007: 'Tripo rate limit reached. Reduce the request rate and retry with back-off.',
	2000: 'Too many tasks of this category are running at once (default 10 per category, 5 for P series and model processing, 1 for image generation). Wait for one to finish.',
	2002: 'A request field name or value is not supported. Check the parameters against the Tripo docs.',
	2003: 'The uploaded file is empty.',
	2004: 'The file type is not supported for this operation.',
	2008: 'The input violates the Tripo content policy. Change the prompt or image.',
	2010: 'The account has no credits left. Top up in the Tripo console (Billing).',
	2015: 'This model version is deprecated. Pick a newer one.',
	2018: 'The input model is too complex. Reduce its polycount first (Mesh > Retopologize).',
};

const STATUS_HINTS: Record<number, string> = {
	400: 'Tripo rejected the request parameters. Check the field values.',
	401: 'Tripo rejected the API key. Check the Tripo API credential.',
	403: 'Not allowed: the key lacks permission or the account has too few credits.',
	404: 'Tripo could not find that task or resource. Check the ID.',
	429: 'Rate or concurrency limit reached. Wait and retry.',
	500: 'Tripo had an internal error. Retry later.',
};

function parseBody(raw: unknown): IDataObject {
	if (raw === undefined || raw === null || raw === '') return {};
	if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as IDataObject;
		} catch {
			return { message: raw.slice(0, 500) };
		}
	}
	return raw as IDataObject;
}

/** Raises a NodeApiError with Tripo's own message and suggestion plus a hint. */
export function throwTripoError(
	context: IExecuteFunctions,
	status: number,
	body: IDataObject,
	itemIndex: number,
): never {
	const code = Number(body.code ?? 0);
	const message =
		(typeof body.message === 'string' ? body.message : undefined) ??
		(code ? `Tripo error code ${code}` : `Tripo returned status ${status}`);
	const suggestion = typeof body.suggestion === 'string' ? body.suggestion : undefined;
	const hint = (code && CODE_HINTS[code]) ?? STATUS_HINTS[status];
	const description = [suggestion, hint].filter(Boolean).join(' ') || undefined;
	const requestId = typeof body.request_id === 'string' ? ` (request ${body.request_id})` : '';

	throw new NodeApiError(context.getNode(), body as JsonObject, {
		httpCode: status ? String(status) : undefined,
		message: `${code ? `[${code}] ` : ''}${message}${requestId}`,
		description,
		itemIndex,
	});
}

/**
 * Sends an authenticated request to the Tripo API and returns the `data` of the
 * `{ code, data }` envelope. Multipart bodies are encoded locally for file uploads.
 */
export async function tripoRequest(
	this: IExecuteFunctions,
	request: TripoRequest,
	itemIndex: number,
): Promise<IDataObject> {
	const headers: IDataObject = { Accept: 'application/json', 'User-Agent': USER_AGENT };
	let body: Buffer | string | undefined;

	if (request.files && request.files.length > 0) {
		const encoded = encodeMultipart({}, request.files);
		headers['Content-Type'] = encoded.contentType;
		headers['Content-Length'] = encoded.body.length;
		body = encoded.body;
	} else if (request.body && Object.keys(request.body).length > 0) {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(request.body);
	}

	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${TRIPO_BASE_URL}${request.path}`,
		qs: request.qs,
		headers,
		body,
		json: false,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: 300_000,
	};
	if (body === undefined) delete options.body;

	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		CREDENTIAL,
		options,
	)) as { statusCode: number; body: unknown };

	const parsed = parseBody(response.body);
	if (response.statusCode >= 400 || (parsed.code !== undefined && Number(parsed.code) !== 0)) {
		throwTripoError(this, response.statusCode, parsed, itemIndex);
	}
	const data = parsed.data;
	if (data === undefined || data === null) return {};
	if (Array.isArray(data)) return { items: data };
	return data as IDataObject;
}

/** Downloads a result URL (model file or image) into a Buffer with its content type. */
export async function downloadUrl(
	this: IExecuteFunctions,
	url: string,
): Promise<{ data: Buffer; contentType: string }> {
	const response = (await this.helpers.httpRequest({
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		headers: { 'User-Agent': USER_AGENT },
		timeout: 300_000,
	})) as { body: Buffer | ArrayBuffer; headers: Record<string, string> };
	const data = Buffer.isBuffer(response.body)
		? response.body
		: Buffer.from(response.body as ArrayBuffer);
	return { data, contentType: response.headers?.['content-type'] ?? 'application/octet-stream' };
}

/** Uploads a file to POST /files and returns its file_token. */
export async function uploadFile(
	this: IExecuteFunctions,
	file: MultipartFile,
	itemIndex: number,
): Promise<string> {
	const data = await tripoRequest.call(
		this,
		{ method: 'POST', path: '/files', files: [{ ...file, field: 'file' }] },
		itemIndex,
	);
	const token = data.file_token;
	if (typeof token !== 'string' || !token) {
		throw new NodeOperationError(this.getNode(), 'Tripo did not return a file token for the upload', {
			itemIndex,
		});
	}
	return token;
}

export interface TripoTask {
	task_id?: string;
	type?: string;
	status?: string;
	progress?: number;
	output?: IDataObject;
	error_code?: number;
	error_message?: string;
	credits_consumed?: number;
	[key: string]: unknown;
}

export const TERMINAL_FAILURES = ['failed', 'cancelled', 'banned', 'expired'];

/** GET /tasks/{id}. */
export async function getTask(
	this: IExecuteFunctions,
	taskId: string,
	itemIndex: number,
): Promise<TripoTask> {
	return (await tripoRequest.call(
		this,
		{ method: 'GET', path: `/tasks/${encodeURIComponent(taskId)}` },
		itemIndex,
	)) as TripoTask;
}

/**
 * Polls GET /tasks/{id} until the task succeeds, fails or the time budget runs out.
 * Tripo recommends polling every 1-2 seconds; 3 seconds keeps well inside the rate limits.
 */
export async function waitForTask(
	this: IExecuteFunctions,
	taskId: string,
	maxWaitSeconds: number,
	itemIndex: number,
	pollIntervalMs = 3000,
): Promise<TripoTask> {
	const started = Date.now();
	let last: TripoTask = { task_id: taskId, status: 'queued' };
	for (;;) {
		last = await getTask.call(this, taskId, itemIndex);
		if (last.status === 'success') return last;
		if (last.status && TERMINAL_FAILURES.includes(last.status)) {
			const reason = last.error_message
				? `${String(last.error_message)}${last.error_code ? ` (code ${String(last.error_code)})` : ''}`
				: last.status === 'banned'
					? 'the input violates the content policy'
					: 'no reason given';
			throw new NodeOperationError(
				this.getNode(),
				`Tripo task ${taskId} ended with status "${last.status}": ${reason}`,
				{ itemIndex, description: 'Credits frozen for a failed or cancelled task are released.' },
			);
		}
		if (Date.now() - started >= maxWaitSeconds * 1000) break;
		await sleep(pollIntervalMs);
	}
	throw new NodeOperationError(
		this.getNode(),
		`Tripo task ${taskId} is still ${String(last.status ?? 'pending')} (${String(last.progress ?? 0)}%) after ${maxWaitSeconds} seconds`,
		{
			itemIndex,
			description:
				'Increase "Max Wait" or turn off "Wait for Completion" and fetch the result later with Task > Get.',
		},
	);
}
