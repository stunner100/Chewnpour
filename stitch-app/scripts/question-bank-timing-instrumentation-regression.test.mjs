import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const topicsPath = path.join(root, 'convex', 'topics.ts');
const groundedPipelinePath = path.join(root, 'convex', 'lib', 'groundedContentPipeline.ts');

const [aiSource, topicsSource, groundedPipelineSource] = await Promise.all([
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(topicsPath, 'utf8'),
  fs.readFile(groundedPipelinePath, 'utf8'),
]);

const aiExpectations = [
  'timingBreakdown',
  'lockProbeMs',
  'lockWaitMs',
  'batchGenerationMs',
  'acceptanceMs',
  'deterministicMs',
  'llmVerificationMs',
  'repairMs',
  'optionRepairMs',
  'saveMs',
  'timing_breakdown',
  'Question bank timing breakdown',
  'metrics: acceptanceMetrics',
];

for (const needle of aiExpectations) {
  if (!aiSource.includes(needle)) {
    throw new Error(`Expected ai.ts instrumentation to include "${needle}".`);
  }
}

const topicsExpectations = [
  'lockWaitMs',
  'lockedUntil',
  'ttlMs',
];

for (const needle of topicsExpectations) {
  if (!topicsSource.includes(needle)) {
    throw new Error(`Expected topics.ts lock instrumentation to include "${needle}".`);
  }
}

const groundedExpectations = [
  'GroundedAcceptanceMetrics',
  'createGroundedAcceptanceMetrics',
  'deterministicChecks',
  'repairAttempts',
  'llmVerifications',
  'llmVerificationMs',
];

for (const needle of groundedExpectations) {
  if (!groundedPipelineSource.includes(needle)) {
    throw new Error(`Expected groundedContentPipeline.ts instrumentation to include "${needle}".`);
  }
}

console.log('question-bank-timing-instrumentation-regression.test.mjs passed');
