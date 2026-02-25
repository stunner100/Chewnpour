import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const examsPath = path.join(root, 'convex', 'exams.ts');
const schemaPath = path.join(root, 'convex', 'schema.ts');
const examSecurityPath = path.join(root, 'convex', 'lib', 'examSecurity.js');
const examAttemptReusePath = path.join(root, 'convex', 'lib', 'examAttemptReuse.js');
const uploadObservabilityPath = path.join(root, 'src', 'lib', 'uploadObservability.js');
const dashboardAnalysisPath = path.join(root, 'src', 'pages', 'DashboardAnalysis.jsx');
const dashboardResultsPath = path.join(root, 'src', 'pages', 'DashboardResults.jsx');
const aiPath = path.join(root, 'convex', 'ai.ts');

if (!(await fileExists(examAttemptReusePath))) {
  throw new Error('Expected convex/lib/examAttemptReuse.js to exist.');
}

if (!(await fileExists(uploadObservabilityPath))) {
  throw new Error('Expected src/lib/uploadObservability.js to exist.');
}

const examSecuritySource = await fs.readFile(examSecurityPath, 'utf8');
if (!/export const ensureUniqueAnswerQuestionIds/.test(examSecuritySource)) {
  throw new Error('Expected examSecurity.js to export ensureUniqueAnswerQuestionIds.');
}
if (!/export const isUsableExamQuestion/.test(examSecuritySource)) {
  throw new Error('Expected examSecurity.js to export isUsableExamQuestion.');
}

const examsSource = await fs.readFile(examsPath, 'utf8');
const schemaSource = await fs.readFile(schemaPath, 'utf8');
const dedupeCalls = examsSource.match(/ensureUniqueAnswerQuestionIds\(args\.answers\);/g) || [];
if (dedupeCalls.length < 2) {
  throw new Error('Expected both MCQ and essay submit paths to enforce unique submitted questionIds.');
}
if (!/examFormat:\s*isEssay\s*\?\s*"essay"\s*:\s*"mcq"/.test(examsSource)) {
  throw new Error('Expected startExamAttempt reuse checks to include requested exam format.');
}
if (!/question\.questionType === "essay"/.test(examsSource)) {
  throw new Error('Expected essay format filtering in exam question selection/reuse logic.');
}
if (!/const EXAM_QUESTION_SUBSET_SIZE = 35;/.test(examsSource)) {
  throw new Error('Expected MCQ exam subset size to be 35.');
}
if (!/const EXAM_ESSAY_QUESTION_SUBSET_SIZE = 15;/.test(examsSource)) {
  throw new Error('Expected essay exam subset size to be 15.');
}
if (!/count:\s*EXAM_ESSAY_QUESTION_SUBSET_SIZE/.test(examsSource)) {
  throw new Error('Expected essay fallback generation count to use EXAM_ESSAY_QUESTION_SUBSET_SIZE.');
}
if (!/selectedQuestions\.length < EXAM_QUESTION_SUBSET_SIZE/.test(examsSource)) {
  throw new Error('Expected MCQ startExamAttempt to trigger non-blocking top-up for low-count topics.');
}
if (!/selectedQuestions\.length < EXAM_ESSAY_QUESTION_SUBSET_SIZE/.test(examsSource)) {
  throw new Error('Expected essay startExamAttempt to trigger non-blocking top-up for low-count topics.');
}
if (!/internal\.ai\.generateEssayQuestionsForTopicInternal/.test(examsSource)) {
  throw new Error('Expected essay fallback path to schedule essay question generation.');
}
if (!/extra field `examFormat`/.test(examsSource) || !/legacyAttemptDocument/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to gracefully retry insert without examFormat for legacy schema compatibility.');
}
if (!/Essay questions are being prepared\. Please try again in a few seconds\./.test(examsSource)) {
  throw new Error('Expected explicit essay-generation retry message when no essay questions are available.');
}
if (!/examAttempts:\s*defineTable\(\{[\s\S]*examFormat:\s*v\.optional\(v\.string\(\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to include optional examFormat field.');
}
if (!/const completedAttempts = allAttempts\.filter/.test(examsSource)) {
  throw new Error('Expected performance insights to filter incomplete attempts.');
}
if (!/Array\.isArray\(attempt\.answers\) && attempt\.answers\.length > 0/.test(examsSource)) {
  throw new Error('Expected performance insights to only include attempts with recorded answers.');
}
if (!/for \(const attempt of completedAttempts\)/.test(examsSource)) {
  throw new Error('Expected performance insights aggregation to iterate over completed attempts only.');
}

const dashboardAnalysisSource = await fs.readFile(dashboardAnalysisPath, 'utf8');
if (!/from '\.\.\/lib\/uploadObservability'/.test(dashboardAnalysisSource)) {
  throw new Error('Expected DashboardAnalysis.jsx to import uploadObservability helpers from src/lib/uploadObservability.js.');
}

const dashboardResultsSource = await fs.readFile(dashboardResultsPath, 'utf8');
if (!/<TutorReport key=\{attemptId\} attemptId=\{attemptId\} storedFeedback=\{attempt\.tutorFeedback\} \/>/.test(dashboardResultsSource)) {
  throw new Error('Expected DashboardResults.jsx to key TutorReport by attemptId to avoid stale tutor feedback state.');
}
if (/if \(!attemptId \|\| loading \|\| feedback\) return;/.test(dashboardResultsSource)) {
  throw new Error('Expected DashboardResults.jsx to remove stale guard that blocks tutor feedback refresh for new attempts.');
}

const aiSource = await fs.readFile(aiPath, 'utf8');
if (!/export const generateEssayQuestionsForTopicInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose an internal essay question generator for scheduler fallback.');
}
if (!/export const generateQuestionsForTopic = action/.test(aiSource) || !/internal\.ai\.generateQuestionsForTopicInternal/.test(aiSource)) {
  throw new Error('Expected interactive question generation to schedule non-blocking background top-up.');
}

console.log('exam-flow-hardening-regression.test.mjs passed');
