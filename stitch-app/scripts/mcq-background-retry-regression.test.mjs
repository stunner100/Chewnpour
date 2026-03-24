import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

for (const constantName of [
  'OBJECTIVE_QUESTION_BACKGROUND_RETRY_DELAY_MS',
  'OBJECTIVE_QUESTION_BACKGROUND_MAX_RETRIES',
]) {
  if (!aiSource.includes(`const ${constantName}`)) {
    throw new Error(`Expected convex/ai.ts to define ${constantName}.`);
  }
}

if (!/generateQuestionsForTopicInternal = internalAction\(\{[\s\S]*retryAttempt: v\.optional\(v\.number\(\)\)/s.test(aiSource)) {
  throw new Error('Expected internal objective generation action args to include retryAttempt.');
}

if (!/const shouldRetry =[\s\S]*OBJECTIVE_QUESTION_BACKGROUND_MAX_RETRIES/s.test(aiSource)) {
  throw new Error('Expected internal objective generation flow to compute bounded retry eligibility.');
}

if (!/ctx\.scheduler\.runAfter\([\s\S]*internal\.ai\.generateQuestionsForTopicInternal/s.test(aiSource)) {
  throw new Error('Expected internal objective generation flow to reschedule itself when readiness is not met.');
}

if (!aiSource.includes('[QuestionBank] retry_scheduled')) {
  throw new Error('Expected objective retry scheduling to be logged for observability.');
}

console.log('mcq-background-retry-regression.test.mjs passed');
