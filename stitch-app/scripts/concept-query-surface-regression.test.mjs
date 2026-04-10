import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app';
const source = await fs.readFile(path.join(root, 'convex/concepts.ts'), 'utf8');

const requiredSnippets = [
  'export const getConceptMasteryForTopic = query({',
  'export const getConceptReviewQueue = query({',
  'export const getConceptSessionForTopic = action({',
  'export const createConceptSessionAttempt = mutation({',
  'source: attempts.length > 0 ? "attempt_fallback" : "empty"',
  'reviewConceptKeys:',
  'dueTopicCount:',
  'dueConceptCount:',
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected concepts.ts to include "${snippet}" for stale frontend query compatibility.`);
  }
}

console.log('concept-query-surface-regression.test.mjs passed');
