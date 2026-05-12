import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/StudentDashboard.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Dashboard content should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Dashboard content should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('flex-1 pt-space-6 px-space-8 pb-space-16', 'reduced top padding');
requireIncludes('font-display-md text-display-md text-text-primary tracking-tight', 'compact page greeting');
requireIncludes('font-body-base text-body-base text-text-secondary mt-space-1', 'compact page intro copy');
requireIncludes('p-space-6 flex flex-col justify-between', 'compact resume card padding');
requireIncludes('font-display-sm text-display-sm text-text-primary mb-space-2 leading-tight line-clamp-2', 'compact resume card title');
requireIncludes('font-body-sm text-body-sm text-text-secondary max-w-md line-clamp-2', 'compact resume card subtitle');
requireIncludes('font-headline-sm text-headline-sm text-text-primary mb-space-2">Upload Material', 'compact upload card heading');
requireIncludes('font-body-base text-body-base font-bold text-text-primary">Course Progress', 'compact section heading');
requireIncludes('font-body-base text-body-base font-bold text-text-primary">Recent Materials', 'compact recent materials heading');

requireExcludes('font-display-lg text-display-lg text-text-primary tracking-tight">Good morning', 'oversized page greeting');
requireExcludes('font-display-md text-display-md text-text-primary mb-space-2 leading-tight line-clamp-2', 'oversized resume title');
requireExcludes('font-headline-md text-headline-md text-text-primary mb-space-2">Upload Material', 'oversized upload card heading');

console.log('dashboard-content-density-regression.test.mjs passed');
