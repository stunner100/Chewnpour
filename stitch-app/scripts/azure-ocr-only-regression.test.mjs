import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const extractionPipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const envPath = resolve(rootDir, '.env.example');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionPipelineSource = readFileSync(extractionPipelinePath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.equal(aiSource.includes('DOCTRA_'), false, 'Doctra env references should not exist in ai.ts');
assert.equal(aiSource.includes('callDoctraExtract'), false, 'Doctra extraction should not be invoked');

assert.ok(
  extractionPipelineSource.includes('prebuilt-layout') && extractionPipelineSource.includes('prebuilt-read'),
  'Expected strict extraction pipeline to include Azure layout + read passes.'
);
assert.ok(
  aiSource.includes('internal.extraction.runForegroundExtraction'),
  'Expected upload extraction flow to use internal extraction orchestrator.'
);

assert.equal(envSource.includes('DOCTRA_'), false, '.env.example should not include Doctra vars');

console.log('azure-ocr-only-regression tests passed');
