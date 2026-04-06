import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');

const aiSource = await fs.readFile(aiPath, 'utf8');

for (const constantName of [
  'ESSAY_QUESTION_REQUEST_TIMEOUT_MS',
  'ESSAY_QUESTION_REPAIR_TIMEOUT_MS',
  'ESSAY_QUESTION_TIME_BUDGET_MS',
  'ESSAY_QUESTION_PARALLEL_REQUESTS',
]) {
  if (!aiSource.includes(`const ${constantName}`)) {
    throw new Error(`Expected convex/ai.ts to define ${constantName} for essay generation tuning.`);
  }
}

if (!aiSource.includes('const parseEssayQuestionsWithRepair = async')) {
  throw new Error('Expected convex/ai.ts to include essay-specific JSON repair logic.');
}

if (!/questionsData\s*=\s*await\s+parseEssayQuestionsWithRepair\(/.test(aiSource)) {
  throw new Error('Expected essay candidate generation to use essay-specific JSON repair.');
}

if (!/const\s+batchPlan\s*=\s*buildParallelBatchPlan\(\{[\s\S]*ESSAY_QUESTION_PARALLEL_REQUESTS/s.test(aiSource)) {
  throw new Error('Expected essay generation core to split work across parallel batches.');
}

if (!/const\s+deadlineMs\s*=\s*Date\.now\(\)\s*\+\s*ESSAY_QUESTION_TIME_BUDGET_MS/.test(aiSource)) {
  throw new Error('Expected essay generation core to enforce a bounded generation time budget.');
}

if (!/Promise\.allSettled\([\s\S]*generateEssayQuestionGapBatch/s.test(aiSource)) {
  throw new Error('Expected essay generation core to collect batch results via Promise.allSettled.');
}

if (!aiSource.includes('const buildSequentialRecoveryBatchPlan = (remainingNeeded: number, maxBatchCount = 3) => {')) {
  throw new Error('Expected essay generation to define a sequential recovery batch plan.');
}

if (!/if \(candidates\.length < remainingNeeded[\s\S]*buildSequentialRecoveryBatchPlan/s.test(aiSource)) {
  throw new Error('Expected essay generation core to fall back to smaller sequential essay batches when coverage is still thin.');
}

console.log('exam-essay-generation-bottleneck-regression.test.mjs passed');
