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

if (/if \(!topicId \|\| topicQuestions\.length === 0\) return;/.test(source)) {
  throw new Error('Regression detected: beginExamAttempt should not block exam start when the bank is empty.');
}

if (/topicQuestions\.length\s*>=\s*MIN_EXAM_QUESTIONS/.test(source)) {
  throw new Error('Regression detected: ExamMode should not gate format selection or exam start on local question count.');
}

for (const removedScreen of ['No questions yet', 'Preparing question bank']) {
  if (source.includes(removedScreen)) {
    throw new Error(`Regression detected: ExamMode should stay in loading mode instead of rendering "${removedScreen}".`);
  }
}

if (!/Pick a format and we(?:&apos;|')ll generate the exam on demand\./.test(source)) {
  throw new Error('Expected ExamMode chooser copy to explain on-demand exam generation.');
}

for (const pattern of ['OBJECTIVE_QUESTIONS_PREPARING', 'ESSAY_QUESTIONS_PREPARING']) {
  if (!examsSource.includes(pattern)) {
    throw new Error(`Expected convex/exams.ts to preserve structured ${pattern} retry codes.`);
  }
}

for (const throwPattern of [
  /throw new ConvexError\(\{\s*code:\s*"OBJECTIVE_QUESTIONS_PREPARING"/,
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

if (!source.includes('isAutoRetryableStartError(startExamError)')) {
  throw new Error('Expected ExamMode to keep recoverable start errors inside the loading state.');
}

if (source.includes('Exam setup is taking longer than expected. Tap Retry.')) {
  throw new Error('Regression detected: timed-out exam starts should keep retrying automatically instead of forcing manual retry.');
}

if (!/We(?:&apos;|')ll keep loading until your questions are ready\./.test(source)) {
  throw new Error('Expected loading state copy to promise continuous exam preparation.');
}

if (/startExam\(userId\s*\?/.test(source)) {
  throw new Error('Expected ExamMode to avoid passing client userId to startExam() and rely on server auth identity.');
}

console.log('exam-start-while-generation-regression.test.mjs passed');
