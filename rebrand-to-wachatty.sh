#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# WaChatty rebrand script for the n8n community node
# Run from the repository root (/workspaces/waghl)
# ============================================================

BRAND="WaChatty"
PACKAGE_NAME="n8n-nodes-wachatty"
WEBSITE="https://wachatty.com"
PUBLIC_EMAIL="info@wachatty.com"
PURCHASE_URL="https://wachatty.com"
export BRAND PACKAGE_NAME WEBSITE PUBLIC_EMAIL PURCHASE_URL

# IMPORTANT: We intentionally DO NOT change the actual API Base URL/default.
# Existing customer-configurable Base URL behavior stays exactly as-is.

if [[ ! -f package.json ]]; then
  echo "ERROR: package.json not found. Run this script from the repository root."
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "ERROR: .git not found. Run this inside your Git repository."
  exit 1
fi

# Avoid mixing the rebrand with uncommitted tracked code changes.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ERROR: You have uncommitted tracked changes."
  echo "Commit your working node first, then run this script again."
  git status --short
  exit 1
fi

START_COMMIT="$(git rev-parse HEAD)"
echo "Starting from commit: $START_COMMIT"
echo "Rebranding to $BRAND ($PACKAGE_NAME)"

# ---------- Rename source files/folders ----------
if [[ -f credentials/WaghlApi.credentials.ts ]]; then
  git mv credentials/WaghlApi.credentials.ts credentials/WaChattyApi.credentials.ts
fi

if [[ -d nodes/Waghl && ! -d nodes/WaChatty ]]; then
  git mv nodes/Waghl nodes/WaChatty
fi

if [[ -f nodes/WaChatty/Waghl.node.ts ]]; then
  git mv nodes/WaChatty/Waghl.node.ts nodes/WaChatty/WaChatty.node.ts
fi

if [[ -f icons/waghl.svg ]]; then
  git mv icons/waghl.svg icons/wachatty.svg
fi

# ---------- Update text/code references safely ----------
# We intentionally do NOT globally replace lowercase "waghl", because that
# could accidentally change a working API hostname such as custom2.waghl.com.
python3 <<'PY'
from pathlib import Path
import os

BRAND=os.environ['BRAND']; PACKAGE_NAME=os.environ['PACKAGE_NAME']; WEBSITE=os.environ['WEBSITE']; PUBLIC_EMAIL=os.environ['PUBLIC_EMAIL']
root = Path('.')
skip_dirs = {'.git', 'node_modules', 'dist'}
allowed = {'.ts', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml'}

replacements = [
    ('n8n-nodes-waghl.waghl', f'{PACKAGE_NAME}.waChatty'),
    ('@waghl/n8n-nodes-waghl', f'@wachatty/{PACKAGE_NAME}'),
    ('n8n-nodes-waghl', PACKAGE_NAME),
    ('WaghlApi', 'WaChattyApi'),
    ('waghlApi', 'waChattyApi'),
    ('Waghl', 'WaChatty'),
    ('WAGHL', 'WaChatty'),
    ('waghl.svg', 'wachatty.svg'),
    ('info@waghl.com', PUBLIC_EMAIL),
    ('https://waghl.com/help/', WEBSITE),
    ('https://waghl.com/help', WEBSITE),
    ('https://waghl.com/', WEBSITE.rstrip('/') + '/'),
    ('https://waghl.com', WEBSITE),
]

for path in root.rglob('*'):
    if not path.is_file() or path.suffix.lower() not in allowed:
        continue
    if any(part in skip_dirs for part in path.parts):
        continue
    # Do not edit generated backup/helper snapshots.
    if '.bak' in path.name:
        continue
    try:
        old = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    new = old
    for a, b in replacements:
        new = new.replace(a, b)
    if new != old:
        path.write_text(new, encoding='utf-8')
PY

# ---------- Make package.json authoritative ----------
node <<'NODE'
const fs = require('fs');
const PACKAGE_NAME = process.env.PACKAGE_NAME;
const WEBSITE = process.env.WEBSITE;
const PUBLIC_EMAIL = process.env.PUBLIC_EMAIL;
const BRAND = process.env.BRAND;
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));

p.name = PACKAGE_NAME;
// Use 1.0.1 because this repository already used the v1.0.0 Git tag for the old package.
p.version = '1.0.1';
p.description = `n8n community node for sending WhatsApp messages through the ${BRAND} API`;
p.license = 'MIT';

const keywords = new Set(Array.isArray(p.keywords) ? p.keywords : []);
keywords.delete('waghl');
keywords.add('wachatty');
keywords.add('whatsapp');
keywords.add('n8n-community-node-package');
p.keywords = [...keywords];

p.author = {
  name: BRAND,
  email: PUBLIC_EMAIL,
  url: WEBSITE
};
p.homepage = WEBSITE;

// Preserve the CURRENT GitHub repository URLs. The repository name does not
// have to match the npm package name, and preserving it avoids breaking
// provenance / Trusted Publishing until you deliberately rename the repo.

p.scripts = p.scripts || {};
p.scripts['test:package'] = `npx @n8n/scan-community-package ${PACKAGE_NAME}`;

p.n8n = p.n8n || {};
p.n8n.n8nNodesApiVersion = p.n8n.n8nNodesApiVersion || 1;
p.n8n.strict = true;
p.n8n.credentials = ['dist/credentials/WaChattyApi.credentials.js'];
p.n8n.nodes = ['dist/nodes/WaChatty/WaChatty.node.js'];

fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
NODE

# ---------- Normalize internal node identifiers ----------
python3 <<'PY'
from pathlib import Path
import os
WEBSITE=os.environ['WEBSITE']; PURCHASE_URL=os.environ['PURCHASE_URL']

node_file = Path('nodes/WaChatty/WaChatty.node.ts')
if node_file.exists():
    s = node_file.read_text(encoding='utf-8')
    s = s.replace("export class Waghl ", "export class WaChatty ")
    s = s.replace("displayName: 'WAGHL'", "displayName: 'WaChatty'")
    s = s.replace("name: 'waghl'", "name: 'waChatty'")
    s = s.replace("name: 'WAGHL'", "name: 'WaChatty'")
    s = s.replace("name: 'waghlApi'", "name: 'waChattyApi'")
    s = s.replace("getCredentials('waghlApi')", "getCredentials('waChattyApi')")
    s = s.replace("'waghlApi',", "'waChattyApi',")
    s = s.replace("file:../../icons/waghl.svg", "file:../../icons/wachatty.svg")
    s = s.replace("icon: 'file:../../icons/wachatty.svg',", "icon: { light: 'file:../../icons/wachatty.svg', dark: 'file:../../icons/wachatty.svg' },")
    node_file.write_text(s, encoding='utf-8')

cred_file = Path('credentials/WaChattyApi.credentials.ts')
if cred_file.exists():
    s = cred_file.read_text(encoding='utf-8')
    s = s.replace('export class WaghlApi', 'export class WaChattyApi')
    s = s.replace("name = 'waghlApi'", "name = 'waChattyApi'")
    s = s.replace("displayName = 'WAGHL API'", "displayName = 'WaChatty API'")
    s = s.replace("documentationUrl = 'https://waghl.com'", "documentationUrl = 'https://wachatty.com'")
    s = s.replace("documentationUrl = 'https://wachatty.com/'", f"documentationUrl = '{WEBSITE}'")
    s = s.replace("documentationUrl = 'https://wachatty.com'", f"documentationUrl = '{WEBSITE}'")
    s = s.replace("file:../icons/waghl.svg", "file:../icons/wachatty.svg")
    s = s.replace("icon: Icon = 'file:../icons/wachatty.svg';", "icon: Icon = { light: 'file:../icons/wachatty.svg', dark: 'file:../icons/wachatty.svg' };")

    # Add a clickable purchase/get-started link in the n8n credential modal.
    marker = 'wachattyPurchaseNotice'
    if marker not in s:
        needle = 'properties: INodeProperties[] = ['
        notice = f'''properties: INodeProperties[] = [\n    {{\n      displayName:\n        'New to WaChatty? <a href="{PURCHASE_URL}" target="_blank">View plans and get started</a>',\n      name: 'wachattyPurchaseNotice',\n      type: 'notice',\n      default: '',\n    }},'''
        if needle not in s:
            raise SystemExit('Could not find credential properties array')
        s = s.replace(needle, notice, 1)

    cred_file.write_text(s, encoding='utf-8')
PY

# ---------- Add a clear commercial/support section to README ----------
python3 <<'PY'
from pathlib import Path
import os
WEBSITE=os.environ['WEBSITE']; PUBLIC_EMAIL=os.environ['PUBLIC_EMAIL']
p = Path('README.md')
if p.exists():
    s = p.read_text(encoding='utf-8')
    if '## Get WaChatty' not in s:
        block = f'''\n## Get WaChatty\n\nTo purchase WaChatty, create an account, or obtain API access, visit [{WEBSITE.replace('https://','').rstrip('/')} ]({WEBSITE}). For product and account questions, contact [{PUBLIC_EMAIL}](mailto:{PUBLIC_EMAIL}).\n\n'''.replace(' ]', ']')
        # Put this near the top, before Installation when possible.
        if '\n## Installation' in s:
            s = s.replace('\n## Installation', block + '## Installation', 1)
        else:
            lines = s.splitlines(True)
            insert_at = min(len(lines), 4)
            s = ''.join(lines[:insert_at]) + block + ''.join(lines[insert_at:])
    p.write_text(s, encoding='utf-8')
PY

# ---------- Regenerate lockfile for the new npm package name ----------
npm install --package-lock-only

echo
echo "============================================================"
echo "Rebrand applied. API Base URL values were NOT changed."
echo "Original commit: $START_COMMIT"
echo "============================================================"
echo
echo "Now run:"
echo "  npm ci"
echo "  npm run lint:fix"
echo "  npm test"
echo "  npm pack --dry-run"
echo "  npm run dev"
echo
echo "Then inspect the node + credentials in n8n before committing."
echo
echo "Useful audit commands:"
echo "  git diff --stat"
echo "  grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude=rebrand-to-wachatty.sh -E 'WAGHL|Waghl|waghlApi|n8n-nodes-waghl|info@waghl\\.com|https://waghl\\.com' . || true"
echo "  grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist 'custom2.waghl.com' . || true"
