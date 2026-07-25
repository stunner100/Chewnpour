/**
 * Regression: Phase 4 Lucide icons (Material Symbols removed; AppIcon mapper).
 * Run: node scripts/lucide-icons-phase4-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const indexHtml = read('index.html');
const indexCss = read('src/index.css');
const appIcon = read('src/components/AppIcon.jsx');
const packageJson = JSON.parse(read('package.json'));

assert.ok(packageJson.dependencies?.['lucide-react'], 'lucide-react must be a dependency');
assert.doesNotMatch(indexHtml, /Material\+Symbols|material-symbols/i, 'index.html must not load Material Symbols');
assert.doesNotMatch(indexCss, /\.material-symbols-outlined/, 'index.css must not style Material Symbols');
assert.match(indexCss, /Lucide via AppIcon/, 'index.css should note Lucide cutover');

assert.match(appIcon, /from 'lucide-react'/, 'AppIcon must import from lucide-react');
assert.match(appIcon, /const MATERIAL_TO_LUCIDE\s*=/, 'AppIcon must define material→lucide map');
assert.match(appIcon, /export default function AppIcon/, 'AppIcon default export required');
assert.match(appIcon, /name:\s*StarIcon|star:\s*StarIcon/, 'star ligature must map to Lucide');
assert.match(appIcon, /home:\s*HomeIcon/, 'home ligature must map to Lucide');

function walkJsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walkJsx(path, out);
    else if (name.endsWith('.jsx') || name.endsWith('.js')) out.push(path);
  }
  return out;
}

const srcFiles = walkJsx(join(root, 'src'));
const offenders = [];
for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  if (/material-symbols-outlined/.test(text)) offenders.push(`${file}: material-symbols-outlined`);
  if (/\bMaterialIcon\b/.test(text)) offenders.push(`${file}: MaterialIcon`);
}
assert.equal(offenders.length, 0, `Material leftovers:\n${offenders.join('\n')}`);

const mobileNav = read('src/components/MobileBottomNav.jsx');
assert.match(mobileNav, /import AppIcon from/, 'MobileBottomNav must use AppIcon');
assert.match(mobileNav, /<AppIcon\b/, 'MobileBottomNav must render AppIcon');

console.log('lucide-icons-phase4-regression: ok');
