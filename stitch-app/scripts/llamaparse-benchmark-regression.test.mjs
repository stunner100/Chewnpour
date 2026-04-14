import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const clientPath = resolve(root, 'convex', 'lib', 'llamaParseClient.ts');
const envPath = resolve(root, '.env.example');

const extractionSource = readFileSync(extractionPath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.ok(
  extractionSource.includes('v.literal("datalab")')
    && extractionSource.includes('v.literal("llamaparse")'),
  'Expected extraction actions to expose Datalab and LlamaParse as selectable backends.'
);
assert.ok(
  pipelineSource.includes('if (args.backend === "llamaparse")')
    && pipelineSource.includes('backend: "llamaparse"')
    && pipelineSource.includes('parser: "llamaparse"'),
  'Expected the extraction pipeline to route explicit llamaparse runs to the LlamaParse candidate.'
);
assert.ok(
  clientSource.includes('isLlamaParseEnabled')
    && clientSource.includes('LLAMA_CLOUD_API_KEY')
    && clientSource.includes('LLAMAPARSE_TIER')
    && clientSource.includes('LLAMAPARSE_VERSION'),
  'Expected the LlamaParse client to be env-gated and tier-aware.'
);
assert.ok(
  envSource.includes('DATALAB_API_KEY=')
    && envSource.includes('DATALAB_API_BASE_URL=')
    && envSource.includes('DATALAB_TIMEOUT_MS=')
    && envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMA_CLOUD_API_BASE_URL=')
    && envSource.includes('LLAMAPARSE_TIMEOUT_MS='),
  'Expected .env.example to document the Datalab-first extraction settings alongside LlamaParse.'
);
assert.ok(
  envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMA_CLOUD_API_BASE_URL=')
    && envSource.includes('LLAMAPARSE_TIMEOUT_MS='),
  'Expected .env.example to document the LlamaParse production settings.'
);

console.log('llamaparse-benchmark-regression tests passed');
