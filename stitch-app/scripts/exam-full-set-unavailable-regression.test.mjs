import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsPath = path.join(root, 'convex', 'exams.ts');
const preparationsPath = path.join(root, 'convex', 'examPreparations.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const questionBankConfigPath = path.join(root, 'convex', 'lib', 'questionBankConfig.js');

const [examsSource, preparationsSource, examModeSource, questionBankConfigSource] = await Promise.all([
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(preparationsPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(questionBankConfigPath, 'utf8'),
]);

if (!/export const QUESTION_BANK_INTERACTIVE_PROFILE = resolveQuestionBankProfile\(\{[\s\S]*minTarget:\s*1,[\s\S]*maxTarget:\s*35,/m.test(questionBankConfigSource)) {
  throw new Error('Expected on-demand MCQ generation to stay content-driven instead of reverting to a fixed exam size.');
}

if (!/allowPartialReady:\s*v\.optional\(v\.boolean\(\)\)/.test(examsSource)) {
  throw new Error('Expected exams.ts to support a partial-ready override after on-demand generation.');
}

if (!/FRESH_CONTEXT_START_REQUIRED/.test(preparationsSource)) {
  throw new Error('Expected examPreparations.ts to explicitly handle fresh-context starts.');
}

if (!/generateFreshExamSnapshotInternal/.test(preparationsSource) || !/createFreshExamAttemptInternal/.test(preparationsSource)) {
  throw new Error('Expected examPreparations.ts to generate and persist a fresh snapshot when no prepared attempt exists.');
}

if (/Full Exam Not Available/.test(examModeSource)) {
  throw new Error('Expected ExamMode.jsx to stop presenting unavailable exams as a failed full-exam requirement.');
}

if (/full multiple-choice exam|full essay exam/i.test(preparationsSource)) {
  throw new Error('Expected unavailable preparation messages to stop requiring a full exam when partial grounded questions are allowed.');
}

if (!/ExamPreparationLoader/.test(examModeSource)) {
  throw new Error('Expected ExamMode.jsx to route unavailable preparation states through the shared preparation loader.');
}

console.log('exam-full-set-unavailable-regression.test.mjs passed');
