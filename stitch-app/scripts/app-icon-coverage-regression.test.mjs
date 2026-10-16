import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// AppIcon renders a "?" for any name missing from its map, so every icon name
// used in src must have a mapping.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appIconSource = readFileSync(join(root, 'src/components/AppIcon.jsx'), 'utf8');
const mapBody = appIconSource.match(/const MATERIAL_TO_LUCIDE = \{([\s\S]*?)\n\};/)?.[1] || '';
const mapped = new Set([...mapBody.matchAll(/^\s+([a-z0-9_]+):/gm)].map((match) => match[1]));
assert.ok(mapped.size > 100, 'could not read the AppIcon map');

const ICON_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
// String literals in a name={...} expression, minus comparison operands like
// status === 'ready'.
const strings = (expression) => [...expression
  .replace(/(?:===|!==)\s*(?:'[^'\n]*'|"[^"\n]*")/g, '')
  .replace(/(?:'[^'\n]*'|"[^"\n]*")\s*(?:===|!==)/g, '')
  .matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)]
  .map((match) => match[1] ?? match[2]);

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return walk(path);
  return /\.(jsx?|tsx?)$/.test(name) ? [path] : [];
});

const used = new Map();
const note = (name, file) => {
  if (!ICON_NAME.test(name)) return;
  if (!used.has(name)) used.set(name, new Set());
  used.get(name).add(relative(root, file));
};

for (const file of walk(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8');
  // <AppIcon name="x" />, <AppIcon name={cond ? 'x' : 'y'} />
  for (const match of source.matchAll(/<AppIcon\b[^>]*?\bname=(?:"([^"]+)"|\{([^}]*)\})/g)) {
    if (match[1]) note(match[1], file);
    else strings(match[2]).forEach((name) => note(name, file));
  }
  // Icon names handed to components that render AppIcon: icon: 'x', icon="x", icon={'x'}.
  for (const match of source.matchAll(/\bicon(?:Name)?\s*(?::|=)\s*(?:'([^']+)'|"([^"]+)"|\{\s*'([^']+)'\s*\})/g)) {
    note(match[1] ?? match[2] ?? match[3], file);
  }
}

const missing = [...used.entries()]
  .filter(([name]) => !mapped.has(name))
  .map(([name, files]) => `${name} (${[...files].join(', ')})`);
assert.deepEqual(missing, [], `AppIcon is missing mappings for:\n${missing.join('\n')}`);

console.log('app-icon-coverage-regression.test.mjs passed', { iconsChecked: used.size });
