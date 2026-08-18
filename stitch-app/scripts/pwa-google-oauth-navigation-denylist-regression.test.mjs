import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const viteConfigSource = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');

if (!viteConfigSource.includes("navigateFallback: 'index.html'")) {
  throw new Error('Expected vite-plugin-pwa to keep an SPA navigateFallback of index.html.');
}

if (!/navigateFallbackDenylist:\s*\[/.test(viteConfigSource)) {
  throw new Error(
    'Expected workbox.navigateFallbackDenylist so Google OAuth callback navigations are not served as the SPA 404.',
  );
}

for (const pattern of ['/^\\/api\\//', '/^\\/ingest\\//', '/^\\/eve\\//']) {
  if (!viteConfigSource.includes(pattern)) {
    throw new Error(`Expected navigateFallbackDenylist to include ${pattern}.`);
  }
}

console.log('pwa-google-oauth-navigation-denylist-regression.test.mjs passed');
