import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const aiSource = readFileSync(resolve(rootDir, 'convex/ai.ts'), 'utf8');
const topicsSource = readFileSync(resolve(rootDir, 'convex/topics.ts'), 'utf8');

assert.match(
  aiSource,
  /const syncAssessmentRoutingForUpload = async \(ctx: any, args: \{/,
  'Expected ai.ts to define syncAssessmentRoutingForUpload before calling it.',
);

assert.ok(
  aiSource.includes('(internal as any).topics.updateAssessmentRoutingInternal')
    && aiSource.includes('assessmentRoute: "topic_quiz"')
    && aiSource.includes('supportedQuestionTypes: ["multiple_choice", "essay"]'),
  'Expected routing sync to persist direct topic quiz assessment metadata.',
);

assert.ok(
  topicsSource.includes('export const updateAssessmentRoutingInternal = internalMutation({')
    && topicsSource.includes('assessmentClassification: v.optional(v.string())')
    && topicsSource.includes('assessmentRoute: v.optional(v.string())'),
  'Expected topics.ts to expose an internal mutation for assessment routing metadata.',
);

assert.ok(
  aiSource.includes('const validSubClaimIds = new Set(')
    && aiSource.includes('const normalizePersistedSubClaimId = (value: unknown) =>')
    && aiSource.includes('subClaimId: normalizePersistedSubClaimId(questionRecord?.subClaimId || resolvedObjectivePlanItem?.subClaimId)'),
  'Expected question persistence to omit synthetic subClaimId values that are not real topicSubClaims ids.',
);

assert.ok(
  aiSource.includes('last_resort_grounded_fallback_saved')
    && aiSource.includes('quality_gate_bypassed_for_grounded_fallback')
    && aiSource.includes('getUniqueQuestionCount() === 0 && groundedPack.evidence.length > 0'),
  'Expected question generation to save one grounded limited fallback instead of leaving Docling-backed topics with zero questions.',
);

console.log('assessment-routing-sync-regression.test.mjs passed');
