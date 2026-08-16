import assert from 'node:assert/strict';
import {
  chunkTextForEmbedding,
  isGroundedRetrievalEnabled,
  toPgVectorLiteral,
} from '../server/embeddings.js';

const previousFlag = process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED;
const previousKey = process.env.VOYAGE_API_KEY;
delete process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED;
delete process.env.VOYAGE_API_KEY;
assert.equal(isGroundedRetrievalEnabled(), false);

process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED = 'true';
process.env.VOYAGE_API_KEY = 'test';
assert.equal(isGroundedRetrievalEnabled(), true);

const chunks = chunkTextForEmbedding(
  `${'Sentence one about plants. '.repeat(40)}${'Sentence two about cells. '.repeat(40)}`,
  { maxChars: 200, overlap: 40 },
);
assert.ok(chunks.length > 1, 'long text should chunk');
assert.ok(chunks.every((chunk) => chunk.length > 0));

assert.equal(toPgVectorLiteral([0.1, -0.2, 0.3]), '[0.1,-0.2,0.3]');
assert.throws(() => toPgVectorLiteral([]));

if (previousFlag === undefined) delete process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED;
else process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED = previousFlag;
if (previousKey === undefined) delete process.env.VOYAGE_API_KEY;
else process.env.VOYAGE_API_KEY = previousKey;

console.log('tutor-rag-regression.test.mjs passed', { chunks: chunks.length });
