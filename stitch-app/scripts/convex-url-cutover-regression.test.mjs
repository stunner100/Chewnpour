import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const convexPublicConfigPath = path.join(root, 'config', 'convex.public.json');

const convexConfigPath = path.join(root, 'src', 'lib', 'convex-config.js');
const convexConfigSource = await fs.readFile(convexConfigPath, 'utf8');

if (/FALLBACK_CONVEX_URL/.test(convexConfigSource)) {
  throw new Error('Expected convex-config to avoid a hardcoded fallback deployment URL.');
}

if (/whimsical-pelican-356/.test(convexConfigSource)) {
  throw new Error('Expected convex-config to remove legacy hardcoded Convex deployment values.');
}

if (!convexConfigSource.includes('export const convexUrl = envConvexUrl;')) {
  throw new Error('Expected convex-config to source convexUrl directly from VITE_CONVEX_URL.');
}

if (!convexConfigSource.includes('export const hasConvexUrl = convexUrl.length > 0;')) {
  throw new Error('Expected convex-config to gate Convex client setup on explicit URL presence.');
}

if (!/VITE_CONVEX_SITE_URL/.test(convexConfigSource) || !/envConvexSiteUrl \|\| convexUrl\.replace/.test(convexConfigSource)) {
  throw new Error('Expected convex-config to honor VITE_CONVEX_SITE_URL for custom Convex site domains.');
}

const envExamplePath = path.join(root, '.env.example');
const envExampleSource = await fs.readFile(envExamplePath, 'utf8');

if (!/^VITE_CONVEX_URL=/m.test(envExampleSource)) {
  throw new Error('Expected .env.example to include VITE_CONVEX_URL for frontend Convex wiring.');
}

const convexPublicConfigSource = await fs.readFile(convexPublicConfigPath, 'utf8');
const convexPublicConfig = JSON.parse(convexPublicConfigSource);
const convexPublicUrl = String(convexPublicConfig?.frontendConvexUrl || '').trim();
if (!convexPublicUrl) {
  throw new Error('Expected config/convex.public.json to include frontendConvexUrl.');
}
let convexPublicHost = '';
try {
  convexPublicHost = new URL(convexPublicUrl).host;
} catch {
  throw new Error(
    `Expected config/convex.public.json frontendConvexUrl to be a valid URL. Received "${convexPublicUrl}".`
  );
}
if (!/\.convex\.cloud$/i.test(convexPublicHost)) {
  throw new Error(
    `Expected config/convex.public.json frontendConvexUrl to target a Convex cloud host. Received "${convexPublicHost}".`
  );
}

const viteConfigPath = path.join(root, 'vite.config.js');
const viteConfigSource = await fs.readFile(viteConfigPath, 'utf8');

if (!/loadEnv\(/.test(viteConfigSource)) {
  throw new Error('Expected vite config to load environment variables with loadEnv.');
}

if (!/command === 'serve'[\s\S]*env\.VITE_CONVEX_URL \|\| env\.CONVEX_URL \|\| projectConvexUrl/s.test(viteConfigSource)) {
  throw new Error(
    'Expected vite config to allow config/convex.public.json fallback only during local serve.'
  );
}

if (!/readConvexProjectConfigUrl/.test(viteConfigSource)) {
  throw new Error('Expected vite config to read config/convex.public.json when env Convex URL is unset.');
}

if (!/config\/convex\.public\.json/.test(viteConfigSource)) {
  throw new Error('Expected vite config to still reference config/convex.public.json for local serve fallback.');
}

if (!/command === 'serve'[\s\S]*: env\.VITE_CONVEX_URL \|\| env\.CONVEX_URL \|\| ''/s.test(viteConfigSource)) {
  throw new Error('Expected vite config to require explicit env Convex URL outside local serve.');
}

if (!/import\.meta\.env\.VITE_CONVEX_URL/.test(viteConfigSource)) {
  throw new Error('Expected vite config to define import.meta.env.VITE_CONVEX_URL at build time.');
}

if (!/command\s*===\s*['"]build['"]\s*&&\s*!resolvedConvexUrl/.test(viteConfigSource)) {
  throw new Error('Expected vite config to fail builds when Convex URL is missing.');
}

if (!/Preview and production builds must not fall back to config\/convex\.public\.json/.test(viteConfigSource)) {
  throw new Error('Expected vite config build guard to explain that preview and production must not use the local Convex fallback.');
}

if (!/Missing Convex URL for build/.test(viteConfigSource)) {
  throw new Error('Expected vite config build guard to provide a clear missing Convex URL error.');
}

console.log('convex-url-cutover-regression.test.mjs passed');
