import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR,
  rebaseQuestionBankTargetAfterRun,
  resolveRecoveredQuestionBankTarget,
} from '../convex/lib/questionBankConfig.js';

{
  const recoveredStoredTarget = resolveRecoveredQuestionBankTarget({
    storedTargetCount: 2,
    requestedTargetCount: 8,
    supportTargetCount: 8,
    minTarget: 1,
    minimumRetainedTarget: OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR,
  });

  assert.equal(recoveredStoredTarget, 5);
}

{
  const rebasedTarget = rebaseQuestionBankTargetAfterRun({
    targetCount: 8,
    initialCount: 0,
    finalCount: 2,
    addedCount: 2,
    outcome: 'max_rounds_reached',
    minTarget: 1,
    supportTargetCount: 8,
    minimumRetainedTarget: OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR,
  });

  assert.equal(rebasedTarget, 5);
}

{
  const rebasedTarget = rebaseQuestionBankTargetAfterRun({
    targetCount: 8,
    initialCount: 0,
    finalCount: 2,
    addedCount: 2,
    outcome: 'insufficient_evidence',
    minTarget: 1,
    supportTargetCount: 8,
    minimumRetainedTarget: OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR,
  });

  assert.equal(rebasedTarget, 2);
}

{
  const rebasedTarget = rebaseQuestionBankTargetAfterRun({
    targetCount: 8,
    initialCount: 0,
    finalCount: 2,
    addedCount: 2,
    outcome: 'max_rounds_reached',
    minTarget: 1,
    supportTargetCount: 3,
    minimumRetainedTarget: OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR,
  });

  assert.equal(rebasedTarget, 2);
}

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

if (!/minimumRetainedTarget:\s*OBJECTIVE_PARTIAL_SUCCESS_TARGET_FLOOR/.test(aiSource)) {
  throw new Error('Expected objective question generation to preserve a retained target floor on partial runs.');
}

if (!/supportTargetCount:\s*Math\.min\(\s*targetResolution\.wordCountTarget,\s*Math\.max\(targetResolution\.evidenceRichnessCap,\s*targetResolution\.evidenceCapEstimatedCapacity\)/s.test(aiSource)) {
  throw new Error('Expected objective question generation to rebase against the strongest remaining support signal.');
}

console.log('question-bank-rebase-floor-regression.test.mjs passed');
