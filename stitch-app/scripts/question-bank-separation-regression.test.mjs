import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const groundedGenerationPath = resolve(rootDir, 'convex/lib/groundedGeneration.ts');

const aiSource = readFileSync(aiPath, 'utf8');
const groundedGenerationSource = readFileSync(groundedGenerationPath, 'utf8');

assert.ok(
  aiSource.includes('content: buildStructuredLessonMapPrompt({'),
  'Expected lesson generation to use the structured lesson-map prompt.'
);

assert.ok(
  aiSource.includes('ensureAssessmentBlueprintForTopic')
    && groundedGenerationSource.includes('export const buildGroundedAssessmentBlueprintPrompt =')
    && groundedGenerationSource.includes('export const buildGroundedMcqPrompt =')
    && groundedGenerationSource.includes('export const buildGroundedEssayPrompt ='),
  'Expected exam generation to remain grounded in the assessment blueprint and evidence pipeline instead of lesson markdown.'
);

assert.ok(
  !aiSource.includes('"lessonContent": "Markdown lesson content"'),
  'Lesson generation should no longer ask the model to emit final markdown directly as the primary path.'
);

console.log('question-bank-separation-regression tests passed');
