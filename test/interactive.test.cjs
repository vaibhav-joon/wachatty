'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildInteractivePayload,
  interactiveResponseFailure,
} = require('../dist/nodes/WaChatty/interactive.js');

const common = {
  sender: '9117888936041608',
  number: '13473087143|97450001234',
  message: 'Choose an option',
};

test('buttons: quick reply, URL, phone call; no API key in node params', () => {
  const body = buildInteractivePayload('button', common, {
    title: 'Callback request',
    footer: 'WaChatty',
    headerUrl: 'https://example.com/photo.jpg',
    mediaType: 'image',
    buttons: { button: [
      { type: 'quick_reply', displayText: 'Yes please', id: 'cb_yes' },
      { type: 'url', displayText: 'Visit site', url: 'https://wachatty.com' },
      { type: 'call', displayText: 'Call us', phoneNumber: '+97450001234' },
    ] },
  });
  assert.equal(body.type, 'button');
  assert.equal(body.url, 'https://example.com/photo.jpg');
  assert.equal(body.button.length, 3);
  assert.equal(body.button[0].id, 'cb_yes');
  assert.equal(body.button[2].phoneNumber, '+97450001234');
  assert.ok(!('api_key' in body));
});

test('buttons: WhatsApp calls and copy codes', () => {
  const body = buildInteractivePayload('button', common, {
    buttons: [
      { type: 'wa_call', displayText: 'WA call', phoneNumber: '97450001234' },
      { type: 'copy', displayText: 'Copy', copy_code: 'SAVE10' },
    ],
  });
  assert.equal(body.button[0].phoneNumber, '97450001234');
  assert.equal(body.button[1].copy_code, 'SAVE10');
});

test('buttons: reject more than 3 buttons or missing quick-reply id', () => {
  const four = Array.from({ length: 4 }, (_, i) => ({
    type: 'quick_reply', displayText: String(i), id: String(i),
  }));
  assert.throws(() => buildInteractivePayload('button', common, { buttons: four }), /at most 3/i);
  assert.throws(() => buildInteractivePayload('button', common, {
    buttons: [{ type: 'quick_reply', displayText: 'Yes' }],
  }), /\.id is required/);
});

test('list: sections and rows, optional descriptions', () => {
  const body = buildInteractivePayload('list', common, {
    title: 'Our plans', buttontext: 'view',
    sections: JSON.stringify([
      { title: 'Monthly', rows: [
        { rowId: 'basic', title: 'Basic', description: 'For small teams' },
        { rowId: 'pro', title: 'Pro' },
      ] },
    ]),
  });
  assert.equal(body.type, 'list');
  assert.equal(body.list[0].rows[0].rowId, 'basic');
  assert.equal(body.buttontext, 'view');
});

test('carousel: cards with quick-reply and link CTA', () => {
  const body = buildInteractivePayload('carousel', common, {
    title: 'Ignored', footer: 'Ignored',
    cards: [
      { title: 'Basic', body: 'Starter', image: 'https://example.com/basic.jpg',
        buttons: [{ type: 'quick_reply', displayText: 'Choose', id: 'basic' }] },
      { title: 'Pro', body: 'Premium', image: 'https://example.com/pro.jpg',
        buttons: [{ type: 'url', displayText: 'Details', url: 'https://wachatty.com/pro' }] },
    ],
  });
  assert.equal(body.type, 'carousel');
  assert.equal(body.cards.length, 2);
  assert.ok(!('title' in body));
  assert.equal(body.cards[1].buttons[0].type, 'url');
});

test('recipient syntax is validated and carousel image is optional', () => {
  assert.throws(() => buildInteractivePayload('list', { ...common, number: '+13473087143' }, {
    sections: [{ rows: [{ rowId: 'a', title: 'A' }] }],
  }), /digits only/i);
  const payload = buildInteractivePayload('carousel', common, {
    cards: [{ body: 'Without image' }, { body: 'With image', image: 'https://example.com/pic.jpg' }],
  });
  assert.equal(payload.cards.length, 2);
  assert.equal(payload.cards[0].image, undefined);
});

test('n8n native Sections/Items fields become the backend list array', () => {
  const body = buildInteractivePayload('list', common, {
    sections: { section: [
      { title: 'Monthly', items: { item: [
        { title: 'Basic', rowId: 'basic', description: 'Starter' },
        { title: 'Pro', rowId: 'pro' },
      ] } },
    ] },
  });
  assert.deepEqual(body.list, [{
    title: 'Monthly', rows: [
      { rowId: 'basic', title: 'Basic', description: 'Starter' },
      { rowId: 'pro', title: 'Pro' },
    ],
  }]);
});

test('n8n native Cards/Buttons fields serialize correctly', () => {
  const body = buildInteractivePayload('carousel', common, {
    cards: { card: [
      { body: 'Basic plan', buttons: { button: [
        { type: 'quick_reply', displayText: 'Choose Basic', id: 'basic' },
      ] } },
      { body: 'Pro plan', image: 'https://example.com/pro.jpg', buttons: { button: [
        { type: 'url', displayText: 'Details', url: 'https://wachatty.com' },
      ] } },
    ] },
  });
  assert.equal(body.cards[0].buttons[0].id, 'basic');
  assert.equal(body.cards[1].image, 'https://example.com/pro.jpg');
});

test('distinct UI phone fields map to backend phoneNumber', () => {
  const body = buildInteractivePayload('button', common, { buttons: { button: [
    { type: 'call', displayText: 'Call', callNumber: '+97450001234' },
    { type: 'wa_call', displayText: 'WhatsApp', whatsappNumber: '97450001234' },
  ] } });
  assert.equal(body.button[0].phoneNumber, '+97450001234');
  assert.equal(body.button[1].phoneNumber, '97450001234');
});

test('carousel enforces two through ten cards and two buttons per card', () => {
  assert.throws(() => buildInteractivePayload('carousel', common, { cards: [{ body: 'Only one' }] }), /between 2 and 10/);
  assert.throws(() => buildInteractivePayload('carousel', common, {
    cards: [{ body: 'First', buttons: Array.from({ length: 3 }, (_, i) => ({
      type: 'quick_reply', displayText: `Select ${i}`, id: String(i),
    })) }, { body: 'Second' }],
  }), /at most 2/);
});

test('interactive responses: no silent success on missing or empty wa_msg_id', () => {
  assert.match(interactiveResponseFailure({ status: true, wa_msg_id: '' }), /empty wa_msg_id/);
  assert.match(interactiveResponseFailure({ status: true }), /empty wa_msg_id/);
  assert.match(interactiveResponseFailure({ status: false, error: 'Invalid API key' }), /Invalid API key/);
  assert.equal(interactiveResponseFailure({ status: true, wa_msg_id: 'ABC123' }), null);
});
