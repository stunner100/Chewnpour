import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsPath = path.join(root, 'convex', 'exams.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const questionBankConfigPath = path.join(root, 'convex', 'lib', 'questionBankConfig.js');

const [examsSource, examModeSource, questionBankConfigSource] = await Promise.all([
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(questionBankConfigPath, 'utf8'),
]);

if (!/export const QUESTION_BANK_INTERACTIVE_PROFILE = resolveQuestionBankProfile\(\{[\s\S]*minTarget:\s*1,[\s\S]*maxTarget:\s*35,/m.test(questionBankConfigSource)) {
  throw new Error('Expected on-demand MCQ generation to use a content-driven target range instead of a fixed exam size.');
}

for (const code of ['EXAM_FULL_EXAM_UNAVAILABLE', 'ESSAY_FULL_EXAM_UNAVAILABLE']) {
  if (!examsSource.includes(code)) {
    throw new Error(`Expected exams.ts to return ${code} when a full exam cannot be prepared.`);
  }
  if (!examModeSource.includes(code)) {
    throw new Error(`Expected ExamMode.jsx to handle ${code} terminal start states.`);
  }
}

if (!/generation_already_in_progress/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to preserve a deferred response when generation is already in progress elsewhere.');
}

if (!/buildUnavailableStartResponse/.test(examsSource) || !/resolveUnavailableStartMessage/.test(examsSource)) {
  throw new Error('Expected exams.ts to build a non-deferred full-exam unavailable response after on-demand generation finishes.');
}

if (!/Exam Not Available/.test(examModeSource)) {
  throw new Error('Expected ExamMode.jsx to render a stable unavailable state for terminal exam-start failures.');
}

console.log('exam-full-set-unavailable-regression.test.mjs passed');
