import assert from 'node:assert/strict';

const {
  STALE_UPLOAD_REPAIR_TIMEOUT_MS,
  getUploadProcessingRepairDecision,
} = await import('../convex/lib/uploadProcessingFinalizer.js');

const now = 1_800_000;
const staleCreatedAt = now - STALE_UPLOAD_REPAIR_TIMEOUT_MS - 1;

const readyStepDecision = getUploadProcessingRepairDecision({
  upload: {
    _creationTime: staleCreatedAt,
    status: 'processing',
    processingStep: 'ready',
    generatedTopicCount: 4,
    plannedTopicCount: 4,
  },
  generatedTopicCount: 4,
  plannedTopicCount: 4,
  now,
});

assert.equal(readyStepDecision.action, 'mark_ready');
assert.equal(readyStepDecision.patch.status, 'ready');
assert.equal(readyStepDecision.patch.processingStep, 'ready');
assert.equal(readyStepDecision.patch.processingProgress, 100);

const questionBankDecision = getUploadProcessingRepairDecision({
  upload: {
    _creationTime: staleCreatedAt,
    status: 'processing',
    processingStep: 'generating_question_bank',
    generatedTopicCount: 5,
    plannedTopicCount: 5,
  },
  generatedTopicCount: 5,
  plannedTopicCount: 5,
  now,
});

assert.equal(questionBankDecision.action, 'mark_ready');
assert.match(questionBankDecision.reason, /completed_topics|question_bank/i);

const noContentDecision = getUploadProcessingRepairDecision({
  upload: {
    _creationTime: staleCreatedAt,
    status: 'processing',
    processingStep: 'extracting',
    generatedTopicCount: 0,
    plannedTopicCount: 6,
  },
  generatedTopicCount: 0,
  plannedTopicCount: 6,
  now,
});

assert.equal(noContentDecision.action, 'mark_error');
assert.equal(noContentDecision.patch.status, 'error');
assert.match(noContentDecision.patch.errorMessage, /couldn't finish/i);
assert.doesNotMatch(noContentDecision.patch.errorMessage, /Word Bank|Key Ideas|stack|timeout/i);

const freshDecision = getUploadProcessingRepairDecision({
  upload: {
    _creationTime: now - 1_000,
    status: 'processing',
    processingStep: 'generating_topics',
    generatedTopicCount: 0,
    plannedTopicCount: 6,
  },
  generatedTopicCount: 0,
  plannedTopicCount: 6,
  now,
});

assert.equal(freshDecision.action, 'keep_processing');

console.log('stale-upload-finalizer-regression.test.mjs passed');
