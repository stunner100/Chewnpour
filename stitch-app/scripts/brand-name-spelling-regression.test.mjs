import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// User-facing copy spells the brand "ChewnPour" (not "Chew & Pour", "Chewnpour", ...).
// Lower-case "chewnpour" in domains, emails, ids and storage keys is fine.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return walk(path);
  return /\.(jsx?|tsx?|html|json|webmanifest)$/.test(name) ? [path] : [];
});

const BRAND = /chew\s*(?:&|and|'n'|-n-|n)?\s*pour/gi;
const offenders = [];
for (const file of [...walk(join(root, 'src')), ...walk(join(root, 'server')), join(root, 'index.html')]) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(BRAND)) {
      const word = match[0];
      if (word === 'ChewnPour' || word === 'chewnpour') continue;
      offenders.push(`${relative(root, file)}:${index + 1} ${word}`);
    }
  });
}
assert.deepEqual(offenders, [], `Brand must be spelled "ChewnPour":\n${offenders.join('\n')}`);

console.log('brand-name-spelling-regression.test.mjs passed');
