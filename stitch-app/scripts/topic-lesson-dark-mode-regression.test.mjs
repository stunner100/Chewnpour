import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const [viewsSource, contentPanelSource, cssSource] = await Promise.all([
    fs.readFile(path.join(root, 'src/components/topic/TopicLessonViews.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'src/components/topic/TopicContentPanel.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'src/index.css'), 'utf8'),
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
    'bg-background-light',
    'text-text-primary',
    'Open tutor chat',
    'LessonTOC',
]) {
    if (!viewsSource.includes(required)) {
        throw new Error(`Expected topic lesson shell to include "${required}".`);
    }
}

for (const required of [
    'max-w-[65ch]',
    'Preparing your lesson',
    'Guided study path',
]) {
    if (!contentPanelSource.includes(required)) {
        throw new Error(`Expected topic content panel to include "${required}".`);
    }
}

for (const required of [
    '.dark .cp-theme .bg-error-soft',
    '.dark .cp-theme .bg-success-soft',
    '.dark .cp-theme .bg-warning-soft',
]) {
    if (!cssSource.includes(required)) {
        throw new Error(`Expected dark theme remaps to include "${required}".`);
    }
}

console.log('topic-lesson-dark-mode-regression.test.mjs passed');
