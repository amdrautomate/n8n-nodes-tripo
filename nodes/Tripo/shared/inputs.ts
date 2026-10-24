import { NodeOperationError, type IDataObject, type IExecuteFunctions } from 'n8n-workflow';
import type { MultipartFile } from './multipart';
import { uploadFile } from './transport';

/**
 * Helpers that turn node parameters into Tripo request fields.
 *
 * Tripo's v3 API takes every file-like input as one `input` string that is a public URL,
 * a `file_token` (from POST /files) or a `task_id` of an earlier task. The node adds a
 * fourth way: binary data of the incoming item, which it uploads first.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	bmp: 'image/bmp',
	tif: 'image/tiff',
	tiff: 'image/tiff',
	glb: 'model/gltf-binary',
	gltf: 'model/gltf+json',
	fbx: 'application/octet-stream',
	obj: 'model/obj',
	stl: 'model/stl',
	usdz: 'model/vnd.usdz+zip',
	'3mf': 'model/3mf',
	splat: 'application/octet-stream',
};

export function guessContentType(filename: string, fallback = 'application/octet-stream'): string {
	const ext = filename.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXTENSION[ext] ?? fallback;
}

/** Reads one binary property of the item into a file part. */
export async function fileFromBinary(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryProperty: string,
	fallbackName: string,
): Promise<MultipartFile> {
	const property = binaryProperty.trim();
	const binary = this.helpers.assertBinaryData(itemIndex, property);
	const data = await this.helpers.getBinaryDataBuffer(itemIndex, property);
	const filename = binary.fileName ?? `${fallbackName}.${binary.fileExtension ?? 'bin'}`;
	return {
		field: 'file',
		filename,
		contentType: binary.mimeType || guessContentType(filename),
		data,
	};
}

/** Uploads a binary property and returns the file token. */
export async function tokenFromBinary(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryProperty: string,
	fallbackName: string,
): Promise<string> {
	const file = await fileFromBinary.call(this, itemIndex, binaryProperty, fallbackName);
	return await uploadFile.call(this, file, itemIndex);
}

export type InputKind = 'binary' | 'url' | 'fileToken' | 'taskId' | 'none';

/**
 * Resolves an input parameter group (`<name>Source`, `<name>BinaryProperty`, `<name>Url`,
 * `<name>FileToken`, `<name>TaskId`) into the string Tripo expects in `input`.
 * Returns undefined when the group is optional and set to None.
 */
export async function resolveInput(
	this: IExecuteFunctions,
	itemIndex: number,
	name: string,
	displayName: string,
	required: boolean,
): Promise<string | undefined> {
	const source = this.getNodeParameter(
		`${name}Source`,
		itemIndex,
		required ? 'binary' : 'none',
	) as InputKind;
	const fail = (what: string): never => {
		throw new NodeOperationError(this.getNode(), `'${displayName}' ${what}`, { itemIndex });
	};
	switch (source) {
		case 'none':
			return required ? fail('is required for this operation') : undefined;
		case 'url': {
			const url = (this.getNodeParameter(`${name}Url`, itemIndex, '') as string).trim();
			if (!url) return required ? fail('URL is empty') : undefined;
			if (!/^https?:\/\//i.test(url)) fail('must be a public http(s) URL');
			return url;
		}
		case 'fileToken': {
			const token = (this.getNodeParameter(`${name}FileToken`, itemIndex, '') as string).trim();
			if (!token) return required ? fail('file token is empty') : undefined;
			return token;
		}
		case 'taskId': {
			const taskId = (this.getNodeParameter(`${name}TaskId`, itemIndex, '') as string).trim();
			if (!taskId) return required ? fail('task ID is empty') : undefined;
			return taskId;
		}
		default: {
			const property = (
				this.getNodeParameter(`${name}BinaryProperty`, itemIndex, 'data') as string
			).trim();
			if (!property) return required ? fail('binary property is empty') : undefined;
			return await tokenFromBinary.call(this, itemIndex, property, name);
		}
	}
}

/**
 * Turns a free-form reference (binary property name, URL, file token or task ID) into the
 * string Tripo expects. Used where several images are listed in one field.
 */
export async function resolveReference(
	this: IExecuteFunctions,
	itemIndex: number,
	value: string,
	fallbackName: string,
): Promise<string> {
	const trimmed = value.trim();
	if (/^https?:\/\//i.test(trimmed) || /^(file|task)_/i.test(trimmed)) return trimmed;
	return await tokenFromBinary.call(this, itemIndex, trimmed, fallbackName);
}

/** Comma- or newline-separated string (or array) to trimmed non-empty strings. */
export function splitList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
	return String(value ?? '')
		.split(/[,\n]/)
		.map((v) => v.trim())
		.filter(Boolean);
}

/** Parses a JSON parameter that may arrive as a string or an already-parsed value. */
export function parseJson<T = IDataObject>(
	context: IExecuteFunctions,
	value: unknown,
	displayName: string,
	itemIndex: number,
): T | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') return value as T;
	const trimmed = value.trim();
	if (trimmed === '' || trimmed === '{}' || trimmed === '[]') return undefined;
	try {
		return JSON.parse(trimmed) as T;
	} catch {
		throw new NodeOperationError(context.getNode(), `'${displayName}' must be valid JSON`, {
			itemIndex,
			description: 'Check for missing quotes, unquoted keys or trailing commas',
		});
	}
}

/** Numeric option names where 0 means "not set". */
const ZERO_MEANS_UNSET = new Set([
	'faceLimit',
	'modelSeed',
	'imageSeed',
	'textureSeed',
	'textureSize',
	'scaleFactor',
]);

/**
 * Copies option values into API fields under the names given, skipping empty values,
 * empty arrays and zeros that mean "unset". Booleans are kept as booleans (v3 is JSON).
 */
export function mapOptions(options: IDataObject, mapping: Record<string, string>): IDataObject {
	const out: IDataObject = {};
	for (const [param, field] of Object.entries(mapping)) {
		const value = options[param];
		if (value === undefined || value === null || value === '') continue;
		if (typeof value === 'number' && value === 0 && ZERO_MEANS_UNSET.has(param)) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[field] = value;
	}
	return out;
}

/** Merges an "Additional Fields (JSON)" object over the body. */
export function mergeAdditionalJson(
	context: IExecuteFunctions,
	body: IDataObject,
	value: unknown,
	itemIndex: number,
): IDataObject {
	const extra = parseJson<IDataObject>(context, value, 'Additional Fields (JSON)', itemIndex);
	if (!extra) return body;
	if (Array.isArray(extra) || typeof extra !== 'object') {
		throw new NodeOperationError(context.getNode(), "'Additional Fields (JSON)' must be a JSON object", {
			itemIndex,
		});
	}
	return { ...body, ...extra };
}
