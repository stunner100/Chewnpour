import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'convex', 'exams.ts'), 'utf8');

for (const snippet of [
  'const resolveTopicReference = async (ctx: any, rawTopicId: unknown) => {',
  'const normalizedTopicId = ctx.db.normalizeId("topics", normalizedRawTopicId);',
  'if (!topic || !topic.courseId) {',
  'const { topicId, topic } = await resolveTopicReference(ctx, attempt.topicId);',
  'topicId: resolvedTopicId,',
  'const resolved = await resolveTopicReference(ctx, topicId);',
  'const validEntries = entries.filter(Boolean);',
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Regression detected: exams.ts missing topic reference guard snippet: ${snippet}`);
  }
}

console.log('exam-topic-reference-regression.test.mjs passed');
