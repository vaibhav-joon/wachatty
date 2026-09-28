import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from 'n8n-workflow';

import {
  NodeApiError,
  NodeConnectionTypes,
  NodeOperationError,
} from 'n8n-workflow';

import { buildInteractivePayload, interactiveResponseFailure } from './interactive';

export class Waghl implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WAGHL',
    name: 'waghl',
    icon: 'file:../../icons/waghl.svg',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Send WhatsApp messages through the WAGHL API',
    defaults: {
      name: 'WAGHL',
    },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'waghlApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [{ name: 'WhatsApp', value: 'whatsapp' }],
        default: 'whatsapp',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
  {
    name: 'Send Document',
    value: 'sendDocument',
    action: 'Send a document',
  },
  {
    name: 'Send Interactive Buttons',
    value: 'sendInteractiveButtons',
    action: 'Send interactive buttons',
  },
  {
    name: 'Send Interactive Carousel',
    value: 'sendInteractiveCarousel',
    action: 'Send an interactive carousel',
  },
  {
    name: 'Send Interactive List',
    value: 'sendInteractiveList',
    action: 'Send an interactive list',
  },
  {
    name: 'Send Media',
    value: 'sendMedia',
    action: 'Send media',
  },
  {
    name: 'Send Text Message',
    value: 'sendText',
    action: 'Send a text message',
  },
],
        default: 'sendText',
      },
      {
        displayName: 'Sender',
        name: 'sender',
        type: 'string',
        default: '',
        required: true,
        placeholder: '+919876543210',
        description: 'WhatsApp sender number connected to WAGHL',
      },
      {
        displayName: 'Recipient',
        name: 'number',
        type: 'string',
        default: '',
        required: true,
        placeholder: '+14155552671',
        description: 'Recipient WhatsApp number',
      },
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['sendText'] },
        },
      },
      {
        displayName: 'Media Type',
        name: 'mediaType',
        type: 'options',
        options: [
          { name: 'Image', value: 'image' },
          { name: 'Video', value: 'video' },
          { name: 'Audio', value: 'audio' },
        ],
        default: 'image',
        required: true,
        displayOptions: {
          show: { operation: ['sendMedia'] },
        },
      },
      {
        displayName: 'Media URL',
        name: 'mediaUrl',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com/file.jpg',
        displayOptions: {
          show: { operation: ['sendMedia'] },
        },
      },
      {
        displayName: 'Caption',
        name: 'mediaCaption',
        type: 'string',
        default: '',
        displayOptions: {
          show: { operation: ['sendMedia'] },
        },
      },
      {
        displayName: 'Send as Voice Note',
        name: 'ptt',
        type: 'boolean',
        default: true,
        description: 'Whether to send audio as a push-to-talk voice note',
        displayOptions: {
          show: {
            operation: ['sendMedia'],
            mediaType: ['audio'],
          },
        },
      },
      {
        displayName: 'Document URL',
        name: 'documentUrl',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://example.com/file.pdf',
        displayOptions: {
          show: { operation: ['sendDocument'] },
        },
      },
      {
        displayName: 'Caption',
        name: 'documentCaption',
        type: 'string',
        default: '',
        displayOptions: {
          show: { operation: ['sendDocument'] },
        },
      },
      // --- Interactive messages: all use POST /send-interactive ---
      {
        displayName: 'Message',
        name: 'interactiveMessage',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        description: 'Main message. For a carousel, this is the text before the cards.',
        displayOptions: {
          show: { operation: ['sendInteractiveButtons', 'sendInteractiveList', 'sendInteractiveCarousel'] },
        },
      },
      {
        displayName: 'Title',
        name: 'interactiveTitle',
        type: 'string',
        default: '',
        description: 'Optional header text',
        displayOptions: { show: { operation: ['sendInteractiveButtons', 'sendInteractiveList'] } },
      },
      {
        displayName: 'Footer',
        name: 'interactiveFooter',
        type: 'string',
        default: '',
        description: 'Optional footer text',
        displayOptions: { show: { operation: ['sendInteractiveButtons', 'sendInteractiveList'] } },
      },
      {
        displayName: 'Header Media URL',
        name: 'interactiveHeaderUrl',
        type: 'string',
        default: '',
        description: 'Optional image or document URL for an interactive button message',
        displayOptions: { show: { operation: ['sendInteractiveButtons'] } },
      },
      {
        displayName: 'Header Media Type',
        name: 'interactiveMediaType',
        type: 'options',
        options: [
          { name: 'Image', value: 'image' },
          { name: 'Document', value: 'document' },
        ],
        default: 'image',
        description: 'Applies only when a header media URL is provided',
        displayOptions: { show: { operation: ['sendInteractiveButtons'] } },
      },
      {
        displayName: 'Document Filename',
        name: 'interactiveFilename',
        type: 'string',
        default: '',
        description: 'Optional filename when the header media type is Document',
        displayOptions: {
          show: { operation: ['sendInteractiveButtons'], interactiveMediaType: ['document'] },
        },
      },
      {
        displayName: 'Buttons',
        name: 'interactiveButtons',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        required: true,
        description: 'Add up to three buttons. Only fill in the field relevant to each button type.',
        displayOptions: { show: { operation: ['sendInteractiveButtons'] } },
        options: [
          {
            name: 'button',
            displayName: 'Button',
            values: [
											{
												displayName: 'Button Label',
												name: 'displayText',
												type: 'string',
												default: '',
													required:	true,
											},
											{
												displayName: 'Button Type',
												name: 'type',
												type: 'options',
												options: [
  { name: 'Copy Code', value: 'copy' },
  { name: 'Phone Call', value: 'call' },
  { name: 'Quick Reply', value: 'quick_reply' },
  { name: 'Website URL', value: 'url' },
  { name: 'WhatsApp Call', value: 'wa_call' },
],
												default: 'quick_reply',
											},
											{
												displayName: 'Code to Copy',
												name: 'copy_code',
												type: 'string',
												default: '',
												description: 'Required for copy-code buttons',
											},
											{
												displayName: 'Phone Number',
												name: 'phoneNumber',
												type: 'string',
												default: '',
												description: 'For call:	+countrycode... For WhatsApp call:	digits only.',
											},
											{
												displayName: 'Reply ID',
												name: 'id',
												type: 'string',
												default: '',
												description: 'Required for quick replies',
											},
											{
												displayName: 'URL',
												name: 'url',
												type: 'string',
												default: '',
												description: 'Required for website URL buttons',
											},
									],
          },
        ],
      },
      {
        displayName: 'List Button Text',
        name: 'interactiveButtonText',
        type: 'string',
        default: 'view',
        description: 'Label opening the list. Backend notes recommend one lowercase word.',
        displayOptions: { show: { operation: ['sendInteractiveList'] } },
      },
      {
        displayName: 'List Sections (JSON)',
        name: 'interactiveListJson',
        type: 'json',
        typeOptions: { rows: 12 },
        default: '[{"title":"Monthly","rows":[{"rowId":"basic","title":"Basic","description":"For small teams"},{"rowId":"pro","title":"Pro"}]}]',
        required: true,
        description: 'JSON array of sections, each with an array of rows containing rowId, title and optional description',
        displayOptions: { show: { operation: ['sendInteractiveList'] } },
      },
      {
        displayName: 'Carousel Cards (JSON)',
        name: 'interactiveCardsJson',
        type: 'json',
        typeOptions: { rows: 12 },
        default: '[{"title":"Basic","body":"Starter plan","image":"https://example.com/basic.jpg","buttons":[{"type":"quick_reply","displayText":"Choose Basic","id":"basic"}]}]',
        required: true,
        description: 'JSON array of cards. Each requires body and image; title and buttons are optional.',
        displayOptions: { show: { operation: ['sendInteractiveCarousel'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('waghlApi');

const baseUrl = String(credentials.baseUrl ?? '').trim().replace(/\/+$/, '');

if (!baseUrl) {
  throw new NodeOperationError(this.getNode(), 'WAGHL Base URL is missing');
}
    if (!baseUrl) {
      throw new NodeOperationError(this.getNode(), 'WAGHL Base URL is missing');
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const sender = String(this.getNodeParameter('sender', itemIndex, '')).trim();
        const number = String(this.getNodeParameter('number', itemIndex, '')).trim();

        if (!sender) {
          throw new NodeOperationError(this.getNode(), 'Sender cannot be empty', { itemIndex });
        }
        if (!number) {
          throw new NodeOperationError(this.getNode(), 'Recipient cannot be empty', { itemIndex });
        }

        let endpoint: string;
        let body: IDataObject;

        if (operation === 'sendText') {
          const message = String(this.getNodeParameter('message', itemIndex, ''));
          if (!message.trim()) {
            throw new NodeOperationError(this.getNode(), 'Message cannot be empty', { itemIndex });
          }
          endpoint = '/send-message';
          body = { sender, number, message };
        } else if (operation === 'sendMedia') {
          const mediaType = this.getNodeParameter('mediaType', itemIndex) as string;
          const url = String(this.getNodeParameter('mediaUrl', itemIndex, '')).trim();
          const caption = String(this.getNodeParameter('mediaCaption', itemIndex, ''));

          if (!url) {
            throw new NodeOperationError(this.getNode(), 'Media URL cannot be empty', { itemIndex });
          }

          endpoint = '/send-media';
          body = { sender, number, media_type: mediaType, url };

          if (caption) body.caption = caption;
          if (mediaType === 'audio') {
            body.ptt = this.getNodeParameter('ptt', itemIndex, true) as boolean;
          }
        } else if (operation === 'sendDocument') {
          const url = String(this.getNodeParameter('documentUrl', itemIndex, '')).trim();
          const caption = String(this.getNodeParameter('documentCaption', itemIndex, ''));

          if (!url) {
            throw new NodeOperationError(this.getNode(), 'Document URL cannot be empty', { itemIndex });
          }

          endpoint = '/send-document';
          body = { sender, number, media_type: 'document', url };
          if (caption) body.caption = caption;
        } else if (
          operation === 'sendInteractiveButtons' ||
          operation === 'sendInteractiveList' ||
          operation === 'sendInteractiveCarousel'
        ) {
          const kind =
            operation === 'sendInteractiveButtons'
              ? 'button'
              : operation === 'sendInteractiveList'
                ? 'list'
                : 'carousel';
          endpoint = '/send-interactive';
          try {
            body = buildInteractivePayload(
              kind,
              {
                sender,
                number,
                message: String(this.getNodeParameter('interactiveMessage', itemIndex, '')),
              },
              {
                title: String(this.getNodeParameter('interactiveTitle', itemIndex, '')),
                footer: String(this.getNodeParameter('interactiveFooter', itemIndex, '')),
                headerUrl: kind === 'button'
                  ? String(this.getNodeParameter('interactiveHeaderUrl', itemIndex, ''))
                  : undefined,
                mediaType: kind === 'button'
                  ? String(this.getNodeParameter('interactiveMediaType', itemIndex, 'image'))
                  : undefined,
                filename: kind === 'button'
                  ? String(this.getNodeParameter('interactiveFilename', itemIndex, ''))
                  : undefined,
                buttons: kind === 'button'
                  ? this.getNodeParameter('interactiveButtons', itemIndex, {})
                  : undefined,
                buttontext: kind === 'list'
                  ? String(this.getNodeParameter('interactiveButtonText', itemIndex, ''))
                  : undefined,
                sections: kind === 'list'
                  ? this.getNodeParameter('interactiveListJson', itemIndex, '[]')
                  : undefined,
                cards: kind === 'carousel'
                  ? this.getNodeParameter('interactiveCardsJson', itemIndex, '[]')
                  : undefined,
              },
            ) as unknown as IDataObject;
          } catch (validationError) {
            throw new NodeOperationError(
              this.getNode(),
              validationError instanceof Error ? validationError.message : 'Invalid interactive payload',
              { itemIndex },
            );
          }
        } else {
          throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, {
            itemIndex,
          });
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(
  this,
  'waghlApi',
  {
    method: 'POST',
    url: `${baseUrl}${endpoint}`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body,
    json: true,
  },
);
        
        const responseJson: IDataObject =
          response !== null && typeof response === 'object'
            ? (response as IDataObject)
            : { data: response as string | number | boolean };

        if (
          operation === 'sendInteractiveButtons' ||
          operation === 'sendInteractiveList' ||
          operation === 'sendInteractiveCarousel'
        ) {
          const failure = interactiveResponseFailure(responseJson);
          if (failure) {
            throw new NodeOperationError(this.getNode(), failure, { itemIndex });
          }
        }

        returnData.push({
          json: responseJson,
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : 'Unknown WAGHL API error',
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (error instanceof NodeOperationError) {
  throw new NodeOperationError(this.getNode(), error.message, {
    itemIndex,
  });
}

throw new NodeApiError(this.getNode(), error as JsonObject, {
  itemIndex,
});
      }
    }

    return [returnData];
  }
}
