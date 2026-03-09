import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const schemaSource = await read('convex/schema.ts');
if (!schemaSource.includes('consumedReExplanations: v.optional(v.number())')) {
  throw new Error('Expected subscriptions schema to track "consumedReExplanations".');
}

const subscriptionsSource = await read('convex/subscriptions.ts');
for (const pattern of [
  'const FREE_REEXPLAIN_LIMIT = 1;',
  'export const consumeReExplainCreditOrThrow = mutation({',
  'code: "REEXPLAIN_QUOTA_EXCEEDED"',
  'consumedReExplanations: nextUsed',
]) {
  if (!subscriptionsSource.includes(pattern)) {
    throw new Error(`Expected subscriptions.ts to include "${pattern}" for re-explain free quota.`);
  }
}

const aiSource = await read('convex/ai.ts');
for (const pattern of [
  'export const reExplainTopic = action({',
  'api.subscriptions.consumeReExplainCreditOrThrow',
]) {
  if (!aiSource.includes(pattern)) {
    throw new Error(`Expected ai.ts to include "${pattern}" for re-explain quota consumption.`);
  }
}

const topicDetailSource = await read('src/pages/TopicDetail.jsx');
for (const pattern of [
  'REEXPLAIN_QUOTA_EXCEEDED',
  "You've used your free lesson re-explain. Upgrade to premium for unlimited re-explains.",
]) {
  if (!topicDetailSource.includes(pattern)) {
    throw new Error(`Expected TopicDetail.jsx to include "${pattern}" for re-explain quota UX.`);
  }
}

console.log('reexplain-free-quota-regression.test.mjs passed');
