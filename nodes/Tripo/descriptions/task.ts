import type { INodeProperties } from 'n8n-workflow';
import { outputOptions, waitProperties } from './shared';

const taskResource = ['task'];
const fileResource = ['file'];
const accountResource = ['account'];

export const taskDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: taskResource } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a task',
				description: 'Get the status and result files of a task, optionally waiting until it finishes',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many tasks',
				description: 'Get the status of up to 100 tasks in one request',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. task_abc123',
		displayOptions: { show: { resource: taskResource, operation: ['get'] } },
	},
	{
		displayName: 'Task IDs',
		name: 'taskIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. task_abc123, task_def456',
		description: 'Comma-separated task IDs, up to 100',
		displayOptions: { show: { resource: taskResource, operation: ['getMany'] } },
	},
	...waitProperties({ resource: taskResource, operation: ['get'] }, false, 600),
	outputOptions({ resource: taskResource, operation: ['get', 'getMany'] }),
];

export const fileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: fileResource } },
		options: [
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a file',
				description: 'Upload an image (max 20 MB) or model (max 150 MB) and get a file_token to reuse in several tasks',
			},
		],
		default: 'upload',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		description: 'Name of the binary property of the input item that holds the file',
		displayOptions: { show: { resource: fileResource, operation: ['upload'] } },
	},
];

export const accountDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: accountResource } },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				action: 'Get the credit balance',
				description: 'Get the available and frozen credits of the account',
			},
			{
				name: 'Get Usage',
				value: 'getUsage',
				action: 'Get the credit usage',
				description: 'Get the credits consumed per task',
			},
		],
		default: 'getBalance',
	},
];
