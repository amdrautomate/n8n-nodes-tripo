import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { executeAnimation } from './actions/animation';
import { executeImage } from './actions/image';
import { executeMesh } from './actions/mesh';
import { executeModel } from './actions/model';
import { executeAccount, executeFile, executeTask } from './actions/task';
import { animationDescription } from './descriptions/animation';
import { imageDescription } from './descriptions/image';
import { meshDescription } from './descriptions/mesh';
import { modelDescription } from './descriptions/model';
import { accountDescription, fileDescription, taskDescription } from './descriptions/task';

/**
 * Programmatic node: every Tripo operation creates an asynchronous task that has to be
 * polled, inputs from binary data must be uploaded first to get a file token, and the
 * result files (GLB, FBX, images) are downloaded into binary data. Declarative routing
 * cannot express those dependent, file-carrying calls.
 */
export class Tripo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tripo',
		name: 'tripo',
		icon: { light: 'file:../../icons/tripo.svg', dark: 'file:../../icons/tripo.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Generate 3D models from text, images or multiview photos, texture, convert, retopologize, segment, rig and animate them, and generate images with the Tripo API',
		defaults: {
			name: 'Tripo',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'tripoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Animation', value: 'animation' },
					{ name: 'File', value: 'file' },
					{ name: 'Image', value: 'image' },
					{ name: 'Mesh', value: 'mesh' },
					{ name: 'Model', value: 'model' },
					{ name: 'Task', value: 'task' },
				],
				default: 'model',
			},
			...accountDescription,
			...animationDescription,
			...fileDescription,
			...imageDescription,
			...meshDescription,
			...modelDescription,
			...taskDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				let results: INodeExecutionData[];
				switch (resource) {
					case 'model':
						results = await executeModel.call(this, i);
						break;
					case 'image':
						results = await executeImage.call(this, i);
						break;
					case 'animation':
						results = await executeAnimation.call(this, i);
						break;
					case 'mesh':
						results = await executeMesh.call(this, i);
						break;
					case 'task':
						results = await executeTask.call(this, i);
						break;
					case 'file':
						results = await executeFile.call(this, i);
						break;
					case 'account':
						results = await executeAccount.call(this, i);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
							itemIndex: i,
						});
				}
				returnData.push(...results);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				const known = error as Error;
				if (known instanceof NodeApiError || known instanceof NodeOperationError) throw known;
				throw new NodeOperationError(this.getNode(), known, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
