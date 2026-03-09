import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

for (const constantName of [
  'ESSAY_QUESTION_BACKGROUND_RETRY_DELAY_MS',
  'ESSAY_QUESTION_BACKGROUND_MAX_RETRIES',
  'ESSAY_QUESTION_READY_MIN_COUNT',
]) {
  if (!aiSource.includes(`const ${constantName}`)) {
    throw new Error(`Expected convex/ai.ts to define ${constantName}.`);
  }
}

if (!/generateEssayQuestionsForTopicInternal = internalAction\(\{[\s\S]*retryAttempt: v\.optional\(v\.number\(\)\)/s.test(aiSource)) {
  throw new Error('Expected internal essay generation action args to include retryAttempt.');
}

if (!/const shouldRetry =[\s\S]*ESSAY_QUESTION_BACKGROUND_MAX_RETRIES/s.test(aiSource)) {
  throw new Error('Expected internal essay generation flow to compute bounded retry eligibility.');
}

if (!/ctx\.scheduler\.runAfter\([\s\S]*internal\.ai\.generateEssayQuestionsForTopicInternal/s.test(aiSource)) {
  throw new Error('Expected internal essay generation flow to reschedule itself when readiness is not met.');
}

if (!aiSource.includes('[EssayQuestionBank] retry_scheduled')) {
  throw new Error('Expected retry scheduling to be logged for observability.');
}

console.log('essay-background-retry-regression.test.mjs passed');
