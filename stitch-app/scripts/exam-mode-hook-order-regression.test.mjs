import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(filePath, 'utf8');

const firstGuardIndex = source.indexOf('if (!topicId) {');
if (firstGuardIndex === -1) {
  throw new Error('Could not locate the first guard return in ExamMode.jsx');
}

const useMemoIndex = source.indexOf('const finalOptions = useMemo(');
if (useMemoIndex === -1) {
  throw new Error('Expected finalOptions to be memoized with useMemo in ExamMode.jsx');
}

if (useMemoIndex > firstGuardIndex) {
  throw new Error('Regression: useMemo for finalOptions appears after conditional return guards and can break hook order.');
}

if (!source.includes('const progress = questions.length > 0')) {
  throw new Error('Expected progress calculation to guard against zero questions.');
}

console.log('exam-mode-hook-order-regression.test.mjs passed');
