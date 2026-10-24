import type { INodeProperties } from 'n8n-workflow';
import {
	additionalJson,
	alphabetical,
	IMAGE_MODEL_OPTIONS,
	inputGroup,
	outputOptions,
	waitProperties,
} from './shared';

const resource = ['image'];
const show = (operation: string[]) => ({ resource, operation });

const imageOptions = (withTemplate3d: boolean): INodeProperties[] =>
	alphabetical([
		{
			displayName: 'Aspect Ratio',
			name: 'aspectRatio',
			type: 'options',
			options: [
				{ name: '1:1', value: '1:1' },
				{ name: '1:4 (Banana 2)', value: '1:4' },
				{ name: '1:8 (Banana 2)', value: '1:8' },
				{ name: '16:9', value: '16:9' },
				{ name: '2:3', value: '2:3' },
				{ name: '21:9', value: '21:9' },
				{ name: '3:2', value: '3:2' },
				{ name: '3:4', value: '3:4' },
				{ name: '4:1 (Banana 2)', value: '4:1' },
				{ name: '4:3', value: '4:3' },
				{ name: '4:5', value: '4:5' },
				{ name: '5:4', value: '5:4' },
				{ name: '8:1 (Banana 2)', value: '8:1' },
				{ name: '9:16', value: '9:16' },
			],
			default: '1:1',
			description: 'Banana models only; Seedream and Chat Image use Size instead',
		},
		{
			displayName: 'Background',
			name: 'background',
			type: 'options',
			options: [
				{ name: 'Auto', value: 'auto' },
				{ name: 'Opaque', value: 'opaque' },
				{ name: 'Transparent (PNG Only)', value: 'transparent' },
			],
			default: 'auto',
			description: 'Chat Image 2.5 models only; ignored by the others',
		},
		{
			displayName: 'Output Format',
			name: 'outputFormat',
			type: 'options',
			options: [
				{ name: 'JPEG', value: 'jpeg' },
				{ name: 'PNG', value: 'png' },
			],
			default: 'png',
		},
		{
			displayName: 'Quality',
			name: 'quality',
			type: 'options',
			options: [
				{ name: 'Extra High (Chat Image 2.5)', value: 'xhigh' },
				{ name: 'High', value: 'high' },
				{ name: 'Low', value: 'low' },
				{ name: 'Max (Chat Image 2.5)', value: 'max' },
				{ name: 'Medium', value: 'medium' },
			],
			default: 'low',
			description: 'Chat Image 2 and 2.5 models only; other models reject it. High and above cost extra credits.',
		},
		{
			displayName: 'Size',
			name: 'size',
			type: 'string',
			default: '',
			placeholder: 'e.g. 2048x2048 or 2K',
			description: 'Output size as WxH pixels or a keyword such as 2K / 4K (default 2048x2048). Supported values vary by model.',
		},
		{
			displayName: 'Template',
			name: 'template',
			type: 'options',
			options: [
				...(withTemplate3d ? [{ name: '3D Enhance', value: '3d_enhance' }] : [{ name: 'Asset Extraction', value: 'asset_extraction' }]),
				{ name: 'Character Completion', value: 'character_completion' },
				{ name: 'Figure', value: 'figure' },
				{ name: 'None', value: '' },
				{ name: 'T-Pose', value: 't_pose' },
				{ name: 'Variants', value: 'variants' },
			],
			default: '',
			description: 'A generation template for common 3D-pipeline needs (T-pose, figure, variants, ...)',
		},
		{
			displayName: 'Watermark',
			name: 'watermark',
			type: 'boolean',
			default: false,
			description: 'Whether to add an AI-content watermark (Seedream models only)',
		},
	]);

export const imageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource } },
		options: [
			{
				name: 'Edit Multiview',
				value: 'editMultiview',
				action: 'Edit multiview images',
				description: 'Apply per-view edit instructions to an existing multiview image',
			},
			{
				name: 'Image to Image',
				value: 'imageToImage',
				action: 'Edit or transform an image',
				description: 'Edit, restyle or fuse reference images with a prompt or template',
			},
			{
				name: 'Image to Multiview',
				value: 'imageToMultiview',
				action: 'Generate multiview images from an image',
				description: 'Generate front, left, back and right views from one image (input for Multiview to Model)',
			},
			{
				name: 'Text to Image',
				value: 'textToImage',
				action: 'Generate an image from text',
				description: 'Generate a reference image from a prompt (feed its task ID into Image to Model)',
			},
		],
		default: 'textToImage',
	},

	// ------------------------------------------------------------ textToImage
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		placeholder: 'e.g. a full-body game character, T-pose, white background --no text',
		description: 'What to generate. Put the most important elements first; append --no for negatives.',
		displayOptions: { show: show(['textToImage']) },
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		options: IMAGE_MODEL_OPTIONS,
		default: 'seedream_v4',
		displayOptions: { show: show(['textToImage']) },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['textToImage']) },
		options: imageOptions(false),
	},

	// ----------------------------------------------------------- imageToImage
	...inputGroup({
		name: 'image',
		displayName: 'Image',
		description: 'The primary reference image',
		required: true,
		show: show(['imageToImage']),
		kinds: ['binary', 'url', 'fileToken', 'taskId'],
		what: 'image (PNG or JPEG, max 20 MB)',
	}),
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: 'e.g. turn the sketch into a clay figurine on a white background',
		description: 'The editing instruction. Required unless a Template is chosen.',
		displayOptions: { show: show(['imageToImage']) },
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		options: IMAGE_MODEL_OPTIONS.filter((option) => option.value !== 'seedream_v4'),
		default: 'seedream_v5',
		displayOptions: { show: show(['imageToImage']) },
	},
	{
		displayName: 'Additional Images',
		name: 'additionalImages',
		type: 'string',
		default: '',
		placeholder: 'e.g. ref2, https://example.com/ref3.png',
		description:
			'Comma-separated extra reference images (binary property names, URLs or file tokens), referenced in the prompt as image[1], image[2], ... Max 4 (Seedream), 10 (Banana), 16 (Chat Image).',
		displayOptions: { show: show(['imageToImage']) },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['imageToImage']) },
		options: imageOptions(true),
	},

	// ------------------------------------------------------- imageToMultiview
	...inputGroup({
		name: 'image',
		displayName: 'Image',
		description: 'The image of the object, clearly visible on a clean background',
		required: true,
		show: show(['imageToMultiview']),
		kinds: ['binary', 'url', 'fileToken', 'taskId'],
		what: 'image (PNG, JPEG or WebP)',
	}),

	// ---------------------------------------------------------- editMultiview
	...inputGroup({
		name: 'multiview',
		displayName: 'Multiview Image',
		description: 'The multiview image to edit',
		required: true,
		show: show(['editMultiview']),
		kinds: ['taskId', 'binary', 'url', 'fileToken'],
		what: 'multiview image',
	}),
	{
		displayName: 'Edits',
		name: 'editsUi',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Edit',
		default: {},
		required: true,
		description: 'One instruction per view to change',
		displayOptions: { show: show(['editMultiview']) },
		options: [
			{
				name: 'edit',
				displayName: 'Edit',
				values: [
					{
						displayName: 'Prompt',
						name: 'prompt',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. change the shirt colour to red',
					},
					{
						displayName: 'View',
						name: 'view',
						type: 'options',
						options: [
							{ name: 'Back', value: 'back' },
							{ name: 'Front', value: 'front' },
							{ name: 'Left', value: 'left' },
							{ name: 'Right', value: 'right' },
						],
						default: 'front',
					},
				],
			},
		],
	},

	...waitProperties(show(['textToImage', 'imageToImage', 'imageToMultiview', 'editMultiview']), true, 300),
	outputOptions(show(['textToImage', 'imageToImage', 'imageToMultiview', 'editMultiview'])),
	additionalJson(show(['textToImage', 'imageToImage', 'imageToMultiview', 'editMultiview'])),
];
