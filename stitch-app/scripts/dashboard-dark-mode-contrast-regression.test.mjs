import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/StudentDashboard.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
    if (!source.includes(snippet)) {
        throw new Error(`Expected StudentDashboard.jsx to include ${label}.`);
    }
};

requireIncludes(
    'bg-surface-soft/60 dark:bg-surface px-space-4 py-space-4 hover:bg-surface dark:hover:bg-surface-variant',
    'dark quick-action card surface classes',
);
requireIncludes(
    'bg-ai-subtle dark:bg-surface border border-border-subtle',
    'dark recommended-next surface classes',
);
requireIncludes(
    'font-label-md text-label-md text-text-primary whitespace-nowrap',
    'high-contrast quick-action label text',
);
requireIncludes(
    'font-body-sm text-body-sm text-text-secondary mb-space-4',
    'readable recommended-next description text',
);

console.log('dashboard-dark-mode-contrast-regression.test.mjs passed');
