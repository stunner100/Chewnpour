import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const mainPath = path.join(root, 'src', 'main.jsx');
const source = await fs.readFile(mainPath, 'utf8');

if (!/import\s+\{\s*stashOttFromUrl\s*\}\s+from\s+['"]\.\/lib\/ott\.js['"]/.test(source)) {
  throw new Error('Expected src/main.jsx to import stashOttFromUrl from src/lib/ott.js.');
}

if (!/stashOttFromUrl\(\);/.test(source)) {
  throw new Error('Expected src/main.jsx to call stashOttFromUrl() during bootstrap.');
}

const stashIndex = source.indexOf('stashOttFromUrl();');
const renderIndex = source.indexOf("createRoot(document.getElementById('root')).render(");
if (stashIndex < 0 || renderIndex < 0 || stashIndex > renderIndex) {
  throw new Error('Expected stashOttFromUrl() to run before React render bootstrap.');
}

console.log('ott-prebootstrap-stash-regression.test.mjs passed');
