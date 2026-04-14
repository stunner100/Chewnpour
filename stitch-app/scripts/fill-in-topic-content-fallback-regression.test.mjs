import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/const buildGroundedEvidenceIndexFromTopicContent = \(topic: any\): GroundedEvidenceIndex \| null => \{/.test(aiSource)) {
  throw new Error('Expected a topic-content evidence fallback builder for concept generation.');
}

if (!/const topicContentIndex = buildGroundedEvidenceIndexFromTopicContent\(args\.topic\);/.test(aiSource)) {
  throw new Error('Expected grounded retrieval to build a topic-content fallback evidence index.');
}

if (!/const index = persistedIndex \|\| topicContentIndex;/.test(aiSource)) {
  throw new Error('Expected grounded retrieval to fall back to topic content when persisted upload evidence is missing.');
}

if (!/const topicContentFallbackNeeded =\s*retrieval\.evidence\.length === 0[\s\S]*topicContentIndex[\s\S]*topicContentIndex !== index;/.test(aiSource)) {
  throw new Error('Expected grounded retrieval to retry against topic content when upload-backed retrieval returns no evidence.');
}

if (!/topicContentFallbackUsed: Boolean\(fallbackRetrieval && fallbackRetrieval\.evidence\.length > 0\)/.test(aiSource)) {
  throw new Error('Expected grounded retrieval logging to record topic-content fallback usage.');
}

console.log('fill-in-topic-content-fallback-regression.test.mjs passed');
