import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const schemaPath = resolve(root, 'convex', 'schema.ts');
const extractionPipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const datalabClientPath = resolve(root, 'convex', 'lib', 'datalabClient.ts');
const doctraClientPath = resolve(root, 'convex', 'lib', 'doctraClient.ts');
const llamaClientPath = resolve(root, 'convex', 'lib', 'llamaParseClient.ts');

const aiSource = readFileSync(aiPath, 'utf8');
const schemaSource = readFileSync(schemaPath, 'utf8');
const pipelineSource = readFileSync(extractionPipelinePath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const datalabClientSource = readFileSync(datalabClientPath, 'utf8');
const doctraClientSource = readFileSync(doctraClientPath, 'utf8');
const llamaClientSource = readFileSync(llamaClientPath, 'utf8');

assert.ok(
  pipelineSource.includes('runDataLabExtractionCandidate')
    && pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runDoctraExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected documentExtractionPipeline to export Datalab, Azure, Doctra, and LlamaParse candidate runners plus the unified orchestrator.'
);
assert.ok(
  pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('return await runDataLabExtractionCandidate(args);'),
  'Expected the extraction pipeline to hard-cut the default upload route over to Datalab.'
);
assert.ok(
  pipelineSource.includes('STRICT_QUALITY_THRESHOLD = 0.93'),
  'Expected strict extraction quality threshold to be set to 0.93.'
);
assert.ok(
  pipelineSource.includes('prebuilt-layout') && pipelineSource.includes('prebuilt-read'),
  'Expected extraction pipeline to run both Azure prebuilt-layout and prebuilt-read passes.'
);
assert.ok(
  pipelineSource.includes('runAzurePass')
  && pipelineSource.includes('cloneArrayBuffer(args.fileBuffer)'),
  'Expected extraction pipeline to route Azure passes through resilience layer with buffer cloning.'
);
assert.ok(
  pipelineSource.includes('shouldRunDoctraFallback')
    && pipelineSource.includes('selectDoctraParser'),
  'Expected extraction pipeline to include explicit Doctra fallback routing helpers.'
);
assert.ok(
  pipelineSource.includes('if (fileType === "docx")')
  && pipelineSource.includes('extractTextFromDocxNative'),
  'Expected extraction pipeline to include native DOCX extraction path.'
);

assert.ok(
  aiSource.includes('internal.extraction.runForegroundExtraction'),
  'Expected ai.processUploadedFile to call internal.extraction.runForegroundExtraction.'
);
assert.ok(
  aiSource.includes('runBackgroundReprocess')
    && aiSource.includes('fallbackRecommendation?.backend || "datalab"'),
  'Expected provisional uploads to schedule background reprocessing through the extraction orchestrator.'
);

assert.ok(
  schemaSource.includes('documentExtractions: defineTable'),
  'Expected schema to define documentExtractions table.'
);
assert.ok(
  schemaSource.includes('extractionStatus: v.optional(v.string())'),
  'Expected uploads schema to include extractionStatus.'
);
assert.ok(
  schemaSource.includes('extractionArtifactStorageId: v.optional(v.id("_storage"))'),
  'Expected uploads schema to include extraction artifact storage reference.'
);
assert.ok(
  schemaSource.includes('extractionBackend: v.optional(v.string())')
    && schemaSource.includes('extractionParser: v.optional(v.string())')
    && schemaSource.includes('extractionFallbackUsed: v.optional(v.boolean())'),
  'Expected uploads schema to track extraction backend, parser, and fallback usage.'
);
assert.ok(
  schemaSource.includes('backend: v.optional(v.string())')
    && schemaSource.includes('winner: v.optional(v.boolean())')
    && schemaSource.includes('comparisonReason: v.optional(v.string())'),
  'Expected documentExtractions schema to capture backend metadata for candidate evaluation.'
);
assert.ok(
  extractionSource.includes('insertDocumentExtraction')
    && extractionSource.includes('backend: result.backend')
    && extractionSource.includes('parser: result.parser'),
  'Expected extraction persistence to record backend and parser metadata.'
);
assert.ok(
  datalabClientSource.includes('callDataLabExtract')
    && datalabClientSource.includes('/api/v1/marker')
    && datalabClientSource.includes('request_check_url')
    && datalabClientSource.includes('parsePaginatedMarkdown')
    && datalabClientSource.includes('page_schema')
    && datalabClientSource.includes('save_checkpoint')
    && datalabClientSource.includes('structuredCourseMap'),
  'Expected Datalab requests to use the marker endpoint with checkpoint-backed structured extraction.'
);
assert.ok(
  doctraClientSource.includes('callDoctraExtract')
    && doctraClientSource.includes('DOCTRA_EXTRACT_URL')
    && doctraClientSource.includes('FormData'),
  'Expected Doctra requests to be isolated in the dedicated client helper.'
);
assert.ok(
  llamaClientSource.includes('callLlamaParseExtract')
    && llamaClientSource.includes('/api/v1/beta/files')
    && llamaClientSource.includes('/api/v2/parse')
    && llamaClientSource.includes('pollParseJob'),
  'Expected LlamaParse requests to be isolated in the dedicated client helper.'
);

console.log('document-extraction-completeness-regression tests passed');
