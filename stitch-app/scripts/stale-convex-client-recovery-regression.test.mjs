import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const recoverySource = await fs.readFile(
  path.join(root, 'src', 'lib', 'chunkLoadRecovery.js'),
  'utf8',
);
if (!/export const isStaleConvexClientError = \(errorLike\) => \{/.test(recoverySource)) {
  throw new Error('Expected stale Convex client error detector export.');
}
if (!/concepts:getUserConceptAttempts/i.test(recoverySource)) {
  throw new Error('Stale Convex detector must include getUserConceptAttempts signature.');
}
if (!/CONVEX_SERVER_ERROR_SIGNATURE_PATTERN/.test(recoverySource)) {
  throw new Error('Stale Convex detector must validate Convex server-error wrapper signature.');
}

const boundarySource = await fs.readFile(
  path.join(root, 'src', 'components', 'AppErrorBoundary.jsx'),
  'utf8',
);
if (!/isStaleConvexClientError/.test(boundarySource)) {
  throw new Error('AppErrorBoundary must import stale Convex client error detector.');
}
if (!/attemptChunkRecoveryReload\('stale-convex-client'\)/.test(boundarySource)) {
  throw new Error('AppErrorBoundary must force one-time stale-client reload scope.');
}

console.log('stale-convex-client-recovery-regression.test.mjs passed');
