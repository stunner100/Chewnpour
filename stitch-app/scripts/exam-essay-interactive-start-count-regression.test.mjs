import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

if (source.includes('ESSAY_EXAM_INTERACTIVE_START_COUNT')) {
  throw new Error('Regression detected: ExamMode should not keep a special essay interactive prewarm count.');
}

if (/generateEssayQuestions\(\{ topicId/.test(source)) {
  throw new Error('Regression detected: essay format selection should not directly trigger question generation.');
}

if (!/setExamFormat\('essay'\);/.test(source)) {
  throw new Error('Expected essay format selection to rely on startExamAttempt after setting examFormat.');
}

console.log('exam-essay-interactive-start-count-regression.test.mjs passed');
