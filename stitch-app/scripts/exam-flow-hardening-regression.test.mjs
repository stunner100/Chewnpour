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
const startActionStart = examsSource.indexOf('export const startExamAttempt = action({');
const submitMutationStart = examsSource.indexOf('export const submitExamAttempt = mutation({');
const getAttemptsStart = examsSource.indexOf('export const getUserExamAttempts = query({');
const startActionSource = startActionStart >= 0 && submitMutationStart > startActionStart
  ? examsSource.slice(startActionStart, submitMutationStart)
  : '';
const submitMutationSource = submitMutationStart >= 0 && getAttemptsStart > submitMutationStart
  ? examsSource.slice(submitMutationStart, getAttemptsStart)
  : '';
const dedupeCalls = examsSource.match(/ensureUniqueAnswerQuestionIds\(args\.answers\);/g) || [];
if (dedupeCalls.length < 2) {
  throw new Error('Expected both MCQ and essay submit paths to enforce unique submitted questionIds.');
}
if (!/canReuseExamAttempt\(\{\s*[\s\S]*examFormat,/.test(examsSource)) {
  throw new Error('Expected startExamAttempt reuse checks to include requested exam format.');
}
if (!/question\.questionType === "essay"/.test(examsSource)) {
  throw new Error('Expected essay format filtering in exam question selection/reuse logic.');
}
if (!/const EXAM_QUESTION_SUBSET_SIZE = 35;/.test(examsSource)) {
  throw new Error('Expected MCQ exam subset size ceiling to remain 35.');
}
if (!/const EXAM_ESSAY_QUESTION_SUBSET_SIZE = 15;/.test(examsSource)) {
  throw new Error('Expected essay exam subset size ceiling to remain 15.');
}
if (!/const resolveAttemptQuestionCount = \(\{[\s\S]*usableQuestionCount[\s\S]*isEssay/.test(examsSource)) {
  throw new Error('Expected exams.ts to resolve attempt size from the usable bank and exam format.');
}
if (!/const targetQuestionCount = resolveAttemptQuestionCount\(\{[\s\S]*usableQuestionCount:\s*usableQuestions\.length[\s\S]*isEssay,\s*\}\);/.test(examsSource)) {
  throw new Error('Expected startExamAttempt preparation to derive targetQuestionCount from usableQuestions.length.');
}
if (!/if \(targetQuestionCount <= 0\)/.test(examsSource)) {
  throw new Error('Expected startExamAttempt preparation to defer only when no usable questions exist.');
}
if (!/subsetSize:\s*targetQuestionCount/.test(examsSource)) {
  throw new Error('Expected startExamAttempt preparation to size selections from targetQuestionCount.');
}
if (!/if \(selectedQuestions\.length === 0\)/.test(examsSource)) {
  throw new Error('Expected startExamAttempt preparation to allow recycled retakes whenever the selector returns questions.');
}
if (/selectedQuestions\.length < requiredQuestionCount \|\| selection\.requiresFreshGeneration/.test(examsSource)) {
  throw new Error('Regression detected: exams.ts should not block recycled retakes on requiresFreshGeneration.');
}
if (!/export const prepareStartExamAttemptInternal = internalMutation/.test(examsSource)) {
  throw new Error('Expected exams.ts to expose an internal start-preparation mutation.');
}
if (!/export const startExamAttempt = action/.test(examsSource)) {
  throw new Error('Expected exams.ts to expose startExamAttempt as an action.');
}
if (!/await ctx\.runAction\(internal\.ai\.generateEssayQuestionsForTopicOnDemandInternal/.test(examsSource)) {
  throw new Error('Expected essay start flow to trigger only the requested on-demand essay generator.');
}
if (!/await ctx\.runAction\(internal\.ai\.generateQuestionsForTopicOnDemandInternal/.test(examsSource)) {
  throw new Error('Expected MCQ start flow to trigger only the requested on-demand MCQ generator.');
}
if (/ctx\.scheduler\.runAfter/.test(startActionSource)) {
  throw new Error('Regression detected: startExamAttempt should not schedule background top-ups from the student start flow.');
}
if (/ctx\.scheduler\.runAfter/.test(submitMutationSource)) {
  throw new Error('Regression detected: submitExamAttempt should not schedule background top-ups after submission.');
}
if (!/extra field `examFormat`/.test(examsSource) || !/legacyAttemptDocument/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to gracefully retry insert without examFormat for legacy schema compatibility.');
}
if (!/Preparing a full essay exam\./.test(examsSource) || !/Preparing a full multiple-choice exam\./.test(examsSource)) {
  throw new Error('Expected deferred start responses to explain that a full exam set is being prepared.');
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
if (!/const runMcqGenerationWithLock = async/.test(aiSource) || !/const runEssayGenerationWithLock = async/.test(aiSource)) {
  throw new Error('Expected ai.ts to enforce locking for both MCQ and essay generation.');
}
if (!/export const generateQuestionsForTopicOnDemandInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose an on-demand internal MCQ generator for blocking exam starts.');
}
if (!/export const generateEssayQuestionsForTopicOnDemandInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose an on-demand internal essay generator for blocking exam starts.');
}

console.log('exam-flow-hardening-regression.test.mjs passed');
