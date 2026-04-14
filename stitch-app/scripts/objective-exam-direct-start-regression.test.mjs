import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

for (const forbiddenSnippet of [
  'const [examConfigStep, setExamConfigStep] = useState(false)',
  'Quick Test',
  'Standard',
  'Full Exam',
  'Hard Only',
  "setExamConfigStep(true)",
  "setExamConfigStep(false)",
]) {
  if (source.includes(forbiddenSnippet)) {
    throw new Error(`Regression detected: removed objective exam config UI resurfaced: ${forbiddenSnippet}`);
  }
}

if (!source.includes("setExamFormat('mcq');")) {
  throw new Error('Expected Objective Quiz CTA to start MCQ mode immediately.');
}

if (!source.includes('Choose Exam Format')) {
  throw new Error('Expected ExamMode to preserve the top-level format chooser.');
}

console.log('objective-exam-direct-start-regression.test.mjs passed');
