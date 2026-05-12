import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const extractionSource = readFileSync(resolve(root, 'convex', 'extraction.ts'), 'utf8');
const aiSource = readFileSync(resolve(root, 'convex', 'ai.ts'), 'utf8');

const foregroundExtractionBody = extractionSource.match(
  /export const runForegroundExtraction = internalAction\(\{[\s\S]*?\n\}\);\n\nexport const benchmarkUploadExtraction/
)?.[0] || '';

assert.ok(
  foregroundExtractionBody.includes('return {') && foregroundExtractionBody.includes('artifactStorageId'),
  'Expected foreground extraction to return an artifact for course generation.'
);
assert.equal(
  /grounded\.buildEvidenceIndex/.test(foregroundExtractionBody),
  false,
  'Foreground extraction must not schedule evidence-index writes while course processing is still active.'
);

const loadEvidenceBody = aiSource.match(
  /const loadGroundedEvidenceIndexForUpload = async[\s\S]*?\n\};\n\nconst resolveUploadForTopic/
)?.[0] || '';

assert.ok(
  loadEvidenceBody.includes('buildGroundedEvidenceIndexFromArtifact'),
  'Expected course generation to build an in-memory evidence index from the extraction artifact.'
);
assert.equal(
  /scheduler\.runAfter\([^)]*grounded\.buildEvidenceIndex/s.test(loadEvidenceBody),
  false,
  'Loading an evidence index for topic generation must not enqueue competing upload-status writes.'
);

assert.ok(
  aiSource.includes('POST_PROCESSING_EVIDENCE_INDEX_DELAY_MS')
    && aiSource.includes('scheduleEvidenceIndexAfterProcessing(ctx')
    && /status:\s*"ready"[\s\S]*scheduleEvidenceIndexAfterProcessing\(ctx/.test(aiSource),
  'Expected evidence indexing to be deferred until after upload status reaches ready.'
);

console.log('processing-evidence-index-race-regression.test.mjs passed');
