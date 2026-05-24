import assert from 'node:assert/strict';
import { evaluatePrSize, parseNumstat } from './pr-size-gate.mjs';

const limits = {
  maxChangedFiles: 60,
  maxTotalLineChurn: 2500,
  maxSingleFileLineChurn: 900,
  maxSourceFileLines: 900,
};

const oversizedStack = Array.from({ length: 61 }, (_, index) => ({
  filePath: `stitch-app/src/pages/File${index}.jsx`,
  additions: 20,
  deletions: 25,
}));

const oversizedResult = evaluatePrSize(oversizedStack, {}, limits);
assert.equal(oversizedResult.violations.some((violation) => violation.includes('Changed files 61')), true);
assert.equal(oversizedResult.violations.some((violation) => violation.includes('Line churn 2745')), true);

const growingHotspot = evaluatePrSize(
  [{ filePath: 'stitch-app/convex/ai.ts', additions: 12, deletions: 2 }],
  { 'stitch-app/convex/ai.ts': 18000 },
  limits
);
assert.equal(
  growingHotspot.violations.some((violation) => violation.includes('grew by 10')),
  true
);

const shrinkingHotspot = evaluatePrSize(
  [{ filePath: 'stitch-app/convex/ai.ts', additions: 27, deletions: 258 }],
  { 'stitch-app/convex/ai.ts': 17792 },
  limits
);
assert.deepEqual(shrinkingHotspot.violations, []);

const helperSplit = evaluatePrSize(
  [{ filePath: 'stitch-app/convex/lib/assignmentAiSupport.ts', additions: 300, deletions: 0 }],
  { 'stitch-app/convex/lib/assignmentAiSupport.ts': 300 },
  limits
);
assert.deepEqual(helperSplit.violations, []);

const parsed = parseNumstat('10\t5\tstitch-app/src/pages/Profile.jsx\n-\t-\tstitch-app/public/icon.png\n');
assert.deepEqual(parsed, [
  {
    filePath: 'stitch-app/src/pages/Profile.jsx',
    additions: 10,
    deletions: 5,
  },
  {
    filePath: 'stitch-app/public/icon.png',
    additions: 0,
    deletions: 0,
  },
]);

console.log('pr-size-gate-regression.test.mjs passed');
