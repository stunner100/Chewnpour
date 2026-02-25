import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const staleConvexHosts = [
  'patient-anteater-364.convex.cloud',
];
const root = process.cwd();
const convexPublicConfigPath = path.join(root, 'config', 'convex.public.json');

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `https://${raw.replace(/\/+$/, '')}`;
};

const readProjectConvexUrl = async () => {
  try {
    const raw = await fs.readFile(convexPublicConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.frontendConvexUrl || '').trim();
  } catch {
    return '';
  }
};

const resolveExpectedConvexHost = async () => {
  const projectConvexUrl = await readProjectConvexUrl();
  const source = String(
    process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || projectConvexUrl || ''
  ).trim();
  if (!source) return '';
  try {
    return new URL(source).host;
  } catch {
    throw new Error(
      `Invalid Convex URL "${source}". Expected VITE_CONVEX_URL/CONVEX_URL or config/convex.public.json frontendConvexUrl to be a valid URL.`
    );
  }
};

const fetchText = async (url) => {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return await response.text();
};

const findAssetScripts = (indexHtml) => {
  const matches = [...indexHtml.matchAll(/assets\/[^"' )]+\.js/g)].map((entry) => entry[0]);
  return [...new Set(matches)];
};

const deployUrl = normalizeBaseUrl(process.env.DEPLOY_URL || process.env.PREVIEW_URL);
if (!deployUrl) {
  throw new Error('Set DEPLOY_URL (or PREVIEW_URL) to run deploy-convex-host-smoke.test.mjs.');
}

const expectedConvexHost = await resolveExpectedConvexHost();
const indexHtml = await fetchText(deployUrl);
const assetScripts = findAssetScripts(indexHtml);
if (assetScripts.length === 0) {
  throw new Error(`Could not find JS assets in ${deployUrl}.`);
}

const scriptBodies = await Promise.all(
  assetScripts.map((assetPath) => fetchText(new URL(assetPath, `${deployUrl}/`).toString()))
);
const corpus = [indexHtml, ...scriptBodies].join('\n');

for (const staleHost of staleConvexHosts) {
  if (corpus.includes(staleHost)) {
    throw new Error(
      `Deploy bundle still references stale Convex host "${staleHost}".`
    );
  }
}

if (expectedConvexHost && !corpus.includes(expectedConvexHost)) {
  throw new Error(
    `Expected Convex host "${expectedConvexHost}" not found in deploy bundle.`
  );
}

console.log(
  `deploy-convex-host-smoke.test.mjs passed (${deployUrl}) with ${assetScripts.length} JS assets checked.`
);
