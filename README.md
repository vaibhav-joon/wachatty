# WaChatty interactive form update

This patch changes **only** `nodes/WaChatty/WaChatty.node.ts` interactive form fields and the normalization functions in `nodes/WaChatty/interactive.ts`. It uses the existing `waChattyApi` credential and `{baseUrl}/send-interactive` endpoint unchanged. It is intended for the already-installed interactive add-on, **not** the initial repo ZIP.


## Get WaChatty

To purchase WaChatty, create an account, or obtain API access, visit [wachatty.com](https://wachatty.com). For product and account questions, contact [info@wachatty.com](mailto:info@wachatty.com).

## Apply safely in the same Codespace

1. Upload `waghl-interactive-ui-patch.zip` to `/workspaces/waghl`.
2. Run:

```bash
cd /workspaces/waghl
unzip -o waghl-interactive-ui-patch.zip
node apply-ui-update.mjs
npm run lint:fix
npm test && npm pack --dry-run
```

The patch creates timestamped `.bak` copies of the two original TypeScript files and the unit-test file, which Git will not include unless you add them explicitly. Do not run `git add .`.

## Form changes

- Buttons: one selector and only the relevant additional field per button type, with 1–3 buttons enforced.
- Lists: native Add Section / Add Item controls, title/optional description/ID per item.
- Carousels: native Add Card / Add Button controls, 2–10 cards and up to two buttons per card; optional image URL in the editor.
- Existing credentials, HTTP helper, endpoint and response validation remain untouched.

**n8n UI limitation:** nested fixedCollection controls and field visibility may vary by n8n version. Inspect the actual dev editor before publishing. If nested fields don't render correctly, use a flat builder or JSON fallback instead of shipping a broken UI.

**API caution:** while the form allows empty card image URLs as requested, your current backend notes say images are effectively required for a proper card. Verify image-free carousel cards on the backend before relying on them.
