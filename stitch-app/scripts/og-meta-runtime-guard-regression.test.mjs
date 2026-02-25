import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const projectRoot = process.cwd();
const mainPath = path.join(projectRoot, 'src', 'main.jsx');
const mainSource = fs.readFileSync(mainPath, 'utf8');

assert.match(
  mainSource,
  /const ensureSocialMetaDefaults\s*=\s*\(\)\s*=>\s*\{/,
  'Expected ensureSocialMetaDefaults helper in src/main.jsx'
);

assert.match(
  mainSource,
  /ensureMetaTag\(\{\s*property:\s*'og:type',\s*content:\s*'website'\s*\}\)/,
  "Expected runtime fallback for og:type meta tag in src/main.jsx"
);

const guardCallIndex = mainSource.indexOf('ensureSocialMetaDefaults();');
const renderCallIndex = mainSource.indexOf('createRoot(document.getElementById(\'root\')).render(');

assert.ok(guardCallIndex >= 0, 'Expected ensureSocialMetaDefaults() call in src/main.jsx');
assert.ok(renderCallIndex >= 0, 'Expected createRoot render call in src/main.jsx');
assert.ok(
  guardCallIndex < renderCallIndex,
  'Expected ensureSocialMetaDefaults() to run before React render bootstrap'
);

console.log('og-meta-runtime-guard-regression.test.mjs passed');
