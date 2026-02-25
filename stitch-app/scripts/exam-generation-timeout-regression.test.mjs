import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const aiPath = path.join(root, 'convex', 'ai.ts');

const examModeSource = await fs.readFile(examModePath, 'utf8');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/QUESTION_GENERATION_REQUEST_TIMEOUT_MS\s*=\s*60_000/.test(examModeSource)) {
  throw new Error('Expected ExamMode to enforce a question-generation request timeout.');
}

if (!/AUTO_GENERATION_MAX_ATTEMPTS\s*=\s*3/.test(examModeSource)) {
  throw new Error('Expected ExamMode to cap automatic question-generation retries.');
}

if (!/setAutoGenerationPaused\(true\)/.test(examModeSource)) {
  throw new Error('Expected ExamMode to pause auto-generation after repeated failures.');
}

if (!/withTimeout\(\s*generateQuestions\(\{\s*topicId\s*\}\)/s.test(examModeSource)) {
  throw new Error('Expected ExamMode generateQuestions calls to be wrapped with a timeout.');
}

if (!/!autoGenerationInFlightRef\.current\s*&&\s*!generatingQuestions\s*&&\s*!examStarted/s.test(examModeSource)) {
  throw new Error('Expected ExamMode auto-generation gate to wait for generatingQuestions=false so retries can restart after failed runs.');
}

if (!/if\s*\(\s*Date\.now\(\)\s*>=\s*deadlineMs\s*\)\s*\{\s*break;\s*\}/s.test(aiSource)) {
  throw new Error('Expected backend question-bank loop to stop work when the interactive deadline is reached.');
}

if (!/const\s+optionTimeoutMs\s*=\s*runMode\s*===\s*"interactive"/.test(aiSource)) {
  throw new Error('Expected backend to use a bounded interactive timeout when regenerating weak options.');
}

if (!/if\s*\(!hasUsableQuestionOptions\(options\)\)\s*\{[\s\S]*generateOptionsForQuestion/s.test(aiSource)) {
  throw new Error('Expected backend to regenerate options when generated options are low quality.');
}

console.log('exam-generation-timeout-regression.test.mjs passed');
