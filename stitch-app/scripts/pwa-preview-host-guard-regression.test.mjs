import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const [mainSource, viteConfigSource] = await Promise.all([
  fs.readFile(path.join(root, 'src/main.jsx'), 'utf8'),
  fs.readFile(path.join(root, 'vite.config.js'), 'utf8'),
]);

if (mainSource.includes('registerSW(') || mainSource.includes("from 'virtual:pwa-register'")) {
  throw new Error('main.jsx must not register a runtime PWA service worker; vite-plugin-pwa injects that.');
}

if (!viteConfigSource.includes('VitePWA(') || !viteConfigSource.includes("from 'vite-plugin-pwa'")) {
  throw new Error('vite.config.js must keep vite-plugin-pwa enabled.');
}

if (!viteConfigSource.includes('/^\\/api\\//')) {
  throw new Error('vite.config.js must denylist /api/ from PWA navigateFallback.');
}

console.log('pwa-preview-host-guard-regression.test.mjs passed');
