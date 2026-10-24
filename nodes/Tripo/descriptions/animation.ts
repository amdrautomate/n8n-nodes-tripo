import type { INodeProperties } from 'n8n-workflow';
import { additionalJson, alphabetical, inputGroup, outputOptions, waitProperties } from './shared';

const resource = ['animation'];
const show = (operation: string[]) => ({ resource, operation });

const RIG_TYPE_OPTIONS = [
	{ name: 'Aquatic (Fish)', value: 'aquatic' },
	{ name: 'Avian (Bird, Winged)', value: 'avian' },
	{ name: 'Biped (Humanoid)', value: 'biped' },
	{ name: 'Hexapod (Six Legs)', value: 'hexapod' },
	{ name: 'Octopod (Eight Legs)', value: 'octopod' },
	{ name: 'Others', value: 'others' },
	{ name: 'Quadruped (Four Legs)', value: 'quadruped' },
	{ name: 'Serpentine (Snake)', value: 'serpentine' },
];

export const animationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource } },
		options: [
			{
				name: 'Retarget',
				value: 'retarget',
				action: 'Apply preset animations to a rigged model',
				description: 'Apply up to five preset animations (idle, walk, run, ...) to a rigged model',
			},
			{
				name: 'Rig',
				value: 'rig',
				action: 'Rig a model',
				description: 'Add a skeleton to a model automatically (run Rig Check first)',
			},
			{
				name: 'Rig Check',
				value: 'rigCheck',
				action: 'Check whether a model can be rigged',
				description: 'Check whether a model can be rigged and which rig type fits it',
			},
		],
		default: 'rigCheck',
	},

	...inputGroup({
		name: 'model',
		displayName: 'Model',
		description: 'The model to check or rig',
		required: true,
		show: show(['rigCheck', 'rig']),
		kinds: ['taskId', 'binary', 'url', 'fileToken'],
		what: '3D model (GLB, FBX, OBJ or STL, max 150 MB)',
	}),

	// -------------------------------------------------------------------- rig
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['rig']) },
		options: alphabetical([
			{
				displayName: 'Output Format',
				name: 'outFormat',
				type: 'options',
				options: [
					{ name: 'FBX', value: 'fbx' },
					{ name: 'GLB', value: 'glb' },
				],
				default: 'glb',
			},
			{
				displayName: 'Rig Type',
				name: 'rigType',
				type: 'options',
				options: RIG_TYPE_OPTIONS,
				default: 'biped',
				description: 'Use the rig type returned by Rig Check',
			},
			{
				displayName: 'Rigging Model',
				name: 'rigModel',
				type: 'options',
				options: [
					{ name: 'v1.0-20240301 (Biped Only, 90+ Presets, Default)', value: 'v1.0-20240301' },
					{ name: 'v2.5-20260210 (Creatures: Quadruped, Avian, ...)', value: 'v2.5-20260210' },
					{ name: 'v3.0-20260909 (Best Humanoid, All Rig Types)', value: 'v3.0-20260909' },
				],
				default: 'v1.0-20240301',
			},
			{
				displayName: 'Skeleton Spec',
				name: 'spec',
				type: 'options',
				options: [
					{ name: 'ActorCore', value: 'actorcore' },
					{ name: 'Mixamo', value: 'mixamo' },
					{ name: 'Tripo', value: 'tripo' },
					{ name: 'Unity Humanoid', value: 'unity' },
					{ name: 'Unreal Mannequin', value: 'unreal' },
					{ name: 'VRM 1.0', value: 'vrm' },
				],
				default: 'tripo',
				description: 'Bone naming convention (biped only)',
			},
		]),
	},

	// --------------------------------------------------------------- retarget
	{
		displayName: 'Rigged Model Task ID',
		name: 'riggedTaskId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. task_abc123',
		description: 'The ID of the Rig task that produced the skeleton',
		displayOptions: { show: show(['retarget']) },
	},
	{
		displayName: 'Animations',
		name: 'animations',
		type: 'string',
		default: 'preset:idle',
		required: true,
		placeholder: 'e.g. preset:idle, preset:walk, preset:run',
		description:
			'Comma-separated preset IDs, up to five. Rig v2.5/v3.0: preset:idle, walk, run, dive, climb, jump, slash, shoot, hurt, fall, turn; preset:quadruped:walk, preset:hexapod:walk, preset:octopod:walk, preset:serpentine:march, preset:aquatic:march. Rig v1.0 bipeds use preset:biped:* names (90+).',
		displayOptions: { show: show(['retarget']) },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: show(['retarget']) },
		options: alphabetical([
			{
				displayName: 'Animate in Place',
				name: 'animateInPlace',
				type: 'boolean',
				default: false,
				description: 'Whether the animation plays in place without root displacement',
			},
			{
				displayName: 'Export With Geometry',
				name: 'exportWithGeometry',
				type: 'boolean',
				default: true,
				description: 'Whether the output includes the mesh, not only the animated skeleton',
			},
			{
				displayName: 'Output Format',
				name: 'outFormat',
				type: 'options',
				options: [
					{ name: 'FBX', value: 'fbx' },
					{ name: 'GLB', value: 'glb' },
				],
				default: 'glb',
			},
		]),
	},

	...waitProperties(show(['rigCheck', 'rig', 'retarget']), true, 600),
	outputOptions(show(['rigCheck', 'rig', 'retarget'])),
	additionalJson(show(['rigCheck', 'rig', 'retarget'])),
];
