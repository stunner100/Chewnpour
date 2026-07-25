/**
 * Regression: Phase 1 design tokens match MASTER.md (teal primary + amber CTA).
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

assert.match(tailwind, /DEFAULT:\s*"#0D9488"/, 'primary DEFAULT must be teal #0D9488');
assert.match(tailwind, /cta:\s*\{[\s\S]*?DEFAULT:\s*"#D97706"/, 'cta DEFAULT must be amber #D97706');
assert.doesNotMatch(tailwind, /#914bf1/, 'purple #914bf1 must be removed from tailwind');
assert.match(tailwind, /"Space Grotesk"/, 'Space Grotesk must be in fontFamily');
assert.match(tailwind, /"DM Sans"/, 'DM Sans must be in fontFamily');
assert.doesNotMatch(tailwind, /\bInter\b/, 'Inter must not remain in fontFamily');

assert.match(indexCss, /--ring:\s*13 148 136/, 'CSS --ring must be teal');
assert.doesNotMatch(indexCss, /145 75 241/, 'purple ring RGB must be gone');
assert.match(indexCss, /bg-cta/, 'btn-primary must use cta token');

assert.match(indexHtml, /family=Space\+Grotesk/, 'index.html must load Space Grotesk');
assert.match(indexHtml, /family=DM\+Sans/, 'index.html must load DM Sans');
assert.doesNotMatch(indexHtml, /family=Inter/, 'index.html must not load Inter');

assert.match(button, /bg-cta/, 'shadcn Button default must use amber CTA');

console.log('design-tokens-master-regression: ok');
