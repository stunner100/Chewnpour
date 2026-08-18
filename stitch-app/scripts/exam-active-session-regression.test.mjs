import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const examModeSource = await read('src/pages/ExamMode.jsx');
const examActiveSessionSource = await read('src/components/ExamActiveSession.jsx');

if (examModeSource.includes("from '../components/ExamActiveSession'")) {
    throw new Error('ExamMode must not import unused ExamActiveSession chrome.');
}

for (const snippet of [
    'sticky top-0',
    'sticky bottom-0',
    'to="/dashboard/exam"',
    'min-h-11',
    'setImmersiveMobile',
]) {
    if (!examModeSource.includes(snippet)) {
        throw new Error(`Expected ExamMode live chrome to include "${snippet}".`);
    }
}

if (examActiveSessionSource.includes('useExamTimer')) {
    throw new Error('ExamActiveSession should remain presentational.');
}

console.log('exam-active-session-regression.test.mjs passed');
