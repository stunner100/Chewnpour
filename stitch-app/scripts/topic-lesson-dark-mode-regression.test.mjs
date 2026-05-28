import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const [viewsSource, contentPanelSource] = await Promise.all([
    fs.readFile(path.join(root, 'src/components/topic/TopicLessonViews.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'src/components/topic/TopicContentPanel.jsx'), 'utf8'),
]);

for (const forbidden of [
    "classList.remove('dark')",
    "classList.add('dark')",
    'const hadDark = root.classList.contains',
]) {
    if (viewsSource.includes(forbidden)) {
        throw new Error(`Topic lesson route must not mutate the persisted dark theme with "${forbidden}".`);
    }
}

for (const required of [
    'cp-theme min-h-screen bg-[#FAF8F3]',
    'dark:bg-[#0c0d10]',
    'dark:text-text-primary',
    'bg-ai-subtle p-space-4 font-body-sm text-body-sm leading-relaxed text-text-primary dark:!bg-[#212226] dark:text-text-primary',
]) {
    if (!viewsSource.includes(required)) {
        throw new Error(`Expected topic lesson shell to include "${required}".`);
    }
}

for (const required of [
    'bg-white dark:!bg-[#161719] rounded-3xl border border-border-subtle shadow-soft',
    'group bg-white dark:!bg-[#161719] rounded-3xl border border-border-subtle',
]) {
    if (!contentPanelSource.includes(required)) {
        throw new Error(`Expected topic content panel to include "${required}".`);
    }
}

console.log('topic-lesson-dark-mode-regression.test.mjs passed');
