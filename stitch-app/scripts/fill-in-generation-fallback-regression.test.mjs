import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const groundedGenerationPath = path.join(root, 'convex', 'lib', 'groundedGeneration.ts');

const [aiSource, groundedGenerationSource] = await Promise.all([
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(groundedGenerationPath, 'utf8'),
]);

if (!/const FILL_IN_BATCH_FALLBACK_MIN_COUNT = 1;/.test(aiSource)) {
  throw new Error('Expected fill-in generation to accept a usable reduced batch instead of requiring three questions.');
}

if (!/const buildFillInRequestedCountCandidates = \(topic: any, evidenceCount: number\) => \{/.test(aiSource)) {
  throw new Error('Expected fill-in generation to step down through smaller requested counts.');
}

if (!/for \(const requestedCount of requestedCountCandidates\)/.test(aiSource)) {
  throw new Error('Expected fill-in generation to retry across descending requested counts.');
}

if (!/Array\.isArray\(raw\?\.answers\)/.test(aiSource) || !/typeof b === "string"/.test(aiSource)) {
  throw new Error('Expected fill-in question normalization to accept answer-only blank arrays.');
}

if (!/replace\(\/_\{2,\}\/g, "___"\)/.test(aiSource)) {
  throw new Error('Expected fill-in question normalization to standardize blank markers before validation.');
}

if (!/const fallbackExercise = await generateConceptExerciseForTopicCore\(ctx, \{ topicId, userId \}\);/.test(aiSource)) {
  throw new Error('Expected fill-in generation to fall back to the grounded concept generator when batch generation fails.');
}

if (!/const convertConceptExerciseToFillInQuestion = \(exercise: \{/.test(aiSource)) {
  throw new Error('Expected fill-in generation to adapt grounded concept exercises into fill-in questions.');
}

if (!/const buildDeterministicFillInQuestionsFromEvidence = \(args: \{/.test(aiSource)) {
  throw new Error('Expected fill-in generation to expose a deterministic evidence fallback.');
}

if (!/const deterministicFallbackQuestions = buildDeterministicFillInQuestionsFromEvidence\(\{[\s\S]*evidence: groundedPack\.evidence,[\s\S]*topicKeywords,[\s\S]*previousSentences,/.test(aiSource)) {
  throw new Error('Expected fill-in generation to fall back to deterministic grounded evidence questions when model generation fails.');
}

if (!/"blanks" array must list the correct answers in the same order the blanks appear in the sentence\./.test(groundedGenerationSource)) {
  throw new Error('Expected fill-in prompt instructions to stop requiring fragile blank-position metadata.');
}

console.log('fill-in-generation-fallback-regression.test.mjs passed');
