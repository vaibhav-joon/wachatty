import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from 'n8n-workflow';

export class WaChattyApi implements ICredentialType {
  name = 'waChattyApi';
  displayName = 'WaChatty API';
  documentationUrl = 'https://wachatty.com';

  icon: Icon = { light: 'file:../icons/wachatty.svg', dark: 'file:../icons/wachatty-dark.svg' };

  properties: INodeProperties[] = [
    {
      displayName:
        'New to WaChatty? <a href="https://wachatty.com" target="_blank">View plans and get started</a>',
      name: 'wachattyPurchaseNotice',
      type: 'notice',
      default: '',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your WaChatty API key',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://custom2.waghl.com',
      required: true,
      description: 'WaChatty API base URL',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      body: {
        api_key: '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/authenticate-apikey',
      method: 'POST',
    },
  };
}
