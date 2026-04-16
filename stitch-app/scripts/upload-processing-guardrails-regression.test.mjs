import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const aiSource = readFileSync(aiPath, 'utf8');

assert.ok(
  aiSource.includes('clampGeneratedTopicCount'),
  'Expected ai.ts to use the non-inflating generated-topic clamp for persisted upload state.'
);
assert.ok(
  aiSource.includes('First topic generation completed without persisting any topics.'),
  'Expected ai.ts to fail fast when the first topic generation does not actually create a topic.'
);
assert.ok(
  aiSource.includes('No topics were generated for this upload.'),
  'Expected ai.ts to mark uploads as errored instead of ready when background generation finishes with zero topics.'
);
assert.ok(
  !aiSource.includes('const finalGeneratedCount = normalizeGeneratedTopicCount({'),
  'Regression detected: final background upload status must not use the progress-normalized topic count.'
);
assert.ok(
  !aiSource.includes('const generatedTopicCount = normalizeGeneratedTopicCount({\n                    generatedTopicCount: await countGeneratedTopicsForCourse(ctx, courseId, totalTopics),'),
  'Regression detected: first-topic readiness must not be derived from the progress-normalized count.'
);

console.log('upload-processing-guardrails-regression tests passed');
