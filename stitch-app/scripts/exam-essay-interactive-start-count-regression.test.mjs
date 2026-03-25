import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const examsPath = path.join(root, 'convex', 'exams.ts');
const aiPath = path.join(root, 'convex', 'ai.ts');
const [source, examsSource, aiSource] = await Promise.all([
  fs.readFile(examModePath, 'utf8'),
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
]);

if (source.includes('ESSAY_EXAM_INTERACTIVE_START_COUNT')) {
  throw new Error('Regression detected: ExamMode should not keep the old reduced essay interactive start count.');
}

if (/generateEssayQuestions\(\{/.test(source)) {
  throw new Error('Regression detected: ExamMode should not generate essay questions directly from the format picker.');
}

if (!/setExamFormat\('essay'\)/.test(source)) {
  throw new Error('Expected ExamMode to let the user pick essay format inside the exam flow.');
}

if (!/generateEssayQuestionsForTopicOnDemandInternal/.test(examsSource)) {
  throw new Error('Expected blocking exam starts to rely on the backend on-demand essay generator.');
}

if (!/const ESSAY_QUESTION_TARGET_MAX_COUNT = 15;/.test(aiSource)) {
  throw new Error('Expected essay generation to support the full 15-question exam cap.');
}

console.log('exam-essay-interactive-start-count-regression.test.mjs passed');
