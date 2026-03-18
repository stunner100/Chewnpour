import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const extractionPath = resolve(rootDir, 'convex/extraction.ts');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const clientPath = resolve(rootDir, 'convex/lib/doctraClient.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.equal(
  aiSource.includes('callDoctraExtract'),
  false,
  'Expected ai.ts to avoid calling Doctra directly.'
);
assert.equal(
  extractionSource.includes('callDoctraExtract'),
  false,
  'Expected extraction.ts to route Doctra calls through documentExtractionPipeline.'
);

assert.ok(
  pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runDoctraExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected extraction pipeline to expose Azure and Doctra candidate runners behind a single orchestrator.'
);
assert.ok(
  extractionSource.includes('backend: v.optional(v.union(v.literal("azure"), v.literal("doctra")))'),
  'Expected background extraction actions to accept an optional backend selector.'
);
assert.ok(
  aiSource.includes('backend: extraction?.fallbackRecommendation?.backend || "azure"'),
  'Expected provisional uploads to schedule fallback extraction via backend recommendation.'
);

assert.ok(
  clientSource.includes('callDoctraExtract')
    && clientSource.includes('profile')
    && clientSource.includes('DOCTRA_EXTRACT_URL'),
  'Expected Doctra client helper to own the remote extract request contract.'
);
assert.ok(
  envSource.includes('DOCTRA_ENABLED=')
    && envSource.includes('DOCTRA_EXTRACT_URL=')
    && envSource.includes('DOCTRA_TIMEOUT_MS=')
    && envSource.includes('DOCTRA_SHARED_SECRET='),
  'Expected .env.example to document Doctra runtime configuration.'
);

console.log('extraction-routing-regression tests passed');
