import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
    examModeSource,
    useExamAttemptSource,
    examActiveSessionSource,
    examGradingOverlaySource,
    examModeStateSource,
] = await Promise.all([
    read('src/pages/ExamMode.jsx'),
    read('src/hooks/useExamAttempt.js'),
    read('src/components/ExamActiveSession.jsx'),
    read('src/components/ExamGradingOverlay.jsx'),
    read('src/lib/examModeState.js'),
]);

const examModeLines = examModeSource.split('\n').length;
if (examModeLines > 500) {
    throw new Error(`Expected ExamMode.jsx to stay under 500 lines, got ${examModeLines}.`);
}

for (const [label, source, snippet] of [
    ['ExamMode', examModeSource, 'useExamAttempt'],
    ['ExamMode', examModeSource, 'ExamActiveSession'],
    ['ExamMode', examModeSource, 'ExamGradingOverlay'],
    ['ExamMode', examModeSource, 'examModeReducer'],
    ['useExamAttempt', useExamAttemptSource, 'beginExamAttempt'],
    ['useExamAttempt', useExamAttemptSource, 'handleSubmit'],
    ['ExamActiveSession', examActiveSessionSource, 'ExamQuestionCard'],
    ['ExamGradingOverlay', examGradingOverlaySource, 'Grading Your Answers'],
    ['examModeState', examModeStateSource, 'preparationSucceeded'],
]) {
    if (!source.includes(snippet)) {
        throw new Error(`Expected ${label} to include "${snippet}".`);
    }
}

if (examModeSource.includes('const examModeReducer =')) {
    throw new Error('ExamMode should not define examModeReducer inline.');
}

if (examActiveSessionSource.includes('useExamTimer')) {
    throw new Error('ExamActiveSession should remain presentational.');
}

console.log('exam-active-session-regression.test.mjs passed');
