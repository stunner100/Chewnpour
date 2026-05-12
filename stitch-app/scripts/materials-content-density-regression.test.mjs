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

requireIncludes('gap-space-6 p-space-6 md:p-space-8', 'compact page spacing');
requireIncludes('font-display-md text-display-md text-text-primary mb-1">My Materials', 'compact page title');
requireIncludes('font-body-sm text-body-sm text-text-secondary', 'compact subtitle');
requireIncludes('px-3.5 py-2 rounded-lg font-label-sm text-label-sm', 'compact filter tabs');
requireIncludes('rounded-xl p-space-4 shadow-sm flex flex-col', 'compact material card padding');
requireIncludes('font-body-base text-body-base font-bold text-text-primary mb-1 line-clamp-2', 'compact material card title');
requireIncludes('text-caption font-medium text-text-muted mb-5', 'compact upload timestamp');
requireIncludes('font-label-sm text-label-sm hover:bg-primary-hover', 'compact card CTA');

requireExcludes('font-display-lg text-display-lg text-text-primary mb-2">My Materials', 'oversized page title');
requireExcludes('font-headline-sm text-headline-sm text-text-primary mb-1 line-clamp-2', 'oversized material card title');
requireExcludes('font-label-md text-label-md shadow-sm transition-all', 'oversized filter tabs');

console.log('materials-content-density-regression.test.mjs passed');
