# WAGHL n8n: interactive messaging extension

This is an **add-on for your CURRENT GitHub repository**, not a replacement repository.
It adds three native WhatsApp operations to `nodes/Waghl/Waghl.node.ts` and keeps all
existing text/media/document operations, credentials and npm package naming intact.

It was prepared from your API contract and an earlier WAGHL repository snapshot.
The latest GitHub branch was not accessible to this environment. For safety the patch
script checks each insertion point, fails without modifying the node if its layout
has changed, and refuses to patch a node still using manual API-key HTTP requests.

## Install into your existing Codespace

1. Download `waghl-interactive-addon.zip` from this conversation.
2. Open `https://github.com/vaibhav-joon/waghl` → Code → Codespaces → your Codespace.
3. Upload the ZIP to the root of your checkout (`/workspaces/waghl`).
4. In the Codespace terminal:

   ```bash
   cd /workspaces/waghl
   unzip -o waghl-interactive-addon.zip
   node add-interactive.mjs
   npm install --package-lock-only
   npm ci
   npm test
   npm pack --dry-run
   ```

5. Before testing against production users, open `nodes/Waghl/Waghl.node.ts`
   and inspect the generated fields. The new operations are:
   - Send Interactive Buttons
   - Send Interactive List
   - Send Interactive Carousel
6. Run `npm run dev` in your Codespace. Open port 5678 privately through the Ports
   panel. Create a Manual Trigger → WAGHL workflow. Use only your own test number.
7. If tests and end-to-end sends succeed, commit the node/helper/tests/package and
   updated lockfile. Bump the npm version before publishing; never reuse a published
   version number.

The script does **not** rename your npm package: if you have changed the package
name to `n8n-nodes-whatsapp-connector`, it stays that way. It also leaves your
GitHub Actions workflows and existing WAGHL credential test untouched.

## Configuration

- WAGHL API Key: use the existing n8n **WAGHL API** credential. Never enter keys
  in node fields or examples. The existing n8n credential injects `api_key`.
- Interactive endpoint: the node uses the same **Base URL** stored in the existing
  WAGHL API credential as every other operation, and sends interactive requests to
  `{{baseUrl}}/send-interactive`. There is no separate interactive URL field.
- Sender: **device ID**, for example `9117888936041608`, not a phone number.
- Recipient: digits only; multiple recipients are separated using `|`.
- Text, media, document and all three interactive operations use the same configured
  credential Base URL and the same API key. The API key is injected by n8n's credential
  authentication helper and is never exposed as a node parameter.

## User-facing fields

| Operation | UI |
|---|---|
| Interactive Buttons | Message, optional title/footer/header media, up to 3 structured buttons |
| Interactive List | Message, optional title/footer/button text, JSON array of sections/rows |
| Interactive Carousel | Intro message, JSON array of cards |

The nested list and carousel forms use a JSON editor to preserve the exact arrays
under your existing Laravel contract. n8n expressions work in these fields.

### List sections JSON example

```json
[
  {
    "title": "Monthly",
    "rows": [
      { "rowId": "basic", "title": "Basic", "description": "For small teams" },
      { "rowId": "pro", "title": "Pro" }
    ]
  }
]
```

### Carousel cards JSON example

```json
[
  {
    "title": "Basic",
    "body": "Starter plan for small teams",
    "image": "https://www.w3schools.com/html/pic_trulli.jpg",
    "buttons": [{ "type": "quick_reply", "displayText": "Choose Basic", "id": "basic" }]
  },
  {
    "title": "Pro",
    "body": "Full feature set",
    "image": "https://www.w3schools.com/html/pic_trulli.jpg",
    "buttons": [{ "type": "url", "displayText": "See details", "url": "https://waghl.com/pro" }]
  }
]
```

## Validation and response handling

- Sender must be present; recipients must match `digits|digits` (without a `+`).
- Button message: at least one button, maximum three; validates fields for each
  type (`quick_reply`, `url`, `call`, `wa_call`, `copy`).
- List: at least one section, each with rows having `rowId` and `title`.
- Carousel: at least one card; `body` and an HTTP(S) `image` URL required per card.
- The node treats either `status:false` **or** `status:true` plus an empty/missing
  `wa_msg_id` as a failure, even if HTTP status is 200. This check applies only
  to the three new interactive operations.
- `Continue On Fail` in n8n can still turn these into per-item error outputs.

The only interactive combinations reported as fully end-to-end verified by your
backend team are quick replies + URL buttons, list rows and carousel cards with
quick replies/URLs. `call`, `wa_call` and `copy` are implemented and unit tested
locally against the documented request format, but still require one live test
against your API.

## Local tests

`npm test` automatically includes the interactive unit tests if the original
package had the default `npm run lint && npm run build` test script. Otherwise run:

```bash
npm run test:interactive
```

No live calls are made by the included unit tests; use the Codespaces n8n instance
for live sends.

## If the patch reports it cannot find an insertion point

The script makes **no changes** to the original node in that case. Your current
repo has diverged from the older snapshot. Share your latest
`nodes/Waghl/Waghl.node.ts` and I'll provide an exact adjusted patch.
