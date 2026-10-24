import type { INodeProperties } from 'n8n-workflow';
import {
	additionalJson,
	alphabetical,
	EXPORT_ORIENTATION_OPTIONS,
	inputGroup,
	outputOptions,
	referenceField,
	waitProperties,
} from './shared';

const resource = ['mesh'];
const show = (operation: string[]) => ({ resource, operation });

export const meshDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource } },
		options: [
			{
				name: 'Complete Parts',
				value: 'complete',
				action: 'Complete segmented mesh parts',
				description: 'Fill the missing regions of parts produced by Segment',
			},
			{
				name: 'Retopologize',
				value: 'decimate',
				action: 'Reduce the polycount of a model',
				description: 'Reduce the polycount with clean topology, optionally as quads and with new UVs',
			},
			{
				name: 'Segment',
				value: 'segment',
				action: 'Segment a model into parts',
				description: 'Split a model into semantic parts',
			},
			{
				name: 'Smart Segment',
				value: 'smartSegment',
				action: 'Segment an image or model end to end',
				description: 'End-to-end segmentation from an image or a GLB, including auto modelling',
			},
			{
				name: 'Smart UV',
				value: 'uv',
				action: 'Unwrap a model with smart UV',
				description: 'Re-unwrap UVs and remap textures, rigging and animation onto the new layout (max 80,000 triangles)',
			},
		],
		default: 'decimate',
	},

	...inputGroup({
		name: 'model',
		displayName: 'Model',
		description: 'The model to process',
		required: true,
		show: show(['segment', 'decimate', 'uv']),
		kinds: ['taskId', 'binary', 'url', 'fileToken'],
		what: '3D model (GLB, GLTF, FBX, OBJ or STL, max 150 MB)',
	}),

	// ---------------------------------------------------------------- segment
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['segment']) },
		options: alphabetical([
			{
				displayName: 'Granularity',
				name: 'segmentationGranularity',
				type: 'options',
				options: [
					{ name: 'Balanced', value: 'balanced' },
					{ name: 'Detailed', value: 'detailed' },
					{ name: 'Simple', value: 'simple' },
				],
				default: 'balanced',
				description: 'Segmentation model v2 only',
			},
			referenceField(
				'refImage',
				'Reference Image',
				'Optional image or segmentation mask guiding the semantic analysis (v2 only; overrides granularity and connectivity).',
				{},
			),
			{
				displayName: 'Segmentation Model',
				name: 'segmentModel',
				type: 'options',
				options: [
					{ name: 'v1.0-20250506 (Geometry Based, Default)', value: 'v1.0-20250506' },
					{ name: 'v2.0-20260430 (Semantic Labelling, Beta)', value: 'v2.0-20260430' },
				],
				default: 'v1.0-20250506',
			},
			{
				displayName: 'Split by Connectivity',
				name: 'splitByConnectivity',
				type: 'boolean',
				default: true,
				description: 'Whether to split by connected components (v2 only)',
			},
		]),
	},

	// --------------------------------------------------------------- complete
	{
		displayName: 'Segment Task ID',
		name: 'segmentTaskId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. task_abc123',
		description: 'The ID of the Segment task whose parts are completed',
		displayOptions: { show: show(['complete']) },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['complete']) },
		options: alphabetical([
			{
				displayName: 'Completion Mode',
				name: 'completionMode',
				type: 'options',
				options: [
					{ name: 'AI Completion', value: 'ai_completion', description: 'Diffusion-based, generates realistic geometry' },
					{ name: 'Quick Cap', value: 'quick_cap', description: 'Fast sealing of open boundaries' },
				],
				default: 'ai_completion',
			},
			{
				displayName: 'Part Names',
				name: 'partNames',
				type: 'string',
				default: '',
				description: 'Comma-separated part names to complete (default: all parts)',
			},
		]),
	},

	// --------------------------------------------------------------- decimate
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['decimate']) },
		options: alphabetical([
			{
				displayName: 'Bake',
				name: 'bake',
				type: 'boolean',
				default: true,
				description: 'Whether to bake the textures onto the low-poly model (not on v1.0)',
			},
			{
				displayName: 'Face Limit',
				name: 'faceLimit',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0 },
				description: 'Target polycount (0 = adaptive). v3.0: 500-20,000 triangles or 500-10,000 quads.',
			},
			{
				displayName: 'Part Names',
				name: 'partNames',
				type: 'string',
				default: '',
				description: 'Comma-separated part names from a Segment task to decimate (not on v1.0)',
			},
			{
				displayName: 'Quad',
				name: 'quad',
				type: 'boolean',
				default: false,
				description: 'Whether to output a quad mesh (v3.0: 40 credits instead of 35)',
			},
			{
				displayName: 'Retopology Model',
				name: 'decimateModel',
				type: 'options',
				options: [
					{ name: 'v1.0 (Basic Decimation)', value: 'v1.0' },
					{ name: 'v2.0 (Smart High-to-Low Poly, Default)', value: 'v2.0' },
					{ name: 'v3.0 (Newest, Optional Smart UV)', value: 'v3.0' },
				],
				default: 'v2.0',
			},
			{
				displayName: 'Smart UV',
				name: 'smartUv',
				type: 'boolean',
				default: false,
				description: 'Whether to unwrap UVs as part of retopology (v3.0 only, no extra cost)',
			},
		]),
	},

	// --------------------------------------------------------------------- uv
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['uv']) },
		options: alphabetical([
			{
				displayName: 'Bake',
				name: 'bake',
				type: 'boolean',
				default: true,
				description: 'Whether to bake the existing textures onto the new UV layout',
			},
			{
				displayName: 'Compress Geometry',
				name: 'compress',
				type: 'boolean',
				default: false,
				description: 'Whether to apply meshopt compression for a smaller file',
			},
			{
				displayName: 'Export Orientation',
				name: 'exportOrientation',
				type: 'options',
				options: EXPORT_ORIENTATION_OPTIONS,
				default: '+x',
			},
		]),
	},

	// ----------------------------------------------------------- smartSegment
	{
		displayName: 'Input Type',
		name: 'segType',
		type: 'options',
		options: [
			{ name: 'Image', value: 'image', description: 'PNG, JPEG or WebP; Tripo models and segments it' },
			{ name: 'Model (GLB)', value: 'model', description: 'An existing GLB model (needs a transform matrix)' },
		],
		default: 'image',
		displayOptions: { show: show(['smartSegment']) },
	},
	...inputGroup({
		name: 'segInput',
		displayName: 'Input',
		description: 'The image or GLB model to segment',
		required: true,
		show: show(['smartSegment']),
		kinds: ['binary', 'url', 'fileToken'],
		what: 'image or GLB model',
	}),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['smartSegment']) },
		options: alphabetical([
			{
				displayName: 'Granularity',
				name: 'granularity',
				type: 'options',
				options: [
					{ name: 'Coarse', value: 'coarse' },
					{ name: 'Fine', value: 'fine' },
					{ name: 'Medium', value: 'medium' },
				],
				default: 'medium',
			},
			{
				displayName: 'Hint',
				name: 'hint',
				type: 'string',
				default: '',
				placeholder: 'e.g. head, body, left arm, right arm, legs',
				description: 'Text that helps identify the parts to segment',
			},
			{
				displayName: 'Transform Matrix',
				name: 'transform',
				type: 'string',
				default: '1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1',
				description: 'Column-major 4x4 transform of the model as 16 comma-separated numbers (required for GLB input)',
			},
		]),
	},

	...waitProperties(show(['segment', 'complete', 'decimate', 'uv', 'smartSegment']), true, 600),
	outputOptions(show(['segment', 'complete', 'decimate', 'uv', 'smartSegment'])),
	additionalJson(show(['segment', 'complete', 'decimate', 'uv', 'smartSegment'])),
];
