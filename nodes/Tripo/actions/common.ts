import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { mergeAdditionalJson } from '../shared/inputs';
import { finishTask, readOutputSettings, readWait } from '../shared/output';
import { tripoRequest } from '../shared/transport';

/**
 * Creates a task with the merged body, then waits for it (when asked) and turns the
 * result into an item with downloaded files. Shared by every task-creating operation.
 */
export async function createAndFinish(
	this: IExecuteFunctions,
	path: string,
	body: IDataObject,
	itemIndex: number,
	defaultMaxWait = 600,
): Promise<INodeExecutionData[]> {
	const finalBody = mergeAdditionalJson(
		this,
		body,
		this.getNodeParameter('additionalJson', itemIndex, ''),
		itemIndex,
	);
	const created = await tripoRequest.call(this, { method: 'POST', path, body: finalBody }, itemIndex);
	const wait = readWait(this, itemIndex, defaultMaxWait);
	const settings = readOutputSettings(this, itemIndex);
	return await finishTask.call(this, created, itemIndex, wait, settings);
}

/** Replaces the Compress Geometry switch with Tripo's `compress: "geometry"` string. */
export function compressField(options: IDataObject): IDataObject {
	return options.compress === true ? { compress: 'geometry' } : {};
}
