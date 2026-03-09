import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const aiPath = path.join(root, 'convex', 'ai.ts');

const [examModeSource, aiSource] = await Promise.all([
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
]);

if (!/!\(examFormat === 'essay' && generatingEssayQuestions\)/.test(examModeSource)) {
  throw new Error(
    'Expected ExamMode start effect to avoid starting essay attempts while essay question generation is in-flight.'
  );
}

if (!examModeSource.includes('isPreparingEssayStartError(startExamError)')) {
  throw new Error(
    'Expected ExamMode to detect deferred essay-start errors and recover when essay questions become available.'
  );
}

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

if (!/Promise\.allSettled\([\s\S]*generateEssayQuestionCandidatesBatch/s.test(aiSource)) {
  throw new Error('Expected essay generation core to collect parallel batch results via Promise.allSettled.');
}

console.log('exam-essay-generation-bottleneck-regression.test.mjs passed');
