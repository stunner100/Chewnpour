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

if (!/START_EXAM_ATTEMPT_TIMEOUT_MS\s*=\s*240_000/.test(examModeSource)) {
  throw new Error('Expected ExamMode to give fresh exam startup enough time before surfacing retry UI.');
}

if (!/EXAM_LOADING_STALL_TIMEOUT_MS\s*=\s*270_000/.test(examModeSource)) {
  throw new Error('Expected ExamMode to monitor long-running exam preparation stalls.');
}

if (!/withTimeout\(\s*startExamAttemptHttp\(\{ topicId, examFormat \}\)/s.test(examModeSource)) {
  throw new Error('Expected ExamMode startExamAttempt calls to be wrapped with a timeout.');
}

if (!/startingExamAttempt \|\| isPreparationRunning/.test(examModeSource)) {
  throw new Error('Expected ExamMode to treat live preparation status as part of the loading-stall watchdog.');
}

for (const forbiddenPattern of [
  'QUESTION_GENERATION_REQUEST_TIMEOUT_MS',
  'AUTO_GENERATION_MAX_ATTEMPTS',
  'setAutoGenerationPaused',
  'generateQuestions({ topicId })',
  'generateEssayQuestions({',
  'result?.deferred === true',
]) {
  if (examModeSource.includes(forbiddenPattern)) {
    throw new Error(`Regression detected: ExamMode should not keep old start-flow timeout logic (${forbiddenPattern}).`);
  }
}

if (
  !/Date\.now\(\)\s*<\s*deadlineMs/.test(aiSource)
  || !/if\s*\(\s*Date\.now\(\)\s*>=\s*deadlineMs\s*\)\s*\{\s*return false;\s*\}/s.test(aiSource)
) {
  throw new Error('Expected backend question-bank loops to stop work once the interactive deadline is reached.');
}

if (!/const\s+optionTimeoutMs\s*=\s*runMode\s*===\s*"interactive"/.test(aiSource)) {
  throw new Error('Expected backend to use a bounded interactive timeout when regenerating weak options.');
}

if (!/if\s*\(!hasUsableQuestionOptions\(options\)\)\s*\{[\s\S]*generateOptionsForQuestion\(\{[\s\S]*evidence:\s*groundedPack\.evidence/s.test(aiSource)) {
  throw new Error('Expected backend to regenerate weak options with grounded evidence.');
}

console.log('exam-generation-timeout-regression.test.mjs passed');
