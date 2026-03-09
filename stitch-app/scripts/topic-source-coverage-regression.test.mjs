import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const outlinePath = resolve(root, 'convex', 'lib', 'topicOutlinePipeline.js');

const aiSource = readFileSync(aiPath, 'utf8');
const outlineSource = readFileSync(outlinePath, 'utf8');

assert.ok(
  outlineSource.includes('const anchors = [0, 0.25, 0.5, 0.75, 1];'),
  'Expected buildGroupSourceSnippet to use multi-segment anchor sampling.'
);
assert.equal(
  outlineSource.includes('headSize = Math.floor(maxChars * 0.72)'),
  false,
  'Expected head-tail-only source snippet logic to be removed.'
);

assert.ok(
  aiSource.includes('const buildChunkSummaryWindows = (text: string) =>'),
  'Expected chunk summary map-reduce window builder to exist.'
);
assert.ok(
  aiSource.includes('sourceChunkIds?: number[];'),
  'Expected prepared topic model to carry sourceChunkIds.'
);
assert.ok(
  aiSource.includes('const buildTopicContextFromChunkIds = (extractedText: string, sourceChunkIds?: number[]) =>'),
  'Expected chunk-id-based topic context resolver to exist.'
);
assert.ok(
  aiSource.includes('const chunkBoundContext = buildTopicContextFromChunkIds(extractedText, topicData.sourceChunkIds);'),
  'Expected topic generation to prefer chunk-bound source context.'
);

console.log('topic-source-coverage-regression tests passed');
