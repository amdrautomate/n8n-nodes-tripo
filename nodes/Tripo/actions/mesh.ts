import { NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';
import { mapOptions, resolveInput, resolveReference, splitList } from '../shared/inputs';
import { compressField, createAndFinish } from './common';

export async function executeMesh(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	switch (operation) {
		case 'segment': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				...mapOptions(options, {
					segmentModel: 'model',
					segmentationGranularity: 'segmentation_granularity',
					splitByConnectivity: 'split_by_connectivity',
				}),
			};
			const ref = String(options.refImage ?? '').trim();
			if (ref) body.ref_image = await resolveReference.call(this, itemIndex, ref, 'reference-image');
			if (body.model !== 'v2.0-20260430') {
				delete body.segmentation_granularity;
				delete body.split_by_connectivity;
				delete body.ref_image;
			}
			return await createAndFinish.call(this, '/mesh/segment', body, itemIndex);
		}

		case 'complete': {
			const body: IDataObject = {
				input: (this.getNodeParameter('segmentTaskId', itemIndex) as string).trim(),
				...mapOptions(options, { completionMode: 'completion_mode' }),
			};
			const partNames = splitList(options.partNames);
			if (partNames.length > 0) body.part_names = partNames;
			return await createAndFinish.call(this, '/mesh/complete', body, itemIndex);
		}

		case 'decimate': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				...mapOptions(options, {
					bake: 'bake',
					decimateModel: 'model',
					faceLimit: 'face_limit',
					quad: 'quad',
					smartUv: 'smart_uv',
				}),
			};
			const partNames = splitList(options.partNames);
			if (partNames.length > 0) body.part_names = partNames;
			if (body.model === 'v1.0') {
				delete body.bake;
				delete body.part_names;
			}
			if (body.smart_uv === false || body.model !== 'v3.0') delete body.smart_uv;
			return await createAndFinish.call(this, '/mesh/decimate', body, itemIndex);
		}

		case 'uv': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				...mapOptions(options, { bake: 'bake', exportOrientation: 'export_orientation' }),
				...compressField(options),
			};
			return await createAndFinish.call(this, '/mesh/uv', body, itemIndex);
		}

		case 'smartSegment': {
			const segType = this.getNodeParameter('segType', itemIndex) as string;
			const body: IDataObject = {
				seg_type: segType,
				input: await resolveInput.call(this, itemIndex, 'segInput', 'Input', true),
				...mapOptions(options, { granularity: 'granularity', hint: 'hint' }),
			};
			if (segType === 'model') {
				const numbers = splitList(options.transform ?? '1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1').map(Number);
				if (numbers.length !== 16 || numbers.some((n) => !Number.isFinite(n))) {
					throw new NodeOperationError(this.getNode(), 'Transform Matrix must be 16 comma-separated numbers', {
						itemIndex,
					});
				}
				body.transform = numbers;
			}
			return await createAndFinish.call(this, '/mesh/smartsegment', body, itemIndex);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown mesh operation "${operation}"`, {
				itemIndex,
			});
	}
}
