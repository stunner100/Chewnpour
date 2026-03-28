import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [mainSource, viteConfigSource, swSource, vercelSource] = await Promise.all([
  read('src/main.jsx'),
  read('vite.config.js'),
  read('public/sw.js'),
  read('vercel.json'),
]);

if (mainSource.includes('registerSW(') || mainSource.includes("from 'virtual:pwa-register'")) {
  throw new Error('Regression detected: src/main.jsx still registers a production service worker.');
}

for (const snippet of [
  'const clearLegacyPwaRuntime = () => {',
  'navigator.serviceWorker.getRegistrations()',
  'registration.unregister()',
  'window.caches.keys()',
  'removeManifestLink()',
]) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`Regression detected: main.jsx missing legacy PWA cleanup snippet: ${snippet}`);
  }
}

if (viteConfigSource.includes('VitePWA(') || viteConfigSource.includes("from 'vite-plugin-pwa'")) {
  throw new Error('Regression detected: vite.config.js still enables vite-plugin-pwa.');
}

for (const snippet of [
  "self.addEventListener('install'",
  'self.skipWaiting()',
  "self.addEventListener('activate'",
  'self.registration.unregister()',
  'clients.matchAll',
  'client.navigate(client.url)',
]) {
  if (!swSource.includes(snippet)) {
    throw new Error(`Regression detected: public/sw.js missing cleanup snippet: ${snippet}`);
  }
}

for (const snippet of [
  '"source": "/sw.js"',
  '"value": "no-store, no-cache, must-revalidate"',
]) {
  if (!vercelSource.includes(snippet)) {
    throw new Error(`Regression detected: vercel.json missing stale-PWA cutover header: ${snippet}`);
  }
}

console.log('pwa-cutover-regression.test.mjs passed');
