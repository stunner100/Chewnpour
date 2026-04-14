import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app';
const source = await fs.readFile(path.join(root, 'convex/concepts.ts'), 'utf8');

const requiredSnippets = [
  'const summarizeConceptAttempts = (attempts: any[]) => {',
  'const deriveConceptStatus = (correct: number, total: number) => {',
  'const summary = summarizeConceptAttempts(attempts);',
  'const groupedAttempts = new Map<string, any[]>();',
  'dueTopicCount: items.filter((item) => item.dueCount > 0).length',
  'dueConceptCount: items.reduce((sum, item) => sum + Math.max(0, Number(item.dueCount) || 0), 0)',
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected concepts.ts to include "${snippet}" so mastery buckets are derived from saved attempts.`);
  }
}

const forbiddenSnippets = [
  'strongCount: 0,',
  'shakyCount: 0,',
  'weakCount: 0,',
];

const masterySection = source.slice(
  source.indexOf('export const getConceptMasteryForTopic = query({'),
  source.indexOf('export const getConceptReviewQueue = query({'),
);

for (const snippet of forbiddenSnippets) {
  if (masterySection.includes(snippet)) {
    throw new Error(`Regression detected: mastery query still hardcodes zero buckets with "${snippet}"`);
  }
}

console.log('concept-mastery-buckets-regression.test.mjs passed');
