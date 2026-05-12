import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const adminSource = await fs.readFile(path.join(root, 'convex', 'admin.ts'), 'utf8');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include "${snippet}".`);
  }
};

requireIncludes(
  adminSource,
  'export const listMissingStudyContentBackfillCandidatesInternal = internalQuery({',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'export const scheduleMissingStudyContentBackfill = action({',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'const dryRun = args.dryRun !== false;',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'if (!access.allowlistConfigured || !access.isAllowed)',
  'admin.ts',
);
requireIncludes(
  adminSource,
  '(api as any).ai.processUploadedFile',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'internal.ai.retryAssessmentGapFillInternal',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'internal.topics.refreshTopicExamReadinessInternal',
  'admin.ts',
);
requireIncludes(
  adminSource,
  'reason: "admin_missing_study_content_backfill"',
  'admin.ts',
);
requireExcludes(
  adminSource,
  'convex.cloud',
  'admin.ts',
);

console.log('missing-study-content-backfill-regression.test.mjs passed');
