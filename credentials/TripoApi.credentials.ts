import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TripoApi implements ICredentialType {
	name = 'tripoApi';

	displayName = 'Tripo API';

	icon: Icon = { light: 'file:../icons/tripo.svg', dark: 'file:../icons/tripo.dark.svg' };

	documentationUrl = 'https://github.com/amdrautomate/n8n-nodes-tripo#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Region',
			name: 'region',
			type: 'options',
			options: [
				{
					name: 'International (developers.tripo3d.ai)',
					value: 'international',
					description: 'Accounts created on developers.tripo3d.ai (card billing); API host openapi.tripo3d.ai',
				},
				{
					name: 'China Mainland (developers.tripo3d.com)',
					value: 'china',
					description: 'Accounts created on developers.tripo3d.com; API host openapi.tripo3d.com',
				},
			],
			default: 'international',
			description: 'The Tripo site where the account was created. Keys only work on their own region.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'tsk_...',
			description:
				'Create one in the Tripo developer console under API Keys (developers.tripo3d.ai or developers.tripo3d.com, matching the Region). Tasks are billed in credits to the account that owns the key.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.region === "china" ? "https://openapi.tripo3d.com/v3" : "https://openapi.tripo3d.ai/v3"}}',
			url: '/account/balance',
			method: 'GET',
		},
	};
}
