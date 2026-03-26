import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const examPreparationsPath = path.join(root, 'convex', 'examPreparations.ts');
const [source, preparationsSource] = await Promise.all([
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(examPreparationsPath, 'utf8'),
]);

if (/topicQuestions\.length/.test(source)) {
  throw new Error('Regression detected: ExamMode should not gate start flow on client-side topic question counts.');
}

for (const forbiddenPattern of [
  /generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateEssayQuestions\(\{/,
  /generatingQuestions/,
  /MIN_EXAM_QUESTIONS/,
  /api\.exams\.startExamAttempt/,
  /result\?\.deferred === true/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error('Regression detected: ExamMode should use the preparation state machine, not the old blocking start flow.');
  }
}

if (!/const startExamPreparation = useAction\(api\.examPreparations\.startExamPreparation\);/.test(source)) {
  throw new Error('Expected ExamMode to call examPreparations.startExamPreparation.');
}

if (!/const preparation = useQuery\(\s*api\.examPreparations\.getExamPreparation,/s.test(source)) {
  throw new Error('Expected ExamMode to subscribe to exam preparation status.');
}

if (!/setPreparationId\(result\.preparationId\);/.test(source)) {
  throw new Error('Expected ExamMode to retain the returned preparationId for live status updates.');
}

if (!/preparation\.status === 'ready'/.test(source) || !/preparation\.status === 'failed' \|\| preparation\.status === 'unavailable'/.test(source)) {
  throw new Error('Expected ExamMode to react to ready and terminal preparation states.');
}

if (!/topicId[\s\S]*examFormat[\s\S]*!preparationId[\s\S]*beginExamAttempt\(\);/s.test(source)) {
  throw new Error('Expected ExamMode to start preparation immediately after the user chooses a format.');
}

for (const requiredPattern of [
  /export const startExamPreparation = action/,
  /export const getExamPreparation = query/,
  /export const retryExamPreparation = mutation/,
  /export const runExamPreparationInternal = internalAction/,
]) {
  if (!requiredPattern.test(preparationsSource)) {
    throw new Error('Expected convex/examPreparations.ts to expose the preparation lifecycle.');
  }
}

console.log('exam-start-while-generation-regression.test.mjs passed');
