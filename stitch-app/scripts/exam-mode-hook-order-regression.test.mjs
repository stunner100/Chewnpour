import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(filePath, 'utf8');

const firstReturnIndex = source.indexOf('if (questions.length) {');
if (firstReturnIndex === -1) {
  throw new Error('Could not locate the live-exam return in ExamMode.jsx');
}

const lastHookIndex = Math.max(
  source.lastIndexOf('useEffect(', firstReturnIndex),
  source.lastIndexOf('useCallback(', firstReturnIndex),
  source.lastIndexOf('useMemo(', firstReturnIndex),
  source.lastIndexOf('useExamTimer(', firstReturnIndex),
  source.lastIndexOf('useMobileChrome(', firstReturnIndex),
);

if (lastHookIndex > firstReturnIndex) {
  throw new Error('Regression: a hook appears after the live-exam return and can break hook order.');
}

if (!source.includes('setImmersiveMobile(questions.length > 0)')) {
  throw new Error('Expected immersive chrome to follow question availability without an extra early return.');
}

console.log('exam-mode-hook-order-regression.test.mjs passed');
