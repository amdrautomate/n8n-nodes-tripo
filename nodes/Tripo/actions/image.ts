import { NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';
import { mapOptions, resolveInput, resolveReference, splitList } from '../shared/inputs';
import { createAndFinish } from './common';

const IMAGE_OPTION_FIELDS: Record<string, string> = {
	aspectRatio: 'aspect_ratio',
	background: 'background',
	outputFormat: 'output_format',
	quality: 'quality',
	size: 'size',
	template: 'template',
	watermark: 'watermark',
};

/** Only the models that accept each option; the others reject or ignore it. */
function imageBody(model: string, options: IDataObject): IDataObject {
	const body = mapOptions(options, IMAGE_OPTION_FIELDS);
	const isBanana = model.startsWith('banana');
	const isChatQuality = ['chat_image_2', 'chat_image_2.5_flare', 'chat_image_2.5_sunburst'].includes(model);
	if (!isBanana) delete body.aspect_ratio;
	if (!isChatQuality) delete body.quality;
	if (!model.startsWith('chat_image_2.5')) delete body.background;
	if (!model.startsWith('seedream')) delete body.watermark;
	if (body.watermark === false) delete body.watermark;
	return body;
}

export async function executeImage(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	switch (operation) {
		case 'textToImage': {
			const model = this.getNodeParameter('model', itemIndex) as string;
			const body: IDataObject = {
				prompt: (this.getNodeParameter('prompt', itemIndex) as string).trim(),
				model,
				...imageBody(model, options),
			};
			return await createAndFinish.call(this, '/generation/text-to-image', body, itemIndex, 300);
		}

		case 'imageToImage': {
			const model = this.getNodeParameter('model', itemIndex) as string;
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'image', 'Image', true),
				model,
				...imageBody(model, options),
			};
			const prompt = (this.getNodeParameter('prompt', itemIndex, '') as string).trim();
			if (prompt) body.prompt = prompt;
			if (!prompt && !body.template) {
				throw new NodeOperationError(this.getNode(), 'Enter a Prompt or choose a Template', { itemIndex });
			}
			const extra = splitList(this.getNodeParameter('additionalImages', itemIndex, ''));
			if (extra.length > 0) {
				const refs: string[] = [];
				for (let index = 0; index < extra.length; index++) {
					refs.push(await resolveReference.call(this, itemIndex, extra[index], `reference-${index + 2}`));
				}
				body.inputs = refs;
			}
			return await createAndFinish.call(this, '/generation/image-to-image', body, itemIndex, 300);
		}

		case 'imageToMultiview': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'image', 'Image', true),
			};
			return await createAndFinish.call(this, '/generation/image-to-multiview', body, itemIndex, 300);
		}

		case 'editMultiview': {
			const ui = this.getNodeParameter('editsUi', itemIndex, {}) as {
				edit?: Array<{ prompt?: string; view?: string }>;
			};
			const prompts = (ui.edit ?? [])
				.filter((edit) => (edit.prompt ?? '').trim())
				.map((edit) => ({ prompt: (edit.prompt ?? '').trim(), view: edit.view ?? 'front' }));
			if (prompts.length === 0) {
				throw new NodeOperationError(this.getNode(), 'Add at least one edit', { itemIndex });
			}
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'multiview', 'Multiview Image', true),
				prompts,
			};
			return await createAndFinish.call(this, '/generation/edit-multiview', body, itemIndex, 300);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown image operation "${operation}"`, {
				itemIndex,
			});
	}
}
