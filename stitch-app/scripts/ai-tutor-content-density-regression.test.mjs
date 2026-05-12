import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/pages/AIStudyTutor.jsx'), 'utf8');

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`AI tutor should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`AI tutor should avoid ${label}: ${snippet}`);
  }
};

requireIncludes('p-space-4 md:p-space-6 max-w-container-max', 'compact page padding');
requireIncludes('mb-space-6 gap-4', 'compact header spacing');
requireIncludes('font-display-md text-display-md text-text-primary">AI Tutor', 'compact page title');
requireIncludes('font-body-sm text-body-sm text-text-secondary mt-1 max-w-xl', 'compact subtitle');
requireIncludes('overflow-y-auto p-space-5 flex flex-col gap-space-6', 'compact message list spacing');
requireIncludes('rounded-2xl p-space-4 shadow-sm border', 'compact chat bubbles');
requireIncludes('font-body-sm text-body-sm text-text-primary whitespace-pre-wrap', 'compact chat message text');
requireIncludes('font-body-sm text-body-sm text-text-primary placeholder:text-text-muted min-h-[44px]', 'compact composer text');

requireExcludes('font-display-lg text-display-lg text-text-primary">AI Tutor', 'oversized page title');
requireExcludes('font-body-base text-body-base text-text-primary whitespace-pre-wrap', 'oversized chat message text');
requireExcludes('font-body-base text-body-base text-text-primary placeholder:text-text-muted min-h-[48px]', 'oversized composer text');

console.log('ai-tutor-content-density-regression.test.mjs passed');
