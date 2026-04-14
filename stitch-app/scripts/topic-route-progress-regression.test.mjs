import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'convex/topics.ts'),
  'utf8',
);

if (!/const\s+resolveTopicIdFromRoute\s*=\s*\(ctx:\s*any,\s*routeId:\s*unknown\)\s*=>/.test(source)) {
  throw new Error('Expected topics.ts to define resolveTopicIdFromRoute for route-based topic pages.');
}

for (const exportName of ['getTopicWithQuestions', 'upsertTopicProgress', 'getUserTopicProgress', 'getTopicSourcePassages']) {
  const pattern = new RegExp(`export const ${exportName}[\\s\\S]*?resolveTopicIdFromRoute\\(ctx, args\\.topicId\\)`);
  if (!pattern.test(source)) {
    throw new Error(`Expected ${exportName} to normalize route topic ids before querying Convex.`);
  }
}

if (!/export const getTopicWithQuestions = query\(\{[\s\S]*?args:\s*\{\s*topicId:\s*v\.string\(\)\s*\}/.test(source)) {
  throw new Error('Expected getTopicWithQuestions to accept route topic ids as strings.');
}

console.log('topic-route-progress-regression tests passed');
