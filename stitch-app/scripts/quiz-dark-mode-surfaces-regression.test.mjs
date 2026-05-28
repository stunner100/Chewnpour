import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
    activeSessionSource,
    loadingShellSource,
    resultsSource,
    topicQuizPanelSource,
] = await Promise.all([
    read('src/components/ExamActiveSession.jsx'),
    read('src/components/ExamLoadingShell.jsx'),
    read('src/pages/DashboardResults.jsx'),
    read('src/components/topic/TopicQuizPanel.jsx'),
]);

for (const [label, source] of [
    ['ExamActiveSession', activeSessionSource],
    ['ExamLoadingShell', loadingShellSource],
    ['DashboardResults', resultsSource],
]) {
    if (source.includes('cp-theme bg-[#FAF8F3] min-h-screen')) {
        throw new Error(`${label} still has a light-only cp-theme shell.`);
    }
    if (!source.includes('bg-[#FAF8F3] dark:!bg-[#0c0d10]')) {
        throw new Error(`${label} must keep the light shell only in light mode and force the dark shell in dark mode.`);
    }
}

if (!topicQuizPanelSource.includes('bg-white dark:!bg-[#161719] rounded-3xl border border-border-subtle')) {
    throw new Error('TopicQuizPanel must not render a white card in dark mode.');
}

console.log('quiz-dark-mode-surfaces-regression.test.mjs passed');
