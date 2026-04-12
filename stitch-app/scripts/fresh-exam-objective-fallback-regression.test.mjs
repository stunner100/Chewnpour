import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/const resolveFreshObjectiveCapacityCap = \(topic: any, evidence: RetrievedEvidence\[\]\) => \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to cap fresh objective counts by grounded evidence capacity.');
}

if (!/const requestedCount = resolveFreshExamTargetCount\(topic, examFormat, groundedPack\.evidence\);/.test(aiSource)) {
  throw new Error('Expected fresh exam target count to be computed after grounded evidence is loaded.');
}

if (!/forceQuestionType:\s*"multiple_choice"/.test(aiSource)) {
  throw new Error('Expected fresh objective generation to retry with an MCQ-only fallback.');
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
