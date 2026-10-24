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
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'tsk_...',
			description:
				'Create one in the Tripo developer console (developers.tripo3d.com > API Keys). Tasks are billed in credits to the account that owns the key.',
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
			baseURL: 'https://openapi.tripo3d.com/v3',
			url: '/account/balance',
			method: 'GET',
		},
	};
}
