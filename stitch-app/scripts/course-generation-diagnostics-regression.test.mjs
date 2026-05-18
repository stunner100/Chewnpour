import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiSource = readFileSync(resolve(rootDir, 'convex/ai.ts'), 'utf8');
const cronsSource = readFileSync(resolve(rootDir, 'convex/crons.ts'), 'utf8');

for (const expected of [
  'emitCourseGenerationDiagnostic',
  'course_generation_stage_timing',
  'stage: "extraction"',
  'stage: "outline"',
  'stage: "first_topic"',
  'stage: "remaining_topics"',
  'stage: "question_bank"',
  'stage: "finalization"',
  'stage: "quality_gate"',
  'captureBackendSentryMessage',
]) {
  assert.ok(aiSource.includes(expected), `Expected course generation diagnostics to include "${expected}".`);
}

assert.ok(
  aiSource.includes('repairStaleProcessingUploads')
    && aiSource.includes('getUploadProcessingRepairDecision')
    && cronsSource.includes('stale upload processing repair'),
  'Expected a scheduled stale-upload finalizer to repair stuck processing uploads.',
);

console.log('course-generation-diagnostics-regression.test.mjs passed');
