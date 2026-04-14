import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

for (const constantName of [
  'MCQ_QUESTION_BACKGROUND_RETRY_DELAY_MS',
  'MCQ_QUESTION_BACKGROUND_MAX_RETRIES',
]) {
  if (!aiSource.includes(`const ${constantName}`)) {
    throw new Error(`Expected convex/ai.ts to define ${constantName}.`);
  }
}

if (!/generateQuestionsForTopicInternal = internalAction\(\{[\s\S]*retryAttempt: v\.optional\(v\.number\(\)\)/s.test(aiSource)) {
  throw new Error('Expected internal MCQ generation action args to include retryAttempt.');
}

if (!/const shouldRetry =[\s\S]*MCQ_QUESTION_BACKGROUND_MAX_RETRIES/s.test(aiSource)) {
  throw new Error('Expected internal MCQ generation flow to compute bounded retry eligibility.');
}

if (!aiSource.includes('thinFirstPassUnderfilled')) {
  throw new Error('Expected internal MCQ generation flow to retry thin first-pass banks.');
}

if (!/ctx\.scheduler\.runAfter\([\s\S]*internal\.ai\.generateQuestionsForTopicInternal/s.test(aiSource)) {
  throw new Error('Expected internal MCQ generation flow to reschedule itself when readiness is not met.');
}

if (!aiSource.includes('[QuestionBank] retry_scheduled')) {
  throw new Error('Expected MCQ retry scheduling to be logged for observability.');
}

console.log('mcq-background-retry-regression.test.mjs passed');
