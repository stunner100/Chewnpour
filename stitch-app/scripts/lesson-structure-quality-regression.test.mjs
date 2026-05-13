import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiPath = resolve(rootDir, 'convex/ai.ts');
const aiSource = readFileSync(aiPath, 'utf8');

assert.ok(
  aiSource.includes('const buildStructuredLessonMapPrompt = (args: {'),
  'Expected ai.ts to define a structured lesson-map prompt instead of writing lessons directly from raw text.'
);

assert.ok(
  aiSource.includes('const normalizeStructuredLessonMap = (rawMap: any, args: {')
    && aiSource.includes('const buildLessonMarkdownFromStructuredMap = (map: StructuredLessonMap) => {'),
  'Expected ai.ts to normalize a structured lesson schema and render markdown from that schema.'
);

assert.ok(
  aiSource.includes('const evaluateStructuredLessonQuality = (content: string) => {')
    && aiSource.includes('Big Idea must contain 1-2 short explanatory paragraphs.')
    && aiSource.includes('Key Ideas must contain 5-8 atomic bullets.')
    && aiSource.includes('Step-by-Step Breakdown must use numbered steps only.')
    && aiSource.includes('Worked Example must include question, reasoning, and answer.')
    && aiSource.includes('Summary must stay concise and avoid bloated repetition.')
    && aiSource.includes('Lesson must not include generic worked-example filler or low-signal source fragments.'),
  'Expected ai.ts to enforce section-level lesson quality rules in code.'
);

assert.ok(
  aiSource.includes('const LESSON_LOW_SIGNAL_SOURCE_PATTERNS = [')
    && aiSource.includes('The correct answer comes from following the steps in order')
    && aiSource.includes('What is reported for')
    && aiSource.includes('DOI\\s+10\\.')
    && aiSource.includes('Springer-Verlag')
    && aiSource.includes('The weaker formula x')
    && aiSource.includes('In clausal form'),
  'Expected lesson generation to reject the low-signal fragments seen in the staging lesson.'
);

assert.ok(
  aiSource.includes('export const regenerateLessonContent = action({')
    && aiSource.includes('patchTopicLessonContentInternal')
    && aiSource.includes('dryRun: v.optional(v.boolean())'),
  'Expected an authenticated lesson-content regeneration action for existing bad topic bodies.'
);

assert.ok(
  aiSource.includes('## Big Idea')
    && aiSource.includes('## Key Ideas')
    && aiSource.includes('## Step-by-Step Breakdown')
    && aiSource.includes('## Worked Example')
    && aiSource.includes('## Summary')
    && aiSource.includes('## Quick Check'),
  'Expected the structured lesson renderer to emit the required lesson sections.'
);

assert.ok(
  aiSource.includes('if (!/^\\*\\*[^*]+\\*\\*$/.test(l.trim()))')
    && aiSource.includes('`**Reasoning:**`'),
  'Expected lesson cleanup to preserve standalone bold worked-example labels.'
);

console.log('lesson-structure-quality-regression tests passed');
