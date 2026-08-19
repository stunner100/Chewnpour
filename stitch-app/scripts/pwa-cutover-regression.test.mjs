import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [viteConfigSource, vercelSource] = await Promise.all([
  read('vite.config.js'),
  read('vercel.json'),
]);

if (!viteConfigSource.includes('VitePWA(') || !viteConfigSource.includes("from 'vite-plugin-pwa'")) {
  throw new Error('Expected vite.config.js to keep vite-plugin-pwa for installability.');
}

if (!/navigateFallbackDenylist:\s*\[/.test(viteConfigSource) || !viteConfigSource.includes('/^\\/api\\//')) {
  throw new Error(
    'Expected workbox.navigateFallbackDenylist to exclude /api/ so OAuth callbacks are not served as index.html.',
  );
}

if (!viteConfigSource.includes('navigateFallbackAllowlist: [/^\\/$/]')) {
  throw new Error(
    'Expected navigateFallbackAllowlist to cover only / so dashboard navigations fetch a fresh index.html after deploys.',
  );
}

for (const snippet of [
  '"source": "/sw.js"',
  '"value": "no-store, no-cache, must-revalidate"',
]) {
  if (!vercelSource.includes(snippet)) {
    throw new Error(`Regression detected: vercel.json missing stale-PWA cutover header: ${snippet}`);
  }
}

if (vercelSource.includes('"key": "Clear-Site-Data"')) {
  throw new Error('Regression detected: sw.js must not clear origin storage on routine fetches.');
}

console.log('pwa-cutover-regression.test.mjs passed');
