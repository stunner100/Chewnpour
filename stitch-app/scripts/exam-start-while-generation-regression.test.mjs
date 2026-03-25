import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const examsPath = path.join(root, 'convex', 'exams.ts');
const [source, examsSource] = await Promise.all([
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(examsPath, 'utf8'),
]);

if (/topicQuestions\.length/.test(source)) {
  throw new Error('Regression detected: ExamMode should not gate start flow on client-side topic question counts.');
}

for (const forbiddenPattern of [
  /generateQuestions\(\{\s*topicId\s*\}\)/,
  /generateEssayQuestions\(\{/,
  /generatingQuestions/,
  /MIN_EXAM_QUESTIONS/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error('Regression detected: ExamMode should not use the old client-side generation gate.');
  }
}

if (!/const startExam = useAction\(api\.exams\.startExamAttempt\);/.test(source)) {
  throw new Error('Expected ExamMode to call the blocking startExamAttempt action.');
}

if (!/topicId[\s\S]*examFormat[\s\S]*beginExamAttempt\(\);/s.test(source)) {
  throw new Error('Expected ExamMode to begin exam preparation immediately after the user chooses a format.');
}

for (const pattern of ['EXAM_QUESTIONS_PREPARING', 'ESSAY_QUESTIONS_PREPARING']) {
  if (!examsSource.includes(pattern)) {
    throw new Error(`Expected convex/exams.ts to preserve structured ${pattern} retry codes.`);
  }
}

for (const throwPattern of [
  /throw new ConvexError\(\{\s*code:\s*"EXAM_QUESTIONS_PREPARING"/,
  /throw new ConvexError\(\{\s*code:\s*"ESSAY_QUESTIONS_PREPARING"/,
]) {
  if (throwPattern.test(examsSource)) {
    throw new Error('Regression detected: startExamAttempt should return a deferred payload for preparing-question states, not throw a server error.');
  }
}

for (const requiredPattern of [
  /deferred:\s*true/,
  /attemptId:\s*null/,
  /questions:\s*\[\]/,
]) {
  if (!requiredPattern.test(examsSource)) {
    throw new Error('Expected startExamAttempt deferred response payload to include deferred state and empty question set.');
  }
}

if (!source.includes('result?.deferred === true') || !source.includes('Exam attempt deferred while question bank prepares')) {
  throw new Error('Expected ExamMode to handle deferred startExamAttempt responses without throwing.');
}

if (/startExam\(\{\s*userId:/.test(source) || /startExam\(userId\s*\?/.test(source)) {
  throw new Error('Expected ExamMode to avoid passing client userId to startExam() and rely on server auth identity.');
}

console.log('exam-start-while-generation-regression.test.mjs passed');
