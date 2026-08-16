import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/MyMaterialsLibrary.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Materials library should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Materials library should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('px-4 py-8 md:px-8 md:py-10', 'compact page spacing');
requireIncludes('font-display text-display-md font-bold tracking-[-0.02em] text-text-primary', 'compact page title');
requireIncludes('mt-2 max-w-xl text-pretty text-body-md text-text-secondary', 'compact subtitle');
requireIncludes('rounded-full px-4 py-2 text-body-sm font-semibold', 'compact filter tabs');
requireIncludes('rounded-[24px] border border-border-subtle bg-surface p-5', 'compact material card padding');
requireIncludes('line-clamp-2 font-display text-display-sm font-bold text-text-primary', 'compact material card title');
requireIncludes('mt-1 text-caption font-medium text-text-muted', 'compact upload timestamp');
requireIncludes('btn-primary inline-flex w-full min-h-11', 'compact card CTA');

requireExcludes('font-display-lg text-display-lg text-text-primary mb-2">My Materials', 'oversized page title');
requireExcludes('font-headline-sm text-headline-sm text-text-primary mb-1 line-clamp-2', 'oversized material card title');
requireExcludes('font-label-md text-label-md shadow-sm transition-all', 'oversized filter tabs');

console.log('materials-content-density-regression.test.mjs passed');
