import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) =>
  fs.readFile(path.join(root, relativePath), 'utf8');

const examsSource = await read('convex/exams.ts');
const schemaSource = await read('convex/schema.ts');

for (const pattern of [
  'const failMcqSubmission = (message: string, code = "EXAM_SUBMISSION_INVALID"): never => {',
  'Please submit at most one answer per question.',
  'This exam session is out of sync. Please restart the exam and try again.',
  'One or more questions from this exam could not be found. Please restart the exam.',
  'This exam session is out of sync. Please restart the exam in multiple-choice mode.',
  'code: "EXAM_SUBMISSION_FAILED"',
  'if (error instanceof ConvexError) {',
]) {
  if (!examsSource.includes(pattern)) {
    throw new Error(`Expected convex/exams.ts to include "${pattern}".`);
  }
}

const examModeSource = await read('src/pages/ExamMode.jsx');

for (const pattern of [
  "captureSentryMessage('Exam submission rejected by validation'",
  'const recoverableError = isRecoverableExamSubmitError({ error, message });',
  "normalized.includes('at most one answer per question')",
  "normalized.includes('could not be found')",
  "normalized.includes('multiple-choice mode')",
]) {
  if (!examModeSource.includes(pattern)) {
    throw new Error(`Expected src/pages/ExamMode.jsx to include "${pattern}".`);
  }
}

for (const pattern of [
  'objectiveGenerationLockedUntil: v.optional(v.number())',
  'objectiveTargetCount: v.optional(v.number())',
  'usableObjectiveCount: v.optional(v.number())',
  'usableObjectiveBreakdown: v.optional(v.any())',
  'assessmentBlueprint: v.optional(v.any())',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected convex/schema.ts to include "${pattern}".`);
  }
}

for (const pattern of [
  'generationRunId: v.optional(v.string())',
  'clarityScore: v.optional(v.number())',
  'distractorScore: v.optional(v.number())',
  'diversityCluster: v.optional(v.string())',
  'freshnessBucket: v.optional(v.string())',
  'qualityScore: v.optional(v.number())',
  'qualityTier: v.optional(v.string())',
  'rigorScore: v.optional(v.number())',
  'tokens: v.optional(v.array(v.string()))',
  'templateParts: v.optional(v.array(v.string()))',
  'acceptedAnswers: v.optional(v.array(v.string()))',
  'fillBlankMode: v.optional(v.string())',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected convex/schema.ts to include "${pattern}".`);
  }
}

for (const pattern of [
  'premiumTargetMet: v.optional(v.boolean())',
  'qualitySignals: v.optional(v.any())',
  'qualityTier: v.optional(v.string())',
  'qualityWarnings: v.optional(v.array(v.string()))',
]) {
  if (!schemaSource.includes(pattern)) {
    throw new Error(`Expected convex/schema.ts to include "${pattern}".`);
  }
}

console.log('exam-submit-resilience-regression.test.mjs passed');
