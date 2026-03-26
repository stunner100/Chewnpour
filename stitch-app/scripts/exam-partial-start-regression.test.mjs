import assert from 'node:assert/strict';
import { resolvePreparedExamStart } from '../convex/lib/examStartPolicy.js';

{
  const result = resolvePreparedExamStart({
    requiredQuestionCount: 5,
    selectedQuestionCount: 3,
    requiresGeneration: true,
    unavailableReason: undefined,
    coverageSatisfied: false,
    allowPartialReady: false,
  });

  assert.equal(result.status, 'needs_generation');
  assert.equal(result.reasonCode, 'MISSING_OUTCOME_COVERAGE');
  assert.equal(result.attemptTargetCount, 5);
  assert.equal(result.canStartPartialAttempt, false);
}

{
  const result = resolvePreparedExamStart({
    requiredQuestionCount: 5,
    selectedQuestionCount: 3,
    requiresGeneration: true,
    unavailableReason: 'MISSING_OUTCOME_COVERAGE',
    coverageSatisfied: false,
    allowPartialReady: true,
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.reasonCode, undefined);
  assert.equal(result.attemptTargetCount, 3);
  assert.equal(result.canStartPartialAttempt, true);
}

{
  const result = resolvePreparedExamStart({
    requiredQuestionCount: 5,
    selectedQuestionCount: 0,
    requiresGeneration: false,
    unavailableReason: 'INSUFFICIENT_READY_QUESTIONS',
    coverageSatisfied: false,
    allowPartialReady: true,
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reasonCode, 'INSUFFICIENT_READY_QUESTIONS');
  assert.equal(result.attemptTargetCount, 5);
  assert.equal(result.canStartPartialAttempt, false);
}

console.log('exam-partial-start-regression.test.mjs passed');
