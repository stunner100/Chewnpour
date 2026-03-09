import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const schemaPath = resolve(root, 'convex', 'schema.ts');
const extractionPipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');

const aiSource = readFileSync(aiPath, 'utf8');
const schemaSource = readFileSync(schemaPath, 'utf8');
const pipelineSource = readFileSync(extractionPipelinePath, 'utf8');

assert.ok(
  pipelineSource.includes('runDocumentExtractionPipeline'),
  'Expected documentExtractionPipeline to export runDocumentExtractionPipeline.'
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
  pipelineSource.includes('if (fileType === "docx")')
  && pipelineSource.includes('extractTextFromDocxNative'),
  'Expected extraction pipeline to include native DOCX extraction path.'
);

assert.ok(
  aiSource.includes('internal.extraction.runForegroundExtraction'),
  'Expected ai.processUploadedFile to call internal.extraction.runForegroundExtraction.'
);
assert.equal(
  aiSource.includes('inception_fallback_used'),
  false,
  'Expected LLM reconstruction fallback to be removed from upload extraction flow.'
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

console.log('document-extraction-completeness-regression tests passed');
