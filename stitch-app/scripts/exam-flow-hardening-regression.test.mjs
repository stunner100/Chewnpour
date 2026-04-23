import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const examsPath = path.join(root, 'convex', 'exams.ts');
const schemaPath = path.join(root, 'convex', 'schema.ts');
const aiPath = path.join(root, 'convex', 'ai.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');

const [examsSource, schemaSource, aiSource, examModeSource] = await Promise.all([
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
  fs.readFile(examModePath, 'utf8'),
]);

if (!/export const getExamTopicAccessContextInternal = internalQuery/.test(examsSource)) {
  throw new Error('Expected exams.ts to expose getExamTopicAccessContextInternal for auth-safe fresh starts.');
}

if (!/export const createFreshExamAttemptInternal = internalMutation/.test(examsSource)) {
  throw new Error('Expected exams.ts to persist fresh exam attempts through createFreshExamAttemptInternal.');
}

if (!/ctx\.runAction\(internal\.ai\.generateFreshExamSnapshotInternal/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to generate exams from the fresh-context snapshot action.');
}

if (!/ctx\.runMutation\(internal\.exams\.createFreshExamAttemptInternal/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to persist generated snapshots via createFreshExamAttemptInternal.');
}

if (/generateQuestionsForTopicOnDemandInternal/.test(examsSource) || /generateEssayQuestionsForTopicOnDemandInternal/.test(examsSource)) {
  throw new Error('Regression detected: startExamAttempt should not call bank-generation actions anymore.');
}

if (/prepareStartExamAttemptInternal/.test(examsSource)) {
  throw new Error('Regression detected: prepareStartExamAttemptInternal should be removed after the hard cutover.');
}

if (/buildDeferredStartResponse/.test(examsSource) || /Preparing a full multiple-choice exam/.test(examsSource) || /Preparing a full essay exam/.test(examsSource)) {
  throw new Error('Regression detected: exams.ts should not expose deferred question-bank start responses.');
}

if (!/generatedQuestions:\s*v\.optional\(v\.array\(v\.any\(\)\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to persist generatedQuestions.');
}

if (!/generationContext:\s*v\.optional\(v\.any\(\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to persist generationContext.');
}

if (!/gradingContext:\s*v\.optional\(v\.any\(\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to persist gradingContext.');
}

if (!/questionMix:\s*v\.optional\(v\.any\(\)\)/.test(schemaSource) || !/generationMode:\s*v\.optional\(v\.string\(\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to persist questionMix and generationMode.');
}

if (!/questionId:\s*v\.union\(v\.id\("questions"\),\s*v\.string\(\)\)/.test(examsSource)) {
  throw new Error('Expected exam submit APIs to accept string snapshot question ids.');
}

if (!/buildGeneratedQuestionMap\(attempt\)/.test(examsSource) || !/getAttemptGradingContextMap\(attempt\)/.test(examsSource)) {
  throw new Error('Expected exam grading to read from generated question snapshots and grading context.');
}

if (
  !/const activePreparationMessage = typeof preparation\?\.message === 'string' && preparation\.message\.trim\(\)/.test(examModeSource)
  || !/:\s*`Generating your \$\{loadingExamTypeLabel\} exam from this topic\.`;/.test(examModeSource)
) {
  throw new Error('Expected ExamMode to prefer live preparation messaging with a fresh-generation fallback.');
}

if (!/export const generateFreshExamSnapshotInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose generateFreshExamSnapshotInternal.');
}

if (!/const FRESH_CONTEXT_EXAM_PROMPT_VERSION = "fresh_context_v1";/.test(aiSource)) {
  throw new Error('Expected ai.ts to define a fresh-context prompt version.');
}

console.log('exam-flow-hardening-regression.test.mjs passed');
