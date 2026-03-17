import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  await fs.readFile(path.join(root, relativePath), 'utf8');

const componentLookupExpectations = [
  {
    path: 'convex/admin.ts',
    required: ['field: "_id"', 'String(user?._id || "").trim()', 'const subjectAuthUserId = normalizeUserIdCandidate(identity?.subject);'],
  },
  {
    path: 'convex/emails.ts',
    required: ['field: "_id"', 'String(authUser?._id || "").trim()'],
  },
  {
    path: 'convex/productResearch.ts',
    required: ['field: "_id"'],
  },
  {
    path: 'convex/productResearchEmails.ts',
    required: ['field: "_id"', 'String(authUser?._id || "").trim()', 'String(user._id || "").trim()'],
  },
  {
    path: 'convex/winbackCampaigns.ts',
    required: ['field: "_id"', 'normalizeUserId(authUser?._id)'],
  },
];

for (const expectation of componentLookupExpectations) {
  const source = await read(expectation.path);

  for (const pattern of expectation.required) {
    if (!source.includes(pattern)) {
      throw new Error(`Expected ${expectation.path} to include "${pattern}".`);
    }
  }

  if (source.includes('components.betterAuth.adapter.findMany') && source.includes('field: "id"')) {
    throw new Error(`Expected ${expectation.path} to avoid Better Auth component lookups by "id".`);
  }
}

const adminSource = await read('convex/admin.ts');
if (adminSource.includes('fetchAuthUsersByIds(ctx, authUserIdCandidates)')) {
  throw new Error('Expected admin.ts to avoid querying Better Auth _id lookups with non-ID identity candidates.');
}

console.log('better-auth-component-id-regression.test.mjs passed');
