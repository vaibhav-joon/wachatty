/**
 * WAGHL interactive message request builders.
 * Authentication is deliberately NOT included here: the waghlApi credential
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

function normalizeButtons(raw: unknown, name: string, required: boolean): JsonMap[] {
  // n8n fixedCollection returns { button: [...] } in the configured field.
  const values = isObject(raw) && Array.isArray(raw.button) ? raw.button : raw;
  if (values == null && !required) return [];
  const buttons = parseJsonArray(values, name);
  if (required && buttons.length === 0) {
    throw new Error(`${name} must contain at least one button`);
  }
  if (buttons.length > 3) {
    throw new Error(`${name} allows at most 3 buttons`);
  }

  return buttons.map((rawButton, index) => {
    const path = `${name}[${index}]`;
    if (!isObject(rawButton)) throw new Error(`${path} must be an object`);
    const type = requiredText(rawButton.type, `${path}.type`);
    const displayText = requiredText(rawButton.displayText, `${path}.displayText`);
    const button: JsonMap = { type, displayText };
    switch (type) {
      case 'quick_reply':
        button.id = requiredText(rawButton.id, `${path}.id`);
        break;
      case 'url':
        button.url = requireWebUrl(rawButton.url, `${path}.url`);
        break;
      case 'call': {
        const phone = requiredText(rawButton.phoneNumber, `${path}.phoneNumber`);
        if (!/^\+[0-9]+$/.test(phone)) {
          throw new Error(`${path}.phoneNumber must start with + and contain only digits`);
        }
        button.phoneNumber = phone;
        break;
      }
      case 'wa_call': {
        const phone = requiredText(rawButton.phoneNumber, `${path}.phoneNumber`);
        if (!/^[0-9]+$/.test(phone)) {
          throw new Error(`${path}.phoneNumber must contain digits only`);
        }
        button.phoneNumber = phone;
        break;
      }
      case 'copy':
        button.copy_code = requiredText(rawButton.copy_code, `${path}.copy_code`);
        break;
      default:
        throw new Error(`${path}.type must be quick_reply, url, call, wa_call or copy`);
    }
    return button;
  });
}

function normalizeSections(raw: unknown): JsonMap[] {
  const sections = parseJsonArray(raw, 'List sections');
  if (sections.length === 0) throw new Error('List sections must contain at least one section');
  return sections.map((rawSection, sectionIndex) => {
    const path = `list[${sectionIndex}]`;
    if (!isObject(rawSection)) throw new Error(`${path} must be an object`);
    if (!Array.isArray(rawSection.rows) || rawSection.rows.length === 0) {
      throw new Error(`${path}.rows must contain at least one row`);
    }
    const section: JsonMap = {
      rows: rawSection.rows.map((rawRow, rowIndex) => {
        const rowPath = `${path}.rows[${rowIndex}]`;
        if (!isObject(rawRow)) throw new Error(`${rowPath} must be an object`);
        const row: JsonMap = {
          rowId: requiredText(rawRow.rowId, `${rowPath}.rowId`),
          title: requiredText(rawRow.title, `${rowPath}.title`),
        };
        const description = optionalText(rawRow.description);
        if (description) row.description = description;
        return row;
      }),
    };
    const title = optionalText(rawSection.title);
    if (title) section.title = title;
    return section;
  });
}

function normalizeCards(raw: unknown): JsonMap[] {
  const cards = parseJsonArray(raw, 'Carousel cards');
  if (cards.length === 0) throw new Error('Carousel cards must contain at least one card');
  return cards.map((rawCard, index) => {
    const path = `cards[${index}]`;
    if (!isObject(rawCard)) throw new Error(`${path} must be an object`);
    const card: JsonMap = {
      body: requiredText(rawCard.body, `${path}.body`),
      image: requireWebUrl(rawCard.image, `${path}.image`),
    };
    const title = optionalText(rawCard.title);
    if (title) card.title = title;
    if (rawCard.buttons !== undefined) {
      card.buttons = normalizeButtons(rawCard.buttons, `${path}.buttons`, false);
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
  // api_key is injected by n8n's waghlApi credential, never stored in node params.
  return payload;
}

/** WAGHL may return HTTP 200/status:true even when its Node sender rejected a payload. */
export function interactiveResponseFailure(response: unknown): string | null {
  if (!isObject(response)) return 'Unexpected WAGHL interactive API response';
  if (response.status === false) {
    const error = optionalText(response.error) || optionalText(response.msg);
    return error || 'WAGHL interactive API returned status: false';
  }
  if (response.status !== true) return 'WAGHL interactive API did not confirm success';
  const messageId = response.wa_msg_id;
  const hasMessageId =
    (typeof messageId === 'string' && messageId.trim().length > 0) ||
    (typeof messageId === 'number' && Number.isFinite(messageId)) ||
    (Array.isArray(messageId) && messageId.length > 0) ||
    (isObject(messageId) && Object.keys(messageId).length > 0);
  return hasMessageId
    ? null
    : 'WAGHL reported success but returned an empty wa_msg_id; the message may have been rejected';
}
