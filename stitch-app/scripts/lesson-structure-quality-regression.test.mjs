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
  aiSource.includes('const buildStructuredLessonRepairPrompt = (args: {')
    && aiSource.includes('QUALITY ERROR TO FIX:')
    && aiSource.includes('PREVIOUS MAP THAT FAILED VALIDATION:')
    && aiSource.includes('structured_lesson_map_repair_attempt')
    && aiSource.includes('structured_lesson_map_repair_failed'),
  'Expected topic generation to make one strict structured-map repair pass when Word Bank or section quality validation fails.'
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
    && aiSource.includes('Word Bank must include 6-8 term-definition entries.')
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
  aiSource.includes('According to the source,\\s*what is reported for')
    && aiSource.includes('How should a learner interpret ${topicLabel} from the source evidence?')
    && aiSource.includes('Do not use generic worked-example questions like "According to the source, what is reported for ..."'),
  'Expected lesson generation to reject generic "reported for" worked-example prompts and replace them with interpretation prompts.'
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
    && aiSource.includes('## Word Bank')
    && aiSource.includes('## Summary')
    && aiSource.includes('## Quick Check'),
  'Expected the structured lesson renderer to emit the required lesson sections.'
);

assert.ok(
  aiSource.includes('if (!/^\\*\\*[^*]+\\*\\*$/.test(l.trim()))')
    && aiSource.includes('`**Reasoning:**`'),
  'Expected lesson cleanup to preserve standalone bold worked-example labels.'
);

assert.ok(
  aiSource.includes('const hasWorkedQuestion = /(?:\\*\\*)?Question:\\*{0,2}/.test(workedJoined);')
    && aiSource.includes('Read the source purpose for ${topicLabel}')
    && aiSource.includes('Connect the terms to one source example'),
  'Expected the fallback quality gate to accept stable worked-example labels and use non-repeating safe steps.'
);

assert.ok(
  aiSource.includes('const LESSON_WORD_BANK_MIN = 6;')
    && aiSource.includes('const LESSON_WORD_BANK_MAX = 8;')
    && aiSource.includes('isUsableWordBankDefinition(')
    && aiSource.includes('Definitions must include 6 to 8 Word Bank entries.'),
  'Expected standard topic generation to always normalize enough Word Bank definitions for flashcards.'
);

assert.ok(
  aiSource.includes('Word Bank entries must be concrete terms with specific definitions.')
    && aiSource.includes('isGenericDefinitionMeaning(')
    && aiSource.includes('isLearningObjectiveFragmentTerm('),
  'Expected lesson generation to reject generic or learning-objective fragment Word Bank entries.'
);

assert.ok(
  aiSource.includes('Could not generate a valid Word Bank for this topic.')
    && !aiSource.includes('`${fallbackTerm} is one of the important ideas used in this topic.`')
    && !aiSource.includes('`${item} explained in clear words.`'),
  'Expected lesson generation to avoid generic placeholder Word Bank definitions.'
);

console.log('lesson-structure-quality-regression tests passed');
