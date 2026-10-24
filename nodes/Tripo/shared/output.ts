import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { guessContentType } from './inputs';
import { downloadUrl, waitForTask, type TripoTask } from './transport';

export interface OutputSettings {
	/** Download every `*_url` of the task output into binary data. */
	download: boolean;
	/** Also download preview renders (rendered_image_url, uv_render_url, ...). */
	includePreviews: boolean;
	/** Prefix for the binary property names (empty = none). */
	binaryPrefix: string;
}

export interface WaitSettings {
	enabled: boolean;
	maxWaitSeconds: number;
}

/** Reads the shared Wait for Completion pair of an operation. */
export function readWait(context: IExecuteFunctions, itemIndex: number, defaultMax = 600): WaitSettings {
	const enabled = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;
	const maxWaitSeconds =
		Number(context.getNodeParameter('maxWaitSeconds', itemIndex, defaultMax)) || defaultMax;
	return { enabled, maxWaitSeconds };
}

/** Reads the shared Output Options collection. */
export function readOutputSettings(context: IExecuteFunctions, itemIndex: number): OutputSettings {
	const options = context.getNodeParameter('outputOptions', itemIndex, {}) as IDataObject;
	return {
		download: options.download === undefined ? true : (options.download as boolean),
		includePreviews:
			options.includePreviews === undefined ? true : (options.includePreviews as boolean),
		binaryPrefix: String(options.binaryPrefix ?? '').trim(),
	};
}

const PREVIEW_KEYS = new Set(['rendered_image_url', 'uv_render_url', 'mask_url']);

const EXT_BY_TYPE: Record<string, string> = {
	'model/gltf-binary': 'glb',
	'model/gltf+json': 'gltf',
	'model/obj': 'obj',
	'model/stl': 'stl',
	'model/vnd.usdz+zip': 'usdz',
	'model/3mf': '3mf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'application/zip': 'zip',
};

function fileNameFor(url: string, key: string, contentType: string): string {
	try {
		const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
		if (last.includes('.')) return decodeURIComponent(last);
	} catch {
		// fall through to a synthetic name
	}
	const type = contentType.split(';')[0].trim();
	const fromType = EXT_BY_TYPE[type];
	const fromUrl = url.split('?')[0].split('.').pop() ?? '';
	const ext = fromType ?? (/^[a-z0-9]{2,5}$/i.test(fromUrl) ? fromUrl.toLowerCase() : 'bin');
	return `${key.replace(/_url$/, '')}.${ext}`;
}

/** Collects every `<key>_url` string of the task output (one level deep). */
export function outputUrls(output: IDataObject | undefined): Array<[string, string]> {
	const found: Array<[string, string]> = [];
	for (const [key, value] of Object.entries(output ?? {})) {
		if (typeof value === 'string' && key.endsWith('_url') && /^https?:\/\//i.test(value)) {
			found.push([key, value]);
		} else if (Array.isArray(value) && key.endsWith('_urls')) {
			value.forEach((entry, index) => {
				if (typeof entry === 'string' && /^https?:\/\//i.test(entry)) {
					found.push([`${key.replace(/_urls$/, '')}_${index + 1}_url`, entry]);
				}
			});
		}
	}
	return found;
}

/**
 * Turns a task into one node item: the task fields in JSON and, with download on, every
 * result file as binary data (property named after the output key: `model`,
 * `rendered_image`, `pbr_model`, ...). Result URLs are temporary, so download is the default.
 */
export async function taskToItem(
	this: IExecuteFunctions,
	task: TripoTask,
	itemIndex: number,
	settings: OutputSettings,
): Promise<INodeExecutionData> {
	const json: IDataObject = { ...(task as IDataObject) };
	const item: INodeExecutionData = { json, pairedItem: { item: itemIndex } };
	if (!settings.download || task.status !== 'success') return item;

	const files = outputUrls(task.output).filter(
		([key]) => settings.includePreviews || !PREVIEW_KEYS.has(key),
	);
	if (files.length === 0) return item;

	item.binary = {};
	for (const [key, url] of files) {
		const downloaded = await downloadUrl.call(this, url);
		const contentType =
			downloaded.contentType === 'application/octet-stream' || downloaded.contentType.startsWith('binary/')
				? guessContentType(url, downloaded.contentType)
				: downloaded.contentType.split(';')[0].trim();
		const fileName = fileNameFor(url, key, contentType);
		const property = `${settings.binaryPrefix}${key.replace(/_url$/, '')}`;
		item.binary[property] = await this.helpers.prepareBinaryData(downloaded.data, fileName, contentType);
	}
	return item;
}

/**
 * Finishes a task-creating operation: waits for the task when asked, then builds the
 * output item. Without waiting, the pending task (task_id, status) is returned as is.
 */
export async function finishTask(
	this: IExecuteFunctions,
	created: IDataObject,
	itemIndex: number,
	wait: WaitSettings,
	settings: OutputSettings,
): Promise<INodeExecutionData[]> {
	const taskId = created.task_id as string | undefined;
	if (!taskId) {
		return [{ json: created, pairedItem: { item: itemIndex } }];
	}
	if (!wait.enabled) {
		return [{ json: { task_id: taskId, status: 'queued', ...created }, pairedItem: { item: itemIndex } }];
	}
	const task = await waitForTask.call(this, taskId, wait.maxWaitSeconds, itemIndex);
	return [await taskToItem.call(this, task, itemIndex, settings)];
}
