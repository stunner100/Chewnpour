import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const examModeSource = await read('src/pages/ExamMode.jsx');

for (const pattern of [
  "const [submitError, setSubmitError] = useState('');",
  'const MIN_ESSAY_SUBMIT_CHAR_COUNT = 1;',
  'const answeredQuestionCount = examFormat === \'essay\'',
  'const isEssaySubmitBlocked = examFormat === \'essay\' && answeredQuestionCount < questions.length;',
  'setSubmitError(\'\');',
  'Please answer all essay questions before submitting.',
  'resolveConvexActionError(',
  'isUserCorrectableEssaySubmitError(message)',
  '{submitError && (',
  "Failed to submit essay exam:",
  '[topicId, userId, examFormat, topicQuestions.length, startExam, START_EXAM_ATTEMPT_TIMEOUT_MS]',
]) {
  if (!examModeSource.includes(pattern)) {
    throw new Error(`Expected ExamMode.jsx to include "${pattern}".`);
  }
}

const examsSource = await read('convex/exams.ts');

for (const pattern of [
  'import { ConvexError, v } from "convex/values";',
  'export const getEssayAttemptSubmissionContext = query({',
  'api.exams.getEssayAttemptSubmissionContext',
  'const failEssaySubmission = (message: string, code = "ESSAY_SUBMISSION_INVALID"): never => {',
  'Please answer all essay questions before submitting.',
  'const requiredQuestionCount = Number(attempt.totalQuestions || 0) > 0',
  'This exam session is out of sync. Please restart the exam in Essay mode.',
  'if (gradeResult?.ungraded) {',
  'ESSAY_GRADING_UNAVAILABLE',
  'if (error instanceof ConvexError) {',
  'code: "ESSAY_SUBMISSION_FAILED"',
]) {
  if (!examsSource.includes(pattern)) {
    throw new Error(`Expected convex/exams.ts to include "${pattern}".`);
  }
}

if (examsSource.includes('api.topics.getTopicWithQuestions')) {
  throw new Error('Expected submitEssayExam to avoid client-sanitized topic question query during grading.');
}

const aiSource = await read('convex/ai.ts');

for (const pattern of [
  'score: null,',
  'ungraded: true,',
  'Unable to grade automatically right now. Please retry submission.',
]) {
  if (!aiSource.includes(pattern)) {
    throw new Error(`Expected convex/ai.ts to include "${pattern}".`);
  }
}

if (aiSource.includes('score: studentAnswer.trim().length >= 20 ? 3 : 0')) {
  throw new Error('Expected gradeEssayAnswer fallback to avoid auto-credit scoring.');
}

console.log('exam-essay-submit-resilience-regression.test.mjs passed');
