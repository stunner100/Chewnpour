import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const extractionPath = resolve(rootDir, 'convex/extraction.ts');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const clientPath = resolve(rootDir, 'convex/lib/datalabOssClient.ts');
const llamaClientPath = resolve(rootDir, 'convex/lib/llamaParseClient.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
const llamaClientSource = readFileSync(llamaClientPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.equal(
  aiSource.includes('callDataLabOssExtract'),
  false,
  'Expected ai.ts to avoid calling the self-hosted extractor directly.'
);
assert.equal(
  extractionSource.includes('callDataLabOssExtract'),
  false,
  'Expected extraction.ts to route self-hosted extraction through documentExtractionPipeline.'
);

assert.ok(
  pipelineSource.includes('runDataLabOssExtractionCandidate')
    && pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected extraction pipeline to expose Datalab OSS, Azure, and LlamaParse candidate runners behind a single orchestrator.'
);
assert.ok(
  pipelineSource.includes('if (args.backend === "datalab_oss")')
    && pipelineSource.includes('return await runDataLabOssExtractionCandidate(args);'),
  'Expected the default upload extraction route to cut over to the self-hosted Datalab OSS backend.'
);
assert.ok(
  extractionSource.includes('v.literal("datalab_oss")')
    && extractionSource.includes('v.literal("azure")')
    && extractionSource.includes('v.literal("llamaparse")'),
  'Expected background extraction actions to accept Datalab OSS plus the explicit diagnostic backends.'
);
assert.ok(
  aiSource.includes('backend: extraction?.fallbackRecommendation?.backend || "datalab_oss"'),
  'Expected provisional uploads to schedule background extraction via the self-hosted Datalab OSS backend recommendation.'
);

assert.ok(
  clientSource.includes('callDataLabOssExtract')
    && clientSource.includes('profile')
    && clientSource.includes('DATALAB_OSS_EXTRACT_URL'),
  'Expected Datalab OSS client helper to own the self-hosted extract request contract.'
);
assert.ok(
  llamaClientSource.includes('callLlamaParseExtract')
    && llamaClientSource.includes('/api/v1/beta/files')
    && llamaClientSource.includes('/api/v2/parse'),
  'Expected LlamaParse client helper to own the upload-plus-parse API contract.'
);
assert.ok(
  envSource.includes('DATALAB_OSS_ENABLED=')
    && envSource.includes('DATALAB_OSS_EXTRACT_URL=')
    && envSource.includes('DATALAB_OSS_TIMEOUT_MS=')
    && envSource.includes('DATALAB_OSS_SHARED_SECRET=')
    && envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMAPARSE_TIER=')
    && envSource.includes('LLAMAPARSE_VERSION='),
  'Expected .env.example to document the Datalab OSS runtime configuration and the explicit diagnostic backends.'
);

console.log('extraction-routing-regression tests passed');
