import { NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';
import { GENERATION_OPTION_FIELDS } from '../descriptions/shared';
import { mapOptions, resolveInput, resolveReference, splitList } from '../shared/inputs';
import { compressField, createAndFinish } from './common';

/** Builds the view-key array Tripo takes for multiview inputs and texture references. */
async function viewImages(
	this: IExecuteFunctions,
	itemIndex: number,
	minimum: number,
): Promise<IDataObject[]> {
	const views: IDataObject[] = [];
	for (const view of ['front', 'left', 'back', 'right']) {
		const value = (this.getNodeParameter(`${view}View`, itemIndex, '') as string).trim();
		if (!value) continue;
		views.push({ [view]: await resolveReference.call(this, itemIndex, value, `${view}-view`) });
	}
	if (!views.some((v) => v.front)) {
		throw new NodeOperationError(this.getNode(), 'The front view is required', { itemIndex });
	}
	if (views.length < minimum) {
		throw new NodeOperationError(this.getNode(), `At least ${minimum} views are required`, { itemIndex });
	}
	return views;
}

function generationBody(options: IDataObject): IDataObject {
	return { ...mapOptions(options, GENERATION_OPTION_FIELDS), ...compressField(options) };
}

export async function executeModel(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	switch (operation) {
		case 'textToModel': {
			const body: IDataObject = {
				prompt: (this.getNodeParameter('prompt', itemIndex) as string).trim(),
				model: this.getNodeParameter('model', itemIndex) as string,
				...generationBody(options),
			};
			return await createAndFinish.call(this, '/generation/text-to-model', body, itemIndex);
		}

		case 'imageToModel': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'image', 'Image', true),
				model: this.getNodeParameter('model', itemIndex) as string,
				...generationBody(options),
			};
			return await createAndFinish.call(this, '/generation/image-to-model', body, itemIndex);
		}

		case 'multiviewToModel': {
			const source = this.getNodeParameter('viewsSource', itemIndex) as string;
			const inputs =
				source === 'taskId'
					? [{ task_id: (this.getNodeParameter('multiviewTaskId', itemIndex) as string).trim() }]
					: await viewImages.call(this, itemIndex, 2);
			const body: IDataObject = {
				inputs,
				model: this.getNodeParameter('model', itemIndex) as string,
				...generationBody(options),
			};
			return await createAndFinish.call(this, '/generation/multiview-to-model', body, itemIndex);
		}

		case 'imageToSplat': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'image', 'Image', true),
				...mapOptions(options, { modelSeed: 'model_seed' }),
			};
			return await createAndFinish.call(this, '/generation/image-to-splat', body, itemIndex);
		}

		case 'texture': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				...mapOptions(options, {
					bake: 'bake',
					delight: 'delight',
					pbr: 'pbr',
					textureAlignment: 'texture_alignment',
					textureModel: 'model',
					textureQuality: 'texture_quality',
					textureSeed: 'texture_seed',
				}),
				...compressField(options),
			};
			const partNames = splitList(options.partNames);
			if (partNames.length > 0) body.part_names = partNames;

			const guidance = this.getNodeParameter('textureGuidance', itemIndex, 'none') as string;
			if (guidance === 'text') {
				const prompt: IDataObject = { text: (this.getNodeParameter('texturePrompt', itemIndex) as string).trim() };
				const style = (this.getNodeParameter('styleImage', itemIndex, '') as string).trim();
				if (style) {
					const ref = await resolveReference.call(this, itemIndex, style, 'style-image');
					prompt.style_image = /^https?:\/\//i.test(ref) ? { url: ref } : { file_token: ref };
				}
				body.texture_prompt = prompt;
			} else if (guidance === 'image') {
				const ref = (this.getNodeParameter('referenceImage', itemIndex) as string).trim();
				body.texture_prompt = { image: await resolveReference.call(this, itemIndex, ref, 'reference-image') };
			} else if (guidance === 'images') {
				body.texture_prompt = { images: await viewImages.call(this, itemIndex, 2) };
			}
			return await createAndFinish.call(this, '/models/texture', body, itemIndex);
		}

		case 'convert': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				format: this.getNodeParameter('format', itemIndex) as string,
				...mapOptions(options, {
					animateInPlace: 'animate_in_place',
					bake: 'bake',
					exportOrientation: 'export_orientation',
					exportVertexColors: 'export_vertex_colors',
					faceLimit: 'face_limit',
					fbxPreset: 'fbx_preset',
					flattenBottom: 'flatten_bottom',
					flattenBottomThreshold: 'flatten_bottom_threshold',
					forceSymmetry: 'force_symmetry',
					packUv: 'pack_uv',
					pivotToCenterBottom: 'pivot_to_center_bottom',
					quad: 'quad',
					scaleFactor: 'scale_factor',
					textureFormat: 'texture_format',
					textureSize: 'texture_size',
					withAnimation: 'with_animation',
				}),
			};
			const partNames = splitList(options.partNames);
			if (partNames.length > 0) body.part_names = partNames;
			return await createAndFinish.call(this, '/models/convert', body, itemIndex, 300);
		}

		case 'import': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model File', true),
			};
			return await createAndFinish.call(this, '/models/import', body, itemIndex, 300);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown model operation "${operation}"`, {
				itemIndex,
			});
	}
}
