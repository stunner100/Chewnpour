import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const extractionPath = resolve(rootDir, 'convex/extraction.ts');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const datalabClientPath = resolve(rootDir, 'convex/lib/datalabClient.ts');
const clientPath = resolve(rootDir, 'convex/lib/doctraClient.ts');
const llamaClientPath = resolve(rootDir, 'convex/lib/llamaParseClient.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const datalabClientSource = readFileSync(datalabClientPath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
const llamaClientSource = readFileSync(llamaClientPath, 'utf8');
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
  pipelineSource.includes('runDataLabExtractionCandidate')
    && pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runDoctraExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected extraction pipeline to expose Datalab, Azure, Doctra, and LlamaParse candidate runners behind a single orchestrator.'
);
assert.ok(
  pipelineSource.includes('if (args.backend === "datalab")')
    && pipelineSource.includes('return await runDataLabExtractionCandidate(args);'),
  'Expected the default upload extraction route to cut over to Datalab.'
);
assert.ok(
  extractionSource.includes('v.literal("datalab")')
    && extractionSource.includes('v.literal("azure")')
    && extractionSource.includes('v.literal("doctra")')
    && extractionSource.includes('v.literal("llamaparse")'),
  'Expected background extraction actions to accept Datalab plus the explicit diagnostic backends.'
);
assert.ok(
  aiSource.includes('backend: extraction?.fallbackRecommendation?.backend || "datalab"'),
  'Expected provisional uploads to schedule background extraction via the Datalab-first backend recommendation.'
);
assert.ok(
  pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runDoctraExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected legacy diagnostic runners to remain callable behind the shared extraction orchestrator.'
);

assert.ok(
  datalabClientSource.includes('callDataLabExtract')
    && datalabClientSource.includes('/api/v1/marker')
    && datalabClientSource.includes('request_check_url')
    && datalabClientSource.includes('page_schema')
    && datalabClientSource.includes('save_checkpoint'),
  'Expected the Datalab client helper to own the marker-and-poll structured extraction contract.'
);
assert.ok(
  clientSource.includes('callDoctraExtract')
    && clientSource.includes('profile')
    && clientSource.includes('DOCTRA_EXTRACT_URL'),
  'Expected Doctra client helper to own the remote extract request contract.'
);
assert.ok(
  llamaClientSource.includes('callLlamaParseExtract')
    && llamaClientSource.includes('/api/v1/beta/files')
    && llamaClientSource.includes('/api/v2/parse'),
  'Expected LlamaParse client helper to own the upload-plus-parse API contract.'
);
assert.ok(
  envSource.includes('DATALAB_API_KEY=')
    && envSource.includes('DATALAB_API_BASE_URL=')
    && envSource.includes('DATALAB_TIMEOUT_MS=')
    && envSource.includes('DATALAB_POLL_INTERVAL_MS=')
    && envSource.includes('DOCTRA_ENABLED=')
    && envSource.includes('DOCTRA_EXTRACT_URL=')
    && envSource.includes('DOCTRA_TIMEOUT_MS=')
    && envSource.includes('DOCTRA_SHARED_SECRET=')
    && envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMAPARSE_TIER=')
    && envSource.includes('LLAMAPARSE_VERSION='),
  'Expected .env.example to document the Datalab-first extraction runtime configuration and the explicit diagnostic backends.'
);
assert.ok(
  envSource.includes('DOCTRA_ENABLED=')
    && envSource.includes('DOCTRA_EXTRACT_URL=')
    && envSource.includes('DOCTRA_TIMEOUT_MS=')
    && envSource.includes('DOCTRA_SHARED_SECRET=')
    && envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMAPARSE_TIER=')
    && envSource.includes('LLAMAPARSE_VERSION='),
  'Expected .env.example to preserve the explicit diagnostic backend configuration.'
);

console.log('extraction-routing-regression tests passed');
