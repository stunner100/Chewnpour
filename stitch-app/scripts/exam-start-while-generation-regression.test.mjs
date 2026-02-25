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

const startsExamWithEnoughQuestions = /topicQuestions\.length\s*>=\s*MIN_EXAM_QUESTIONS/.test(source);
if (!startsExamWithEnoughQuestions) {
  throw new Error('Expected ExamMode start effect to gate on topicQuestions.length >= MIN_EXAM_QUESTIONS.');
}

if (/!generatingQuestions\s*&&\s*!startExamError/.test(source)) {
  throw new Error('Regression detected: exam start is blocked by generatingQuestions, which can stall exam initialization.');
}

if (/topicQuestions\.length\s*>\s*0\s*&&\s*topicQuestions\.length\s*<\s*MIN_EXAM_QUESTIONS/.test(source)) {
  throw new Error('Regression detected: auto-generation ignores 0-question topics and can leave exam setup stuck.');
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

if (/startExam\(userId\s*\?/.test(source)) {
  throw new Error('Expected ExamMode to avoid passing client userId to startExam() and rely on server auth identity.');
}

console.log('exam-start-while-generation-regression.test.mjs passed');
