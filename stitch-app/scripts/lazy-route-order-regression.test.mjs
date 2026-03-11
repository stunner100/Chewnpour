import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(scriptDir, '..', 'src', 'App.jsx');
const source = await fs.readFile(appPath, 'utf8');

const helperIndex = source.indexOf('const lazyRoute = ');
if (helperIndex === -1) {
  throw new Error('Regression detected: App.jsx no longer defines lazyRoute.');
}

const lines = source.split('\n');
let runningIndex = 0;
for (const line of lines) {
  const lineStart = runningIndex;
  runningIndex += line.length + 1;
  if (!line.includes('= lazyRoute(')) continue;
  if (lineStart < helperIndex) {
    throw new Error(`Regression detected: lazyRoute consumer declared before helper: ${line.trim()}`);
  }
}

console.log('lazy-route-order-regression.test.mjs passed');
