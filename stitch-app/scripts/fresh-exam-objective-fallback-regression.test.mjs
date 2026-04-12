import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/const resolveFreshObjectiveCapacityCap = \(topic: any, evidence: RetrievedEvidence\[\]\) => \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to cap fresh objective counts by grounded evidence capacity.');
}

if (!/const resolveFreshObjectiveTargetFloor = \(topic: any\) => \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to derive a minimum fresh objective target from topic strength.');
}

if (!/const buildFreshObjectiveCountCandidates = \(\s*topic: any,\s*evidence: RetrievedEvidence\[\],\s*configuredTarget: number,\s*\) => \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to build descending fallback target counts for fresh objective exams.');
}

if (!/classification === "strong"[\s\S]*return 8;/.test(aiSource) || !/topicKind === "document_final_exam"[\s\S]*return 10;/.test(aiSource)) {
  throw new Error('Expected fresh objective target floors to increase for strong topics and document final exams.');
}

if (!/const objectiveCountCandidates = examFormat === "essay"\s*\?\s*\[\]\s*:\s*buildFreshObjectiveCountCandidates\(topic, groundedPack\.evidence, configuredTarget\);/.test(aiSource)) {
  throw new Error('Expected fresh objective count candidates to be computed after grounded evidence is loaded.');
}

if (!/const recommendedFloor = Math\.min\(capacityCap, resolveFreshObjectiveTargetFloor\(topic\)\);/.test(aiSource)) {
  throw new Error('Expected fresh objective target count to use the stronger of the configured target and the recommended floor.');
}

if (!/const hardCap = topicKind === "document_final_exam"[\s\S]*classification === "strong"[\s\S]*\?\s*10[\s\S]*:\s*8;/.test(aiSource)) {
  throw new Error('Expected fresh objective capacity to expand for stronger topics.');
}

if (!/forceQuestionType:\s*"multiple_choice"/.test(aiSource)) {
  throw new Error('Expected fresh objective generation to retry with an MCQ-only fallback.');
}

if (!/for \(const fallbackCount of fallbackCounts\)/.test(aiSource) || !/objective-fallback-reduced-count:\$\{fallbackCount\}/.test(aiSource)) {
  throw new Error('Expected MCQ-only fallback to step down to smaller exact counts when the initial target is too brittle.');
}

if (!/Fallback mode: generate only multiple_choice questions while keeping exact count and citations\./.test(aiSource)) {
  throw new Error('Expected the MCQ-only fallback to inject explicit retry feedback.');
}

if (!/enforceMix:\s*false/.test(aiSource)) {
  throw new Error('Expected fallback objective validation to relax the strict type-mix requirement.');
}

if (!/objective-fallback-mcq-only/.test(aiSource)) {
  throw new Error('Expected successful MCQ-only fallback generations to be tagged in quality warnings.');
}

if (!/const topic = await ctx\.runQuery\(api\.topics\.getTopicWithQuestions, \{/.test(aiSource)) {
  throw new Error('Expected ensureAssessmentRoutingForTopic to stop depending on the fragile internal topic query.');
}

console.log('fresh-exam-objective-fallback-regression.test.mjs passed');
