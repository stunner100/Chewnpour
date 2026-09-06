/**
 * Regression: design tokens match the ChewnPour Slate redesign system
 * (blue #007AFF primary + near-black #111 CTA + Plus Jakarta Sans).
 * Run: node scripts/design-tokens-master-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tailwind = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const button = readFileSync(join(root, 'src/components/ui/button.jsx'), 'utf8');

assert.match(tailwind, /DEFAULT:\s*"#007AFF"/, 'primary DEFAULT must be system blue #007AFF');
assert.match(tailwind, /cta:\s*\{[\s\S]*?DEFAULT:\s*"#111111"/, 'cta DEFAULT must be near-black #111111');
assert.doesNotMatch(tailwind, /#914bf1/, 'purple #914bf1 must be removed from tailwind');
assert.match(tailwind, /"Plus Jakarta Sans"/, 'Plus Jakarta Sans must be in fontFamily');
assert.match(tailwind, /"JetBrains Mono"/, 'JetBrains Mono must be in fontFamily');
assert.doesNotMatch(tailwind, /\bInter\b/, 'Inter must not remain in fontFamily');

assert.match(indexCss, /--ring:\s*0 122 255/, 'CSS --ring must be blue #007AFF');
assert.doesNotMatch(indexCss, /145 75 241/, 'purple ring RGB must be gone');
assert.match(indexCss, /bg-cta/, 'btn-primary must use cta token');

assert.match(indexHtml, /family=Plus\+Jakarta\+Sans/, 'index.html must load Plus Jakarta Sans');
assert.match(indexHtml, /family=JetBrains\+Mono/, 'index.html must load JetBrains Mono');
assert.doesNotMatch(indexHtml, /family=Inter/, 'index.html must not load Inter');

assert.match(button, /bg-cta/, 'shadcn Button default must use the near-black CTA');

console.log('design-tokens-master-regression: ok');
