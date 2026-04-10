import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app';
const recoverySource = await fs.readFile(path.join(root, 'src/lib/chunkLoadRecovery.js'), 'utf8');
const mainSource = await fs.readFile(path.join(root, 'src/main.jsx'), 'utf8');

const recoverySnippets = [
  'const STALE_EXAM_ROUTE_REFERENCE_PATTERNS = [',
  '/referenceerror:\\s*routedfinalassessmenttopic\\s+is\\s+not\\s+defined/i',
  'export const isStaleExamRouteReferenceError = (errorLike) => {',
];

for (const snippet of recoverySnippets) {
  if (!recoverySource.includes(snippet)) {
    throw new Error(`Expected chunkLoadRecovery.js to include "${snippet}" for stale exam route recovery.`);
  }
}

const mainSnippets = [
  'isStaleExamRouteReferenceError,',
  "if (isStaleExamRouteReferenceError(event?.error || event?.message)) {",
  "if (attemptChunkRecoveryReload('stale-exam-route-reference')) {",
  "if (isStaleExamRouteReferenceError(event?.reason)) {",
];

for (const snippet of mainSnippets) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`Expected main.jsx to include "${snippet}" for stale exam route recovery.`);
  }
}

console.log('stale-exam-route-recovery-regression.test.mjs passed');
