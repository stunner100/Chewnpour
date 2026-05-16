import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const playbackSource = await read('src/lib/useVoicePlayback.js');
const convexConfigSource = await read('src/lib/convex-config.js');
const viteConfigSource = await read('vite.config.js');

for (const snippet of [
  'import { convexSiteUrl } from "./convex-config";',
  'const explicitSiteUrl = String(convexSiteUrl || import.meta.env?.VITE_CONVEX_SITE_URL || "").trim();',
  'const rawUrl = explicitSiteUrl || rawConvexUrl;',
  'return parsed.origin;',
]) {
  if (!playbackSource.includes(snippet)) {
    throw new Error(`Expected voice playback to resolve stream URLs from the Convex site URL first: ${snippet}`);
  }
}

if (!convexConfigSource.includes('export const convexSiteUrl = hasConvexUrl')) {
  throw new Error('Expected convex-config.js to expose convexSiteUrl.');
}

if (!/envConvexSiteUrl \|\| convexUrl/.test(convexConfigSource)) {
  throw new Error('Expected convexSiteUrl to prefer VITE_CONVEX_SITE_URL before falling back to VITE_CONVEX_URL.');
}

for (const snippet of [
  "const resolvedConvexSiteUrl = String(env.VITE_CONVEX_SITE_URL || '').trim()",
  "'import.meta.env.VITE_CONVEX_SITE_URL': JSON.stringify(resolvedConvexSiteUrl)",
]) {
  if (!viteConfigSource.includes(snippet)) {
    throw new Error(`Expected vite config to inject the Convex site URL at build time: ${snippet}`);
  }
}

console.log('voice-stream-site-url-regression.test.mjs passed');
