import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const aiSource = readFileSync(aiPath, 'utf8');

const processUploadedFileMatch = aiSource.match(
  /export const processUploadedFile = action\(\{[\s\S]*?\n\}\);\n\n\/\/ Add an additional source file/
);

assert.ok(processUploadedFileMatch, 'Expected to find processUploadedFile action.');

const processUploadedFileSource = processUploadedFileMatch[0];

assert.ok(
  processUploadedFileSource.includes('latestUpload = await ctx.runQuery(api.uploads.getUpload, { uploadId })'),
  'Expected processUploadedFile failure handling to inspect the latest upload state before patching status.'
);

assert.ok(
  processUploadedFileSource.includes('latestUpload?.extractionArtifactStorageId')
    && processUploadedFileSource.includes('extractionStatus === "complete"')
    && processUploadedFileSource.includes('extractionStatus === "provisional"'),
  'Expected successful extraction artifacts/states to prevent marking extraction failed.'
);

assert.ok(
  processUploadedFileSource.includes('hasBackgroundCourseProgress')
    && processUploadedFileSource.includes('Number(latestUpload?.generatedTopicCount || 0) > 0'),
  'Expected background topic progress to prevent overwriting a live generation with error status.'
);

assert.ok(
  processUploadedFileSource.includes('if (!hasUsableExtraction)')
    && processUploadedFileSource.includes('updatePayload.extractionStatus = "failed"'),
  'Expected extractionStatus failed to be conditional on not having a usable extraction.'
);

assert.ok(
  !/catch\s*\(error\)\s*\{[\s\S]*?updateUploadStatus,\s*\{\s*uploadId,\s*status:\s*"error",\s*extractionStatus:\s*"failed"/.test(processUploadedFileSource),
  'processUploadedFile must not unconditionally mark extraction failed in its top-level catch.'
);

console.log('Upload processing extraction-state regression passed');
