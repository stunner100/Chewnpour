import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const [scaleToZeroSpec, liveAppSpec, adminSource] = await Promise.all([
  read('../.do/app.scale-to-zero.yaml'),
  read('../.do/app.yaml'),
  read('convex/admin.ts'),
]);

if (liveAppSpec.includes('inactivity_sleep:')) {
  throw new Error('Default DigitalOcean App Platform spec must stay deployable until scale-to-zero is enabled.');
}

const requiredScaleToZeroSpecSnippets = [
  'inactivity_sleep:',
  'after_seconds: 600',
];

for (const snippet of requiredScaleToZeroSpecSnippets) {
  if (!scaleToZeroSpec.includes(snippet)) {
    throw new Error(`Expected Docling scale-to-zero spec to include "${snippet}".`);
  }
}

const requiredAdminSnippets = [
  'export const cleanupDisposableE2EAccounts = mutation({',
  'args.dryRun !== false',
  'Cleanup is restricted to disposable gate_*@example.com accounts.',
  'isDisposableE2EEmail',
  'DISPOSABLE_E2E_EMAIL_DOMAIN = "example.com"',
  'DISPOSABLE_E2E_EMAIL_PREFIX = "gate_"',
  'const adminGuard = await requireAdminAccess(ctx);',
  'cleanupDisposableUserData(ctx, candidate.userId, dryRun)',
  'export const stripEvidenceEmbeddingPayloads = mutation({',
  'export const stripEvidenceEmbeddingPayloadsForUpload = mutation({',
  'export const scheduleLexicalEvidenceRematerialization = action({',
  'grounded.materializeEvidencePassagesForUpload',
  '"evidencePassages"',
  '"searchDocuments"',
  '"questions"',
];

for (const snippet of requiredAdminSnippets) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin cleanup control to include "${snippet}".`);
  }
}

console.log('scale-down-controls-regression.test.mjs passed');
