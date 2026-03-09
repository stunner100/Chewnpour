import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const nativePath = resolve(root, 'convex', 'lib', 'nativeExtractors.ts');

const pipelineSource = readFileSync(pipelinePath, 'utf8');
const nativeSource = readFileSync(nativePath, 'utf8');

assert.ok(
  pipelineSource.includes('extractTextFromDocxNative'),
  'Expected extraction pipeline to import extractTextFromDocxNative.'
);
assert.ok(
  pipelineSource.includes('if (fileType === "docx")'),
  'Expected runNativePass to include a DOCX branch.'
);
assert.ok(
  pipelineSource.includes('splitTextIntoSyntheticPages(fallbackContent, source)'),
  'Expected Azure fallback content to synthesize per-page entries when pages are missing.'
);
assert.ok(
  pipelineSource.includes('pages: mergedPages') && pipelineSource.includes('pageCount: mergedPages.length'),
  'Expected Azure pass result to return synthesized merged pages and pageCount.'
);
assert.ok(
  nativeSource.includes('export async function extractTextFromDocxNative'),
  'Expected native DOCX extractor to exist.'
);
assert.ok(
  nativeSource.includes('[Header]') && nativeSource.includes('[Footer]'),
  'Expected native DOCX extractor to include header/footer extraction.'
);

console.log('docx-extraction-regression tests passed');
