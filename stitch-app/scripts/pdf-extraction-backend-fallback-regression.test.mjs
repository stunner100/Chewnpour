import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const pipelineSource = readFileSync(pipelinePath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');

assert.ok(
  pipelineSource.includes('export const getDefaultExtractionBackend = (fileType?: string): ExtractionBackendId => {'),
  'Expected the extraction pipeline to expose a shared default backend selector.'
);
assert.ok(
  pipelineSource.includes('if (isDataLabEnabled()) return "datalab";')
    && pipelineSource.includes('if (isAzureDocIntelEnabled()) return "azure";')
    && pipelineSource.includes('if (isLlamaParseEnabled()) return "llamaparse";'),
  'Expected PDF extraction to fall back through configured backends instead of assuming Datalab is present.'
);
assert.ok(
  pipelineSource.includes('const defaultBackend = getDefaultExtractionBackend(normalizedFileType);')
    && pipelineSource.includes('if (defaultBackend === "markitdown") {')
    && pipelineSource.includes('if (defaultBackend === "datalab") {')
    && pipelineSource.includes('if (defaultBackend === "azure") {')
    && pipelineSource.includes('return await runLlamaParseExtractionCandidate(args);'),
  'Expected runDocumentExtractionPipeline to dispatch through the shared default backend selector.'
);
assert.ok(
  extractionSource.includes('getDefaultExtractionBackend')
    && extractionSource.includes('const getPrimaryExtractionBackend = (fileType?: string): ExtractionBackendId => getDefaultExtractionBackend(fileType);'),
  'Expected extraction.ts fallback tracking to use the same default backend selector as the pipeline.'
);
assert.ok(
  !pipelineSource.includes('return await runDataLabExtractionCandidate(args);\n};'),
  'Regression detected: the pipeline still hardcodes DataLab as the final default backend.'
);

console.log('pdf-extraction-backend-fallback-regression tests passed');
