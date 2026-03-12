import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hookPath = path.join(root, 'src', 'hooks', 'useExamTimer.js');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');

const [hookSource, examModeSource] = await Promise.all([
  fs.readFile(hookPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
]);

for (const snippet of [
  'const setTimeRemaining = useCallback((nextSeconds) => {',
  'endTimeRef.current = Date.now() + safeSeconds * 1000;',
  'setDisplayTime(safeSeconds);',
  'useEffect(() => {',
  'onTimeUpRef.current = onTimeUp;',
  'setTimeRemaining,',
]) {
  if (!hookSource.includes(snippet)) {
    throw new Error(`Expected useExamTimer.js to include "${snippet}" for exam timer resume handling.`);
  }
}

if (!examModeSource.includes('const { timeRemaining, formattedTime, isLowTime, setTimeRemaining } = useExamTimer(')) {
  throw new Error('Expected ExamMode.jsx to consume setTimeRemaining from useExamTimer.');
}

console.log('exam-timer-resume-regression.test.mjs passed');
