import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sentryPath = path.join(root, 'src', 'lib', 'sentry.js');
const source = await fs.readFile(sentryPath, 'utf8');

const requiredSnippets = [
  'const CONVEX_SERVER_ERROR_PATTERN =',
  'const CONVEX_REQUEST_ID_PATTERN =',
  "replace(CONVEX_REQUEST_ID_PATTERN, '[Request ID]')",
  "event.fingerprint = ['convex-server-error', fingerprintSignature];",
  'return normalizeConvexServerErrorEvent(event, hint);',
  "'flow_slow',",
  "'large_file_detected',",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Regression detected: expected sentry normalization snippet missing: ${snippet}`);
  }
}

if (!/CONVEX_CALL_SIGNATURE_PATTERN/.test(source)) {
  throw new Error('Regression detected: Convex call signature pattern was removed.');
}

console.log('sentry-convex-grouping-regression.test.mjs passed');
