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
const examPreparationsPath = path.join(root, 'convex', 'examPreparations.ts');
const schemaPath = path.join(root, 'convex', 'schema.ts');
const examSecurityPath = path.join(root, 'convex', 'lib', 'examSecurity.js');
const examAttemptReusePath = path.join(root, 'convex', 'lib', 'examAttemptReuse.js');
const examStartPolicyPath = path.join(root, 'convex', 'lib', 'examStartPolicy.js');
const aiPath = path.join(root, 'convex', 'ai.ts');

if (!(await fileExists(examAttemptReusePath))) {
  throw new Error('Expected convex/lib/examAttemptReuse.js to exist.');
}

if (!(await fileExists(examPreparationsPath))) {
  throw new Error('Expected convex/examPreparations.ts to exist.');
}
if (!(await fileExists(examStartPolicyPath))) {
  throw new Error('Expected convex/lib/examStartPolicy.js to exist.');
}

const examSecuritySource = await fs.readFile(examSecurityPath, 'utf8');
if (!/export const ensureUniqueAnswerQuestionIds/.test(examSecuritySource)) {
  throw new Error('Expected examSecurity.js to export ensureUniqueAnswerQuestionIds.');
}
if (!/export const isUsableExamQuestion/.test(examSecuritySource)) {
  throw new Error('Expected examSecurity.js to export isUsableExamQuestion.');
}

const [examsSource, preparationsSource, schemaSource, aiSource] = await Promise.all([
  fs.readFile(examsPath, 'utf8'),
  fs.readFile(examPreparationsPath, 'utf8'),
  fs.readFile(schemaPath, 'utf8'),
  fs.readFile(aiPath, 'utf8'),
]);

if (!/export const ensurePreparedExamAttemptInternal = internalMutation/.test(examsSource)) {
  throw new Error('Expected exams.ts to expose an internal attempt-creation mutation for prepared exams.');
}
if (/export const startExamAttempt = action/.test(examsSource)) {
  throw new Error('Regression detected: the old startExamAttempt action should be removed in the Phase 1 cutover.');
}
if (!/canReuseExamAttempt\(\{\s*[\s\S]*examFormat,/.test(examsSource)) {
  throw new Error('Expected prepared-attempt reuse checks to include requested exam format.');
}
if (!/resolveAssessmentCapacity/.test(examsSource) || !/const requiredQuestionCount = capacity\.attemptTargetCount/.test(examsSource)) {
  throw new Error('Expected the prepared-attempt mutation to derive required counts from dynamic assessment capacity.');
}
if (!/allowPartialReady:\s*v\.optional\(v\.boolean\(\)\)/.test(examsSource)) {
  throw new Error('Expected prepared-attempt creation to accept an allowPartialReady override after generation.');
}
if (!/usableQuestions\.length < requiredQuestionCount && !allowPartialReady/.test(examsSource)) {
  throw new Error('Expected prepared-attempt checks to block undersized banks only before the partial-start fallback is allowed.');
}
if (!/resolvePreparedExamStart/.test(examsSource)) {
  throw new Error('Expected exams.ts to resolve post-generation partial-start decisions through the shared start-policy helper.');
}
if (!/extra field `examFormat`/.test(examsSource) || !/legacyAttemptDocument/.test(examsSource)) {
  throw new Error('Expected prepared-attempt creation to preserve the legacy schema fallback for examFormat.');
}

for (const requiredPattern of [
  /export const createOrReusePreparationInternal = internalMutation/,
  /export const markPreparationStageInternal = internalMutation/,
  /export const runExamPreparationInternal = internalAction/,
  /export const startExamPreparation = action/,
  /export const getExamPreparation = query/,
  /export const retryExamPreparation = mutation/,
]) {
  if (!requiredPattern.test(preparationsSource)) {
    throw new Error('Expected convex/examPreparations.ts to expose the full preparation lifecycle.');
  }
}

if (!/ctx\.scheduler\.runAfter\(0,\s*internal\.examPreparations\.runExamPreparationInternal/.test(preparationsSource)) {
  throw new Error('Expected exam preparation starts and retries to schedule the internal preparation runner.');
}
if (!/resolveAssessmentCapacity/.test(preparationsSource)) {
  throw new Error('Expected exam preparations to resolve dynamic attempt and bank counts through the shared capacity helper.');
}
if (!/const canCreateFreshPreparationFromCurrentBank\s*=\s*usableQuestionCount >= capacity\.attemptTargetCount/.test(preparationsSource)) {
  throw new Error('Expected exam preparations to detect when the current bank is already large enough to replace stale terminal preparations.');
}
if (!/if \(preparation\.status === "failed" \|\| preparation\.status === "unavailable"\) \{\s*if \(canCreateFreshPreparationFromCurrentBank\) \{\s*continue;/s.test(preparationsSource)) {
  throw new Error('Expected stale failed or unavailable preparations to be bypassed when the current bank can now start a fresh exam.');
}
if (!/await ctx\.runAction\(internal\.ai\.generateEssayQuestionsForTopicOnDemandInternal/.test(preparationsSource)) {
  throw new Error('Expected essay preparation to trigger only the requested on-demand essay generator.');
}
if (!/await ctx\.runAction\(internal\.ai\.generateQuestionsForTopicOnDemandInternal/.test(preparationsSource)) {
  throw new Error('Expected MCQ preparation to trigger only the requested on-demand MCQ generator.');
}
if (!/allowPartialReady:\s*true/.test(preparationsSource)) {
  throw new Error('Expected the post-generation prepared-attempt pass to allow partial ready exams when usable questions exist.');
}

if (!/examPreparations:\s*defineTable\(\{[\s\S]*status:\s*v\.string\(\)[\s\S]*stage:\s*v\.string\(\)[\s\S]*attemptTargetCount:\s*v\.number\(\)[\s\S]*bankTargetCount:\s*v\.number\(\)/.test(schemaSource)) {
  throw new Error('Expected schema.ts to define the examPreparations state machine table.');
}

if (!/examAttempts:\s*defineTable\(\{[\s\S]*examFormat:\s*v\.optional\(v\.string\(\)\)/.test(schemaSource)) {
  throw new Error('Expected examAttempts schema to keep optional examFormat.');
}

if (!/const runMcqGenerationWithLock = async/.test(aiSource) || !/const runEssayGenerationWithLock = async/.test(aiSource)) {
  throw new Error('Expected ai.ts to enforce locking for both MCQ and essay generation.');
}
if (!/export const generateQuestionsForTopicOnDemandInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose an on-demand internal MCQ generator.');
}
if (!/export const generateEssayQuestionsForTopicOnDemandInternal = internalAction/.test(aiSource)) {
  throw new Error('Expected ai.ts to expose an on-demand internal essay generator.');
}

console.log('exam-flow-hardening-regression.test.mjs passed');
