/**
 * WaChatty interactive message request builders.
 * Authentication is deliberately NOT included here: the waChattyApi credential
 * injects api_key via n8n's httpRequestWithAuthentication helper.
 */

export type InteractiveKind = 'button' | 'list' | 'carousel';

type JsonMap = Record<string, unknown>;

export interface InteractiveCommon {
  sender: string;
  number: string;
  message: string;
}

export interface InteractiveOptions {
  title?: string;
  footer?: string;
  headerUrl?: string;
  mediaType?: string;
  filename?: string;
  buttontext?: string;
  buttons?: unknown;
  sections?: unknown;
  cards?: unknown;
}

function isObject(value: unknown): value is JsonMap {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireWebUrl(value: unknown, name: string): string {
  const input = requiredText(value, name);
  let parsed: URL | undefined;
  try {
    parsed = new URL(input);
  } catch {
    // Report input-validation errors outside catch; the node wraps them in NodeOperationError.
  }
  if (!parsed) {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must be an HTTP or HTTPS URL`);
  }
  return input;
}

/** Both n8n JSON properties and fixedCollection outputs can feed this builder. */
export function parseJsonArray(value: unknown, name: string): unknown[] {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    let jsonInvalid = false;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      jsonInvalid = true;
    }
    if (jsonInvalid) {
      throw new Error(`${name} must contain valid JSON`);
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON array`);
  }
  return parsed;
}

function normalizeButtons(raw: unknown, name: string, required: boolean, max = 3): JsonMap[] {
  const values = isObject(raw) && Array.isArray(raw.button) ? raw.button : raw;
  if ((values == null || (isObject(values) && Object.keys(values).length === 0)) && !required) return [];
  const buttons = parseJsonArray(values, name);
  if (required && buttons.length === 0) throw new Error(`${name} requires at least one button`);
  if (buttons.length > max) throw new Error(`${name} allows at most ${max} buttons`);
  return buttons.map((entry, index) => {
    const path = `${name}[${index}]`;
    if (!isObject(entry)) throw new Error(`${path} must be an object`);
    const type = requiredText(entry.type, `${path}.type`);
    const displayText = requiredText(entry.displayText, `${path}.displayText`);
    const button: JsonMap = { type, displayText };
    switch (type) {
      case 'quick_reply':
        button.id = requiredText(entry.id, `${path}.id`);
        break;
      case 'url':
        button.url = requireWebUrl(entry.url, `${path}.url`);
        break;
      case 'call': {
        const phone = requiredText(entry.callNumber ?? entry.phoneNumber, `${path}.phoneNumber`);
        if (!/^\+[0-9]+$/.test(phone)) throw new Error(`${path}.phoneNumber must begin with + and contain digits`);
        button.phoneNumber = phone;
        break;
      }
      case 'wa_call': {
        const phone = requiredText(entry.whatsappNumber ?? entry.phoneNumber, `${path}.phoneNumber`);
        if (!/^[0-9]+$/.test(phone)) throw new Error(`${path}.phoneNumber must contain digits only`);
        button.phoneNumber = phone;
        break;
      }
      case 'copy':
        button.copy_code = requiredText(entry.copy_code, `${path}.copy_code`);
        break;
      default:
        throw new Error(`${path}.type must be quick_reply, url, call, wa_call or copy`);
    }
    return button;
  });
}

function normalizeSections(raw: unknown): JsonMap[] {
  const unwrapped = isObject(raw) && Array.isArray(raw.section) ? raw.section : raw;
  const sections = parseJsonArray(unwrapped, 'List sections');
  if (sections.length === 0) throw new Error('List sections must contain at least one section');
  return sections.map((entry, index) => {
    const path = `list[${index}]`;
    if (!isObject(entry)) throw new Error(`${path} must be an object`);
    const nested = entry.items;
    const rowsValue = entry.rows ?? (isObject(nested) ? nested.item : undefined);
    if (!Array.isArray(rowsValue) || rowsValue.length === 0) {
      throw new Error(`${path}.rows must contain at least one item`);
    }
    const rows = rowsValue.map((item, itemIndex) => {
      const rowPath = `${path}.rows[${itemIndex}]`;
      if (!isObject(item)) throw new Error(`${rowPath} must be an object`);
      const row: JsonMap = {
        rowId: requiredText(item.rowId, `${rowPath}.rowId`),
        title: requiredText(item.title, `${rowPath}.title`),
      };
      const description = optionalText(item.description);
      if (description) row.description = description;
      return row;
    });
    const section: JsonMap = { rows };
    const title = optionalText(entry.title);
    if (title) section.title = title;
    return section;
  });
}

function normalizeCards(raw: unknown): JsonMap[] {
  const unwrapped = isObject(raw) && Array.isArray(raw.card) ? raw.card : raw;
  const cards = parseJsonArray(unwrapped, 'Carousel cards');
  if (cards.length < 2 || cards.length > 10) {
    throw new Error('Carousel cards require between 2 and 10 cards');
  }
  return cards.map((entry, index) => {
    const path = `cards[${index}]`;
    if (!isObject(entry)) throw new Error(`${path} must be an object`);
    const card: JsonMap = { body: requiredText(entry.body, `${path}.body`) };
    const image = optionalText(entry.image);
    if (image) card.image = requireWebUrl(image, `${path}.image`);
    const title = optionalText(entry.title);
    if (title) card.title = title;
    const nestedButtons = entry.buttons;
    if (nestedButtons !== undefined) {
      const normalized = normalizeButtons(nestedButtons, `${path}.buttons`, false, 2);
      if (normalized.length) card.buttons = normalized;
    }
    return card;
  });
}

export function buildInteractivePayload(
  kind: InteractiveKind,
  common: InteractiveCommon,
  options: InteractiveOptions,
): JsonMap {
  const sender = requiredText(common.sender, 'Sender device ID');
  const number = requiredText(common.number, 'Recipient');
  if (!/^[0-9]+(?:\|[0-9]+)*$/.test(number)) {
    throw new Error('Recipient must contain digits only, with | between multiple numbers');
  }
  const message = requiredText(common.message, 'Message');
  const payload: JsonMap = { sender, number, type: kind, message };

  if (kind === 'button') {
    const title = optionalText(options.title);
    const footer = optionalText(options.footer);
    if (title) payload.title = title;
    if (footer) payload.footer = footer;
    if (options.headerUrl && options.headerUrl.trim()) {
      payload.url = requireWebUrl(options.headerUrl, 'Header media URL');
      const mediaType = optionalText(options.mediaType);
      if (mediaType) payload.media_type = mediaType;
      const filename = optionalText(options.filename);
      if (mediaType === 'document' && filename) payload.filename = filename;
    }
    payload.button = normalizeButtons(options.buttons, 'Buttons', true);
  } else if (kind === 'list') {
    const title = optionalText(options.title);
    const footer = optionalText(options.footer);
    const buttontext = optionalText(options.buttontext);
    if (title) payload.title = title;
    if (footer) payload.footer = footer;
    if (buttontext) payload.buttontext = buttontext;
    payload.list = normalizeSections(options.sections);
  } else if (kind === 'carousel') {
    // Top-level title, footer, and header URL are intentionally ignored for carousel.
    payload.cards = normalizeCards(options.cards);
  } else {
    throw new Error(`Unsupported interactive type: ${String(kind)}`);
  }
  // api_key is injected by n8n's waChattyApi credential, never stored in node params.
  return payload;
}

/** WaChatty may return HTTP 200/status:true even when its Node sender rejected a payload. */
export function interactiveResponseFailure(response: unknown): string | null {
  if (!isObject(response)) return 'Unexpected WaChatty interactive API response';
  if (response.status === false) {
    const error = optionalText(response.error) || optionalText(response.msg);
    return error || 'WaChatty interactive API returned status: false';
  }
  if (response.status !== true) return 'WaChatty interactive API did not confirm success';
  const messageId = response.wa_msg_id;
  const hasMessageId =
    (typeof messageId === 'string' && messageId.trim().length > 0) ||
    (typeof messageId === 'number' && Number.isFinite(messageId)) ||
    (Array.isArray(messageId) && messageId.length > 0) ||
    (isObject(messageId) && Object.keys(messageId).length > 0);
  return hasMessageId
    ? null
    : 'WaChatty reported success but returned an empty wa_msg_id; the message may have been rejected';
}
