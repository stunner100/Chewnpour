import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

if (!source.includes('const resolveAutostartExamFormat = (search) => {')) {
  throw new Error('Expected ExamMode to derive the requested autostart format from the URL.');
}

if (!source.includes("if (raw === 'essay') return 'essay';") || !source.includes("if (raw === 'mcq' || raw === 'objective' || raw === 'quiz') return 'mcq';")) {
  throw new Error('Expected ExamMode to support direct objective and essay autostart formats.');
}

if (!source.includes('examFormat: resolveAutostartExamFormat(search),')) {
  throw new Error('Expected ExamMode initial route state to autostart when the URL provides a format.');
}

if (!source.includes('dispatchExamState({ type: \'resetForRoute\', search: routerLocation.search });')) {
  throw new Error('Expected ExamMode to reset autostart state when the route search changes.');
}

if (!source.includes('if (!examFormat && !examStarted && !startingExamAttempt && !hasAttemptQuestions)')) {
  throw new Error('Expected ExamMode to show the format picker only when no autostart format is present.');
}

console.log('exam-mode-direct-autostart-regression.test.mjs passed');
