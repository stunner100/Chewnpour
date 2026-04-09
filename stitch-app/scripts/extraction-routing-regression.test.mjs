import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const extractionPath = resolve(rootDir, 'convex/extraction.ts');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const datalabClientPath = resolve(rootDir, 'convex/lib/datalabClient.ts');
const markitdownClientPath = resolve(rootDir, 'convex/lib/markitdownClient.ts');
const llamaClientPath = resolve(rootDir, 'convex/lib/llamaParseClient.ts');
const envPath = resolve(rootDir, '.env.example');
const markitdownScriptPath = resolve(rootDir, 'scripts', 'markitdown_convert.py');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const datalabClientSource = readFileSync(datalabClientPath, 'utf8');
const markitdownClientSource = readFileSync(markitdownClientPath, 'utf8');
const llamaClientSource = readFileSync(llamaClientPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');
const markitdownScriptSource = readFileSync(markitdownScriptPath, 'utf8');

assert.equal(
  aiSource.includes('callDataLabExtract'),
  false,
  'Expected ai.ts to avoid calling extraction providers directly.'
);
assert.equal(
  extractionSource.includes('callDataLabExtract'),
  false,
  'Expected extraction.ts to route provider work through documentExtractionPipeline.'
);

assert.ok(
  pipelineSource.includes('runMarkItDownExtractionCandidate')
    && pipelineSource.includes('runDataLabExtractionCandidate')
    && pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected extraction pipeline to expose MarkItDown, Datalab, Azure, and LlamaParse candidate runners behind a single orchestrator.'
);
assert.ok(
  pipelineSource.includes('if (args.backend === "markitdown")')
    && pipelineSource.includes('if (normalizedFileType === "pptx" || normalizedFileType === "docx")')
    && pipelineSource.includes('console.warn("[Extraction] markitdown_primary_failed"')
    && pipelineSource.includes('return await runDataLabExtractionCandidate(args);'),
  'Expected the default extraction route to try MarkItDown first for PPTX/DOCX uploads and fall back to Datalab if the converter throws.'
);
assert.ok(
  extractionSource.includes('v.literal("markitdown")')
    && extractionSource.includes('v.literal("datalab")')
    && extractionSource.includes('v.literal("azure")')
    && extractionSource.includes('v.literal("llamaparse")'),
  'Expected extraction actions to accept MarkItDown plus the explicit diagnostic backends.'
);
assert.ok(
  aiSource.includes('backend: extraction?.fallbackRecommendation?.backend || "datalab"'),
  'Expected provisional uploads to schedule background extraction via the extraction fallback recommendation.'
);

assert.ok(
  datalabClientSource.includes('callDataLabExtract')
    && datalabClientSource.includes('/api/v1/convert')
    && datalabClientSource.includes('request_check_url'),
  'Expected the hosted Datalab client helper to own the convert-and-poll API contract.'
);
assert.ok(
  markitdownClientSource.includes('callMarkItDownExtract')
    && markitdownClientSource.includes('markitdown_convert.py')
    && markitdownClientSource.includes('MARKITDOWN_PYTHON_BIN'),
  'Expected the MarkItDown client helper to own the Python bridge contract.'
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
    && envSource.includes('MARKITDOWN_PYTHON_BIN=')
    && envSource.includes('MARKITDOWN_TIMEOUT_MS=')
    && envSource.includes('LLAMA_CLOUD_API_KEY=')
    && envSource.includes('LLAMAPARSE_TIER=')
    && envSource.includes('LLAMAPARSE_VERSION='),
  'Expected .env.example to document the MarkItDown bridge plus the explicit diagnostic backends.'
);
assert.ok(
  markitdownScriptSource.includes('from markitdown import MarkItDown')
    && markitdownScriptSource.includes("pip install 'markitdown[pdf,docx,pptx]'"),
  'Expected the MarkItDown bridge script to import the package and emit an install hint when it is missing.'
);

console.log('extraction-routing-regression tests passed');
