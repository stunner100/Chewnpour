import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

if (!source.includes('const ESSAY_EXAM_INTERACTIVE_START_COUNT = 3;')) {
  throw new Error('Expected ExamMode to define ESSAY_EXAM_INTERACTIVE_START_COUNT as 3.');
}

if (!source.includes("await generateEssayQuestions({ topicId, count: ESSAY_EXAM_INTERACTIVE_START_COUNT });")) {
  throw new Error('Expected essay format selection to request only interactive start count.');
}

if (source.includes("await generateEssayQuestions({ topicId, count: ESSAY_EXAM_QUESTION_CAP });")) {
  throw new Error('Regression detected: essay format selection should not request full ESSAY_EXAM_QUESTION_CAP.');
}

console.log('exam-essay-interactive-start-count-regression.test.mjs passed');
