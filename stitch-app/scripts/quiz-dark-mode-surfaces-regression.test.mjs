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
]) {
    for (const forbidden of [
        "classList.remove('dark')",
        "classList.add('dark')",
        'const hadDark = root.classList.contains',
    ]) {
        if (source.includes(forbidden)) {
            throw new Error(`${label} must not mutate the persisted dark theme with "${forbidden}".`);
        }
    }
    if (source.includes('cp-theme bg-[#FAF8F3] min-h-screen')) {
        throw new Error(`${label} still has a light-only cp-theme shell.`);
    }
    if (!source.includes('bg-[#FAF8F3] dark:!bg-[#0c0d10]')) {
        throw new Error(`${label} must keep the light shell only in light mode and force the dark shell in dark mode.`);
    }
}

// DashboardResults uses theme tokens (bg-background-light / bg-surface) that
// are dark-mode aware by design, so it needs no literal light/dark shell — but
// it must not mutate the persisted theme or hardcode a light-only surface.
for (const forbidden of [
    "classList.remove('dark')",
    "classList.add('dark')",
    'const hadDark = root.classList.contains',
    'cp-theme bg-[#FAF8F3] min-h-screen',
]) {
    if (resultsSource.includes(forbidden)) {
        throw new Error(`DashboardResults must not use "${forbidden}".`);
    }
}
if (!resultsSource.includes('bg-background-light') || !resultsSource.includes('bg-surface')) {
    throw new Error('DashboardResults must use theme-token surfaces (bg-background-light / bg-surface).');
}

if (topicQuizPanelSource.includes('bg-white rounded-3xl') && !topicQuizPanelSource.includes('dark:!bg-[#161719]')) {
    throw new Error('TopicQuizPanel must not render a light-only white card in dark mode.');
}

console.log('quiz-dark-mode-surfaces-regression.test.mjs passed');
