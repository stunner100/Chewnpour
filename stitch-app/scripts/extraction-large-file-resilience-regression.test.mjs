import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const nativePath = resolve(root, 'convex', 'lib', 'nativeExtractors.ts');

const pipelineSource = readFileSync(pipelinePath, 'utf8');
const nativeSource = readFileSync(nativePath, 'utf8');

assert.ok(
  pipelineSource.includes('const nativeBuffer = cloneArrayBuffer(args.fileBuffer)')
  && pipelineSource.includes('const layoutBuffer = cloneArrayBuffer(args.fileBuffer)')
  && pipelineSource.includes('const readBuffer = cloneArrayBuffer(args.fileBuffer)'),
  'Expected extraction passes to use cloned ArrayBuffers instead of reusing the same buffer.'
);

assert.ok(
  pipelineSource.includes('runPdfBatchedOcrPass')
  && pipelineSource.includes('runPptxLowTextImageOcrPass'),
  'Expected large-file fallback handlers for PDF page-batch OCR and PPTX low-text slide OCR.'
);

assert.ok(
  pipelineSource.includes('InvalidContentLength')
  && pipelineSource.includes('runAzurePass'),
  'Expected Azure size-limit errors to route through explicit fallback handling.'
);

assert.ok(
  pipelineSource.includes('pollResponse.status === 429')
  && pipelineSource.includes('getRetryDelayMs'),
  'Expected Azure polling to retry with backoff on 429 rate limits.'
);

assert.ok(
  pipelineSource.includes('STRICT_PAGE_PRESENCE_PPTX_THRESHOLD')
  && pipelineSource.includes('STRICT_WEAK_PAGE_RATIO_PPTX_THRESHOLD'),
  'Expected strict scoring to have PPTX-specific thresholds.'
);

assert.ok(
  nativeSource.includes('extractPptxSlideImageCandidates')
  && nativeSource.includes('resolveZipRelativePath')
  && nativeSource.includes('collectSlideImagePaths'),
  'Expected native extractor helpers for PPTX slide-image OCR candidates.'
);

console.log('extraction-large-file-resilience-regression tests passed');
