import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/StudyProgressMastery.jsx'), 'utf8');
const cssSource = await fs.readFile(path.join(root, 'src/index.css'), 'utf8');

const requireIncludes = (snippet, label) => {
    if (!source.includes(snippet)) {
        throw new Error(`Expected StudyProgressMastery.jsx to include ${label}.`);
    }
};

requireIncludes(
    'progress-next-card bg-ai-subtle dark:!bg-[#161719] shadow-sm rounded-xl',
    'explicit dark next-up card surface classes',
);
requireIncludes(
    'progress-course-row rounded-xl border border-border-subtle bg-surface-soft/60 dark:!bg-[#212226] p-space-4',
    'explicit dark course progress row surface classes',
);
requireIncludes(
    'font-label-md text-label-md text-text-primary line-clamp-1',
    'high-contrast course progress title text',
);
requireIncludes(
    'font-body-base text-body-base text-text-secondary mb-6',
    'readable next-up body text',
);

if (!cssSource.includes('.dark .cp-theme .progress-next-card')) {
    throw new Error('Expected index.css to include a dark Progress next-up selector.');
}

if (!cssSource.includes('.dark .cp-theme .progress-course-row')) {
    throw new Error('Expected index.css to include a dark Progress course row selector.');
}

console.log('progress-dark-mode-contrast-regression.test.mjs passed');
