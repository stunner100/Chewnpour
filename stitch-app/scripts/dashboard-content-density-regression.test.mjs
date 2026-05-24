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

requireIncludes('student-dashboard flex-1 pt-space-6 px-space-6 md:px-space-8 pb-space-16', 'responsive page padding');
requireIncludes('font-display-md text-display-md text-text-primary tracking-tight', 'compact page greeting');
requireIncludes('font-body-base text-body-base text-text-secondary mt-space-1', 'compact page intro copy');
requireIncludes('font-display-sm text-display-sm text-text-primary leading-tight', 'compact resume title');
requireIncludes('font-body-sm text-body-sm text-text-secondary mt-space-2 max-w-xl line-clamp-2', 'compact resume subtitle');
requireIncludes('font-headline-sm text-headline-sm text-text-primary">Course progress', 'compact section heading');
requireIncludes('font-headline-sm text-headline-sm text-text-primary">Recent materials', 'compact recent materials heading');
requireIncludes('focus-visible:ring-2 focus-visible:ring-primary-soft', 'keyboard focus rings');

requireExcludes('font-display-lg text-display-lg text-text-primary tracking-tight">Good morning', 'oversized page greeting');
requireExcludes('uppercase tracking-wider', 'uppercase stat eyebrows');
requireExcludes('smart_toy', 'decorative AI watermark');
requireExcludes('border-2 border-dashed', 'dashed upload hero tile');

console.log('dashboard-content-density-regression.test.mjs passed');
