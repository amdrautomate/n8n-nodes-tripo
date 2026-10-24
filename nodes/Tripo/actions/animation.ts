import { NodeOperationError, type IDataObject, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';
import { mapOptions, resolveInput, splitList } from '../shared/inputs';
import { createAndFinish } from './common';

export async function executeAnimation(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

	switch (operation) {
		case 'rigCheck': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
			};
			return await createAndFinish.call(this, '/animations/rig-check', body, itemIndex, 300);
		}

		case 'rig': {
			const body: IDataObject = {
				input: await resolveInput.call(this, itemIndex, 'model', 'Model', true),
				...mapOptions(options, {
					outFormat: 'out_format',
					rigModel: 'model',
					rigType: 'rig_type',
					spec: 'spec',
				}),
			};
			return await createAndFinish.call(this, '/animations/rig', body, itemIndex);
		}

		case 'retarget': {
			const animations = splitList(this.getNodeParameter('animations', itemIndex));
			if (animations.length === 0) {
				throw new NodeOperationError(this.getNode(), 'Enter at least one animation preset', { itemIndex });
			}
			if (animations.length > 5) {
				throw new NodeOperationError(this.getNode(), 'Tripo retargets at most five animations per task', {
					itemIndex,
				});
			}
			const body: IDataObject = {
				input: (this.getNodeParameter('riggedTaskId', itemIndex) as string).trim(),
				...mapOptions(options, {
					animateInPlace: 'animate_in_place',
					exportWithGeometry: 'export_with_geometry',
					outFormat: 'out_format',
				}),
			};
			if (animations.length === 1) body.animation = animations[0];
			else body.animations = animations;
			return await createAndFinish.call(this, '/animations/retarget', body, itemIndex);
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown animation operation "${operation}"`, {
				itemIndex,
			});
	}
}
