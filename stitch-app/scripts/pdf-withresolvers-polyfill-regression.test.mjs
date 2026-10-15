import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rootDir = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const polyfillsSource = read('src/lib/runtimePolyfills.js');
assert.match(
    polyfillsSource,
    /Promise\.withResolvers\s*=\s*\(\)\s*=>/,
    'Expected runtime polyfill to define Promise.withResolvers fallback.',
);

const mainSource = read('src/main.jsx');
assert.ok(
    mainSource.includes("ensurePromiseWithResolvers();"),
    'Expected app bootstrap to install Promise.withResolvers polyfill.',
);

console.log('pdf-withresolvers-polyfill-regression.test.mjs passed');
