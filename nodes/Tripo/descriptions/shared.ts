import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

type Show = NonNullable<IDisplayOptions['show']>;

export type InputKindName = 'binary' | 'url' | 'fileToken' | 'taskId';

interface InputGroupOptions {
	/** Prefix of the parameter names: `<name>Source`, `<name>BinaryProperty`, `<name>Url`, ... */
	name: string;
	displayName: string;
	description: string;
	required: boolean;
	show: Show;
	/** Which sources to offer, in this order. */
	kinds: InputKindName[];
	/** Default source. */
	defaultKind?: InputKindName;
	/** What the input is, for the field descriptions ("image", "3D model", "multiview image"). */
	what: string;
}

const KIND_OPTIONS: Record<InputKindName, { name: string; description: string }> = {
	binary: { name: 'Binary Data', description: 'A binary property of the input item, uploaded to Tripo first' },
	url: { name: 'URL', description: 'A public http(s) URL Tripo downloads' },
	fileToken: { name: 'File Token', description: 'A file_token from File > Upload' },
	taskId: { name: 'Task ID', description: 'The output of an earlier Tripo task' },
};

/** The parameters that let the user supply one input as binary data, URL, file token or task ID. */
export function inputGroup({
	name,
	displayName,
	description,
	required,
	show,
	kinds,
	defaultKind,
	what,
}: InputGroupOptions): INodeProperties[] {
	const sourceOptions = kinds.map((kind) => ({ value: kind, ...KIND_OPTIONS[kind] }));
	if (!required) {
		sourceOptions.unshift({ value: 'none' as InputKindName, name: 'None', description: 'Do not send this input' });
	}
	const source: INodeProperties = {
		displayName,
		name: `${name}Source`,
		type: 'options',
		default: 'binary',
		description,
		options: sourceOptions,
		displayOptions: { show },
	};
	source.default = required ? (defaultKind ?? kinds[0]) : 'none';
	const out: INodeProperties[] = [source];
	if (kinds.includes('binary')) {
		out.push({
			displayName: `${displayName} Binary Property`,
			name: `${name}BinaryProperty`,
			type: 'string',
			default: 'data',
			required,
			description: `Name of the binary property of the input item that holds the ${what}`,
			displayOptions: { show: { ...show, [`${name}Source`]: ['binary'] } },
		});
	}
	if (kinds.includes('url')) {
		out.push({
			displayName: `${displayName} URL`,
			name: `${name}Url`,
			type: 'string',
			default: '',
			required,
			placeholder: 'e.g. https://example.com/file.png',
			description: `Public URL of the ${what}`,
			displayOptions: { show: { ...show, [`${name}Source`]: ['url'] } },
		});
	}
	if (kinds.includes('fileToken')) {
		out.push({
			displayName: `${displayName} File Token`,
			name: `${name}FileToken`,
			type: 'string',
			default: '',
			required,
			placeholder: 'e.g. file_abc123',
			description: `The file_token of an uploaded ${what} (File > Upload)`,
			displayOptions: { show: { ...show, [`${name}Source`]: ['fileToken'] } },
		});
	}
	if (kinds.includes('taskId')) {
		out.push({
			displayName: `${displayName} Task ID`,
			name: `${name}TaskId`,
			type: 'string',
			default: '',
			required,
			placeholder: 'e.g. task_abc123',
			description: `The ID of the Tripo task whose output ${what} is used`,
			displayOptions: { show: { ...show, [`${name}Source`]: ['taskId'] } },
		});
	}
	return out;
}

/** A free-form reference field: binary property name, URL or file token. */
export function referenceField(
	name: string,
	displayName: string,
	description: string,
	show: Show,
	required = false,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		default: '',
		required,
		placeholder: 'e.g. data, https://example.com/front.png or file_abc123',
		description: `${description.replace(/\.$/, '')}. A binary property name of the input item (uploaded for you), a public URL or a file_token.`,
		displayOptions: { show },
	};
}

/** "Wait for Completion" and "Max Wait" for operations that create a task. */
export function waitProperties(show: Show, defaultWait = true, defaultMaxWait = 600): INodeProperties[] {
	const wait: INodeProperties = {
			displayName: 'Wait for Completion',
			name: 'waitForCompletion',
			type: 'boolean',
			default: true,
			description:
				'Whether to poll until the task is done and return its files, instead of returning the task ID right away (fetch it later with Task > Get)',
			displayOptions: { show },
		};
	wait.default = defaultWait;
	return [
		wait,
		{
			displayName: 'Max Wait (Seconds)',
			name: 'maxWaitSeconds',
			type: 'number',
			default: defaultMaxWait,
			typeOptions: { minValue: 5 },
			description: 'How long to poll before the node fails. 3D generation usually takes 1-5 minutes.',
			displayOptions: { show: { ...show, waitForCompletion: [true] } },
		},
	];
}

/** Output options: download result files into binary data. */
export function outputOptions(show: Show): INodeProperties {
	return {
		displayName: 'Output Options',
		name: 'outputOptions',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Binary Property Prefix',
				name: 'binaryPrefix',
				type: 'string',
				default: '',
				placeholder: 'e.g. tripo_',
				description:
					'Prefix for the binary property names. Files are named after the output key: model, rendered_image, pbr_model, uv_render, ...',
			},
			{
				displayName: 'Download Files',
				name: 'download',
				type: 'boolean',
				default: true,
				description:
					'Whether to download the result files (GLB, FBX, images) into binary data. Tripo result URLs expire, so keep this on unless you only need the task JSON.',
			},
			{
				displayName: 'Include Preview Images',
				name: 'includePreviews',
				type: 'boolean',
				default: true,
				description: 'Whether to download preview renders (rendered_image, uv_render, mask) as well as the model files',
			},
		],
	};
}

/** Free-form JSON merged over the request body. */
export function additionalJson(show: Show): INodeProperties {
	return {
		displayName: 'Additional Fields (JSON)',
		name: 'additionalJson',
		type: 'json',
		default: '{}',
		description:
			'Advanced: any other request fields as a JSON object, merged over the fields above (for new Tripo parameters the node does not list yet)',
		displayOptions: { show },
	};
}

/** Sorts collection options by display name, as n8n asks. */
export function alphabetical(options: INodeProperties[]): INodeProperties[] {
	return [...options].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export const GEOMETRY_MODEL_OPTIONS = [
	{ name: 'H3.1 (v3.1-20260211, Default)', value: 'v3.1-20260211', description: 'Latest high-precision model' },
	{ name: 'H3.0 (v3.0-20250812)', value: 'v3.0-20250812', description: 'Previous stable version' },
	{ name: 'H2.5 (v2.5-20250123)', value: 'v2.5-20250123', description: 'Legacy version' },
	{ name: 'P2 Preview (P2-20260801)', value: 'P2-20260801', description: 'Clean topology, native quad output, 48-50,000 triangles' },
	{ name: 'P1 (P1-20260311)', value: 'P1-20260311', description: 'Low-poly, 50-20,000 faces, game assets' },
];

export const TEXTURE_VERSION_OPTIONS = [
	{ name: 'Derived From Geometry Model (Default)', value: '' },
	{ name: 'v3.5-20260815 (Newest, Fast Quality, Delight)', value: 'v3.5-20260815' },
	{ name: 'v3.0-20250812', value: 'v3.0-20250812' },
	{ name: 'v2.5-20250123', value: 'v2.5-20250123' },
];

export const TEXTURE_QUALITY_OPTIONS = [
	{ name: 'Detailed', value: 'detailed', description: 'Higher fidelity, slower' },
	{ name: 'Extreme (8K)', value: 'extreme', description: '8K textures, costs extra credits' },
	{ name: 'Fast', value: 'fast', description: 'Fastest; needs texture model v3.5-20260815' },
	{ name: 'Standard', value: 'standard' },
];

export const EXPORT_ORIENTATION_OPTIONS = [
	{ name: '+X (Default)', value: '+x' },
	{ name: '-X', value: '-x' },
	{ name: '+Y', value: '+y' },
	{ name: '-Y', value: '-y' },
];

export const IMAGE_MODEL_OPTIONS = [
	{ name: 'Banana', value: 'banana', description: 'Fast generation' },
	{ name: 'Banana 2', value: 'banana2', description: 'Latest fast version' },
	{ name: 'Banana Pro', value: 'banana_pro', description: 'High quality' },
	{ name: 'Chat Image 2', value: 'chat_image_2', description: 'Best quality; supports quality tiers' },
	{ name: 'Chat Image 2.5 Flare', value: 'chat_image_2.5_flare', description: 'Speed tier; quality tiers and transparent backgrounds' },
	{ name: 'Chat Image 2.5 Sunburst', value: 'chat_image_2.5_sunburst', description: 'Fidelity tier; quality tiers and transparent backgrounds' },
	{ name: 'Seedream V4', value: 'seedream_v4', description: 'Balanced text-to-image default (not for image-to-image)' },
	{ name: 'Seedream V5', value: 'seedream_v5', description: 'Latest quality; image-to-image default' },
];

/**
 * Generation options shared by Text/Image/Multiview to Model. `kind` adds the inputs only
 * some endpoints take (negative prompt for text, image autofix for images).
 */
export function generationOptions(kind: 'text' | 'image' | 'multiview'): INodeProperties[] {
	const options: INodeProperties[] = [
		{
			displayName: 'Auto Size',
			name: 'autoSize',
			type: 'boolean',
			default: false,
			description: 'Whether to scale the model to real-world size in metres (AR/VR and game scenes)',
		},
		{
			displayName: 'Compress Geometry',
			name: 'compress',
			type: 'boolean',
			default: false,
			description: 'Whether to apply meshopt compression for a smaller file (model v3.0 or newer)',
		},
		{
			displayName: 'Delight',
			name: 'delight',
			type: 'boolean',
			default: true,
			description: 'Whether to remove baked-in lighting from the reference image before texturing (texture model v3.5 only)',
		},
		{
			displayName: 'Export Orientation',
			name: 'exportOrientation',
			type: 'options',
			options: EXPORT_ORIENTATION_OPTIONS,
			default: '+x',
			description: 'Forward axis of the exported model. Leave at the default when the model will be textured, rigged or converted afterwards.',
		},
		{
			displayName: 'Export UV',
			name: 'exportUv',
			type: 'boolean',
			default: true,
			description: 'Whether to unwrap UVs during generation. Off is faster and smaller; texturing unwraps later.',
		},
		{
			displayName: 'Face Limit',
			name: 'faceLimit',
			type: 'number',
			default: 0,
			typeOptions: { minValue: 0 },
			description: 'Maximum polycount (0 = adaptive). Game-ready assets: 50,000-100,000. Web and mobile: 10,000-50,000. P1: 50-20,000.',
		},
		{
			displayName: 'Generate Parts',
			name: 'generateParts',
			type: 'boolean',
			default: false,
			description: 'Whether to output editable segmented parts. Requires Texture and PBR off; not compatible with Quad or Smart Low Poly.',
		},
		{
			displayName: 'Geometry Quality',
			name: 'geometryQuality',
			type: 'options',
			options: [
				{ name: 'Detailed (Ultra)', value: 'detailed' },
				{ name: 'Standard', value: 'standard' },
			],
			default: 'standard',
			description: 'Model v3.0 or newer only',
		},
		{
			displayName: 'Model Seed',
			name: 'modelSeed',
			type: 'number',
			default: 0,
			description: 'Seed for the geometry; the same seed and input give the same mesh (0 = random)',
		},
		{
			displayName: 'PBR',
			name: 'pbr',
			type: 'boolean',
			default: true,
			description: 'Whether to generate PBR material maps (base color, metallic, roughness, normal). Forces Texture on.',
		},
		{
			displayName: 'Quad',
			name: 'quad',
			type: 'boolean',
			default: false,
			description: 'Whether to output a quad mesh instead of triangles (forces FBX output; default face count 10,000)',
		},
		{
			displayName: 'Smart Low Poly',
			name: 'smartLowPoly',
			type: 'boolean',
			default: false,
			description: 'Whether to generate a hand-crafted-style low-poly mesh with clean topology (simple subjects work best)',
		},
		{
			displayName: 'Texture',
			name: 'texture',
			type: 'boolean',
			default: true,
			description: 'Whether to generate texture maps. Off returns bare geometry.',
		},
		{
			displayName: 'Texture Quality',
			name: 'textureQuality',
			type: 'options',
			options: TEXTURE_QUALITY_OPTIONS,
			default: 'standard',
		},
		{
			displayName: 'Texture Seed',
			name: 'textureSeed',
			type: 'number',
			default: 0,
			description: 'Seed for the textures (0 = random). Keep Model Seed fixed and vary this for the same shape with new textures.',
		},
		{
			displayName: 'Texture Version',
			name: 'textureVersion',
			type: 'options',
			options: TEXTURE_VERSION_OPTIONS,
			default: '',
			description: 'Pins the texture model independently of the geometry model',
		},
	];
	if (kind === 'text') {
		options.push(
			{
				displayName: 'Image Seed',
				name: 'imageSeed',
				type: 'number',
				default: 0,
				description: 'Seed for the internal text-to-image stage (0 = random)',
			},
			{
				displayName: 'Negative Prompt',
				name: 'negativePrompt',
				type: 'string',
				default: '',
				description: 'What you do not want in the model, up to 255 characters',
			},
		);
	} else {
		options.push(
			{
				displayName: 'Orientation',
				name: 'orientation',
				type: 'options',
				options: [
					{ name: 'Align to Image', value: 'align_image' },
					{ name: 'Automatic', value: 'default' },
				],
				default: 'default',
				description: 'Whether the model is aligned to the viewpoint of the input image (only with Texture on)',
			},
			{
				displayName: 'Texture Alignment',
				name: 'textureAlignment',
				type: 'options',
				options: [
					{ name: 'Geometry', value: 'geometry' },
					{ name: 'Original Image', value: 'original_image' },
				],
				default: 'original_image',
				description: 'Whether textures follow the input image colours or the generated geometry',
			},
		);
	}
	if (kind === 'image') {
		options.push({
			displayName: 'Enable Image Autofix',
			name: 'enableImageAutofix',
			type: 'boolean',
			default: false,
			description: 'Whether Tripo enhances low-resolution or low-quality input images before generation',
		});
	}
	return alphabetical(options);
}

/** Maps the generation option names to the Tripo request fields. */
export const GENERATION_OPTION_FIELDS: Record<string, string> = {
	autoSize: 'auto_size',
	delight: 'delight',
	enableImageAutofix: 'enable_image_autofix',
	exportOrientation: 'export_orientation',
	exportUv: 'export_uv',
	faceLimit: 'face_limit',
	generateParts: 'generate_parts',
	geometryQuality: 'geometry_quality',
	imageSeed: 'image_seed',
	modelSeed: 'model_seed',
	negativePrompt: 'negative_prompt',
	orientation: 'orientation',
	pbr: 'pbr',
	quad: 'quad',
	smartLowPoly: 'smart_low_poly',
	texture: 'texture',
	textureAlignment: 'texture_alignment',
	textureQuality: 'texture_quality',
	textureSeed: 'texture_seed',
	textureVersion: 'texture_version',
};
