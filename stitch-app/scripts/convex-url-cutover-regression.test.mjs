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

if (!/VITE_CONVEX_SITE_URL/.test(convexConfigSource) || !/envConvexSiteUrl \|\| convexUrl/.test(convexConfigSource)) {
  throw new Error('Expected convex-config to honor VITE_CONVEX_SITE_URL for custom Convex site domains.');
}

if (/\.convex\.cloud|\.convex\.site/.test(convexConfigSource)) {
  throw new Error('Expected convex-config to avoid Convex Cloud-specific domain derivation.');
}

const envExamplePath = path.join(root, '.env.example');
const envExampleSource = await fs.readFile(envExamplePath, 'utf8');

if (!/^VITE_CONVEX_URL=/m.test(envExampleSource)) {
  throw new Error('Expected .env.example to include VITE_CONVEX_URL for frontend Convex wiring.');
}

for (const expectedSnippet of [
  'self-hosted Convex runtime on DigitalOcean',
  'Do not use *.convex.cloud for staging or production.',
  'VITE_CONVEX_SITE_URL=',
  'CONVEX_URL=',
  'ALLOW_CONVEX_CLOUD_DEPLOY=false',
]) {
  if (!envExampleSource.includes(expectedSnippet)) {
    throw new Error(`Expected .env.example to document the DigitalOcean Convex target: ${expectedSnippet}`);
  }
}

const convexPublicConfigSource = await fs.readFile(convexPublicConfigPath, 'utf8');
const convexPublicConfig = JSON.parse(convexPublicConfigSource);
const convexPublicUrl = String(convexPublicConfig?.frontendConvexUrl || '').trim();
if (convexPublicUrl) {
  let convexPublicHost = '';
  try {
    convexPublicHost = new URL(convexPublicUrl).host;
  } catch {
    throw new Error(
      `Expected config/convex.public.json frontendConvexUrl to be empty or a valid URL. Received "${convexPublicUrl}".`
    );
  }
  if (/\.convex\.cloud$/i.test(convexPublicHost)) {
    throw new Error(
      `config/convex.public.json must not fall back to Convex Cloud. Received "${convexPublicHost}".`
    );
  }
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

if (!/DigitalOcean-hosted Convex runtime/.test(viteConfigSource)) {
  throw new Error('Expected vite config build guard to name the DigitalOcean-hosted Convex runtime.');
}

for (const expectedSnippet of [
  'const getHost = (value) => {',
  "const allowConvexCloudDeploy = env.ALLOW_CONVEX_CLOUD_DEPLOY === 'true'",
  '/\\.convex\\.cloud$/i.test(getHost(resolvedConvexUrl))',
  'Refusing to build against Convex Cloud.',
]) {
  if (!viteConfigSource.includes(expectedSnippet)) {
    throw new Error(`Expected vite config to refuse Convex Cloud build targets: ${expectedSnippet}`);
  }
}

if (!/Missing Convex URL for build/.test(viteConfigSource)) {
  throw new Error('Expected vite config build guard to provide a clear missing Convex URL error.');
}

console.log('convex-url-cutover-regression.test.mjs passed');
