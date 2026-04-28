import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const schemaPath = resolve(root, 'convex', 'schema.ts');
const extractionPipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const datalabClientPath = resolve(root, 'convex', 'lib', 'datalabClient.ts');
const groundedEvidenceIndexPath = resolve(root, 'convex', 'lib', 'groundedEvidenceIndex.ts');
const datalabTextPath = resolve(root, 'convex', 'lib', 'datalabText.ts');
const doclingClientPath = resolve(root, 'convex', 'lib', 'doclingClient.ts');
const llamaClientPath = resolve(root, 'convex', 'lib', 'llamaParseClient.ts');

const aiSource = readFileSync(aiPath, 'utf8');
const schemaSource = readFileSync(schemaPath, 'utf8');
const pipelineSource = readFileSync(extractionPipelinePath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const datalabClientSource = readFileSync(datalabClientPath, 'utf8');
const groundedEvidenceIndexSource = readFileSync(groundedEvidenceIndexPath, 'utf8');
const datalabTextSource = readFileSync(datalabTextPath, 'utf8');
const doclingClientSource = readFileSync(doclingClientPath, 'utf8');
const llamaClientSource = readFileSync(llamaClientPath, 'utf8');

assert.ok(
  pipelineSource.includes('runDataLabExtractionCandidate')
    && pipelineSource.includes('runAzureExtractionCandidate')
    && pipelineSource.includes('runDoclingExtractionCandidate')
    && pipelineSource.includes('runLlamaParseExtractionCandidate')
    && pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected documentExtractionPipeline to export Datalab, Azure, Docling, and LlamaParse candidate runners plus the unified orchestrator.'
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
  pipelineSource.includes('shouldRunDoclingFallback')
    && pipelineSource.includes('selectDoclingParser'),
  'Expected extraction pipeline to include explicit Docling fallback routing helpers.'
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
    && datalabClientSource.includes('/api/v1/extract')
    && datalabClientSource.includes('request_check_url')
    && datalabClientSource.includes('flattenChunkBlocks')
    && datalabClientSource.includes('buildPagesFromChunkBlocks')
    && datalabClientSource.includes('checkpoint_id')
    && datalabClientSource.includes('save_checkpoint')
    && datalabClientSource.includes('structuredCourseMap')
    && datalabClientSource.includes('collectCitationBlockIds')
    && datalabClientSource.includes('cleanDataLabBlockText'),
  'Expected Datalab requests to use checkpoint-backed convert plus extract with cited, cleaned chunk blocks.'
);
assert.ok(
  groundedEvidenceIndexSource.includes('cleanDataLabBlockText')
    && groundedEvidenceIndexSource.includes('doclingBlocks')
    && groundedEvidenceIndexSource.includes('sourceBackend: "docling"')
    && groundedEvidenceIndexSource.includes('headingPath')
    && groundedEvidenceIndexSource.includes("flags.push(\"table\")"),
  'Expected grounded evidence indexing to preserve cleaned structural block text from Docling and Datalab blocks.'
);
assert.ok(
  datalabTextSource.includes('decodeHtmlEntities')
    && datalabTextSource.includes('cleanDataLabBlockText')
    && datalabTextSource.includes('replace(/<\\s*\\/t(?:d|h)\\s*>/gi, " | ")'),
  'Expected Datalab text cleanup helper to normalize HTML/table-heavy block content into clean text.'
);
assert.ok(
  doclingClientSource.includes('callDoclingExtract')
    && doclingClientSource.includes('DOCLING_EXTRACT_URL')
    && doclingClientSource.includes('FormData')
    && doclingClientSource.includes('DoclingBlock'),
  'Expected Docling requests and structured block responses to be isolated in the dedicated client helper.'
);
assert.ok(
  llamaClientSource.includes('callLlamaParseExtract')
    && llamaClientSource.includes('/api/v1/beta/files')
    && llamaClientSource.includes('/api/v2/parse')
    && llamaClientSource.includes('pollParseJob'),
  'Expected LlamaParse requests to be isolated in the dedicated client helper.'
);

console.log('document-extraction-completeness-regression tests passed');
