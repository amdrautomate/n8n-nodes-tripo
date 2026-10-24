import { NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';
import { fileFromBinary, splitList } from '../shared/inputs';
import { readOutputSettings, readWait, taskToItem } from '../shared/output';
import { getTask, tripoRequest, uploadFile, waitForTask, type TripoTask } from '../shared/transport';

export async function executeTask(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const settings = readOutputSettings(this, itemIndex);

	switch (operation) {
		case 'get': {
			const taskId = (this.getNodeParameter('taskId', itemIndex) as string).trim();
			if (!taskId) {
				throw new NodeOperationError(this.getNode(), 'Task ID is empty', { itemIndex });
			}
			const wait = readWait(this, itemIndex);
			const task = wait.enabled
				? await waitForTask.call(this, taskId, wait.maxWaitSeconds, itemIndex)
				: await getTask.call(this, taskId, itemIndex);
			return [await taskToItem.call(this, task, itemIndex, settings)];
		}

		case 'getMany': {
			const taskIds = splitList(this.getNodeParameter('taskIds', itemIndex));
			if (taskIds.length === 0) {
				throw new NodeOperationError(this.getNode(), 'Task IDs is empty', { itemIndex });
			}
			if (taskIds.length > 100) {
				throw new NodeOperationError(this.getNode(), 'Tripo queries at most 100 tasks per request', {
					itemIndex,
				});
			}
			const data = await tripoRequest.call(
				this,
				{ method: 'POST', path: '/tasks/list', body: { task_ids: taskIds } },
				itemIndex,
			);
			const tasks = (data.tasks as Record<string, TripoTask> | undefined) ?? {};
			const missed = Array.isArray(data.missed) ? (data.missed as string[]) : [];
			const items: INodeExecutionData[] = [];
			for (const taskId of taskIds) {
				const task = tasks[taskId];
				if (task) {
					items.push(await taskToItem.call(this, task, itemIndex, settings));
				} else if (missed.includes(taskId)) {
					items.push({ json: { task_id: taskId, status: 'missed' }, pairedItem: { item: itemIndex } });
				}
			}
			return items;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown task operation "${operation}"`, {
				itemIndex,
			});
	}
}

export async function executeFile(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	if (operation !== 'upload') {
		throw new NodeOperationError(this.getNode(), `Unknown file operation "${operation}"`, { itemIndex });
	}
	const property = (this.getNodeParameter('binaryProperty', itemIndex) as string).trim() || 'data';
	const file = await fileFromBinary.call(this, itemIndex, property, 'upload');
	const fileToken = await uploadFile.call(this, file, itemIndex);
	return [
		{
			json: { file_token: fileToken, fileName: file.filename, mimeType: file.contentType, size: file.data.length },
			pairedItem: { item: itemIndex },
		},
	];
}

export async function executeAccount(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;

	switch (operation) {
		case 'getBalance': {
			const data = await tripoRequest.call(this, { method: 'GET', path: '/account/balance' }, itemIndex);
			return [{ json: data, pairedItem: { item: itemIndex } }];
		}

		case 'getUsage': {
			const data = await tripoRequest.call(this, { method: 'GET', path: '/account/usage' }, itemIndex);
			const rows = Array.isArray(data.items) ? (data.items as IDataObject[]) : [data];
			return rows.map((json) => ({ json, pairedItem: { item: itemIndex } }));
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown account operation "${operation}"`, {
				itemIndex,
			});
	}
}
