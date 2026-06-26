import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const examsPath = path.join(root, 'convex', 'exams.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const examAttemptHookPath = path.join(root, 'src', 'hooks', 'useExamAttempt.js');
const examActiveSessionPath = path.join(root, 'src', 'components', 'ExamActiveSession.jsx');

const aiSource = await fs.readFile(aiPath, 'utf8');
const examsSource = await fs.readFile(examsPath, 'utf8');
const examModeSource = await fs.readFile(examModePath, 'utf8');
const examAttemptHookSource = await fs.readFile(examAttemptHookPath, 'utf8');
const examActiveSessionSource = await fs.readFile(examActiveSessionPath, 'utf8');

if (!/const buildSyntheticEvidenceFromTopic = \(/.test(aiSource)) {
  throw new Error('Expected ai.ts to define buildSyntheticEvidenceFromTopic for the unverified fallback path.');
}

if (!/snapshotQualityTier = "unverified";/.test(aiSource)) {
  throw new Error('Expected generateFreshExamSnapshotInternal to mark the snapshot as unverified when grounded evidence is missing.');
}

if (!/const usesOnlyIndexFallback =\s*groundedPack\?\.usedIndexFallback === true[\s\S]*&& !hasGroundedRetrievalHits[\s\S]*&& effectiveEvidence\.length > 0;/.test(aiSource)) {
  throw new Error('Expected index-fallback-only evidence to be treated as unverified when retrieval has no grounded hits.');
}

if (!/if \(!effectiveIndex \|\| effectiveEvidence\.length === 0 \|\| usesOnlyIndexFallback\)/.test(aiSource)) {
  throw new Error('Expected the unverified fallback branch to run for empty evidence or index-fallback-only evidence.');
}

if (/if \(!groundedPack\.index \|\| groundedPack\.evidence\.length === 0\) \{\s*throw new ConvexError\(\{\s*code: "EXAM_GENERATION_FAILED",\s*message: "We couldn't find enough grounded evidence/.test(aiSource)) {
  throw new Error('Expected the early EXAM_GENERATION_FAILED throw on missing grounded evidence to be replaced by the synthetic-evidence fallback.');
}

if (!/const buildFreshEssayCountCandidates = \(/.test(aiSource)) {
  throw new Error('Expected ai.ts to define buildFreshEssayCountCandidates for the essay step-down ladder.');
}

if (!/const FRESH_CONTEXT_BLUEPRINT_TIMEOUT_MS = Math\.max\([\s\S]*30000/.test(aiSource)) {
  throw new Error('Expected fresh exam blueprint generation to use a bounded timeout so startup stays within the browser request window.');
}

if (!/const FRESH_CONTEXT_AUTHORING_TIMEOUT_MS = Math\.max\([\s\S]*45000/.test(aiSource)) {
  throw new Error('Expected fresh exam authoring to use a bounded timeout before returning a retryable failure.');
}

for (const forbidden of [
  'buildDeterministicFreshExamFallbackSnapshot',
  'buildDeterministicFreshObjectiveQuestions',
  'buildDeterministicFreshEssayQuestions',
  'deterministic-fresh-exam-fallback',
  'fresh-deterministic-objective',
  'fresh-deterministic-essay',
  'Which statement is directly supported by Evidence',
  'cannot be assessed from the lesson material',
  'The cited evidence is unrelated to the current lesson topic.',
  'The cited evidence gives no useful information for answering the question.',
]) {
  if (aiSource.includes(forbidden)) {
    throw new Error(`Expected fresh exam generation not to contain deterministic fallback question text: ${forbidden}`);
  }
}

if (!/authoring_failed_without_deterministic_fallback/.test(aiSource)) {
  throw new Error('Expected fresh exam authoring failures to be logged without serving deterministic fallback questions.');
}

if (!/throw new ConvexError\(\{[\s\S]*code: "EXAM_GENERATION_FAILED"[\s\S]*Please try again/.test(aiSource)) {
  throw new Error('Expected fresh exam authoring failures to return a retryable error instead of a fallback exam snapshot.');
}

if (!/const recommendedFloor = topicKind === "document_final_exam" \? 3 : 1;/.test(aiSource)) {
  throw new Error('Expected normal essay exams to preserve the configured/default target instead of forcing a three-question floor.');
}

if (/const recommendedFloor = topicKind === "document_final_exam" \? 3 : 3;/.test(aiSource)) {
  throw new Error('Expected the essay count ladder not to force ordinary topic essays to at least three questions.');
}

if (!/for \(const fallbackCount of essayFallbackCounts\)/.test(aiSource)) {
  throw new Error('Expected generateFreshExamSnapshotInternal to iterate an essay step-down ladder on validation failure.');
}

if (!/qualityTier\?: string;/.test(aiSource)) {
  throw new Error('Expected buildFreshExamSnapshot to accept an optional qualityTier argument.');
}

if (!/qualityTier: v\.optional\(v\.string\(\)\),\s*\},\s*handler: async \(ctx, args\) => \{\s*return await ctx\.db\.insert\("examAttempts"/.test(examsSource)) {
  throw new Error('Expected createFreshExamAttemptInternal to accept an optional qualityTier argument.');
}

if (!/qualityTier: typeof snapshot\?\.qualityTier === "string" \? snapshot\.qualityTier : undefined,/.test(examsSource)) {
  throw new Error('Expected startExamAttempt to propagate snapshot qualityTier into the attempt record.');
}

// The exam page was split into the useExamAttempt hook + ExamActiveSession, so
// the snapshot qualityTier is now captured in the hook (via examState) rather
// than directly in ExamMode.jsx.
if (!/qualityTier: typeof result\?\.qualityTier === 'string' \? result\.qualityTier : '',/.test(examAttemptHookSource)) {
  throw new Error('Expected useExamAttempt to capture the snapshot qualityTier from the start result into exam state.');
}

if (!/examQualityTier=\{attemptQualityTier\}/.test(examModeSource)) {
  throw new Error('Expected ExamMode to forward the captured qualityTier to the active exam session.');
}

// Unverified (synthetic-evidence) exams must warn the learner so the questions
// are not presented with the same trust as verified ones.
if (!/examQualityTier === 'unverified'/.test(examActiveSessionSource)) {
  throw new Error('Expected ExamActiveSession to render an unverified-exam notice when the quality tier is unverified.');
}

if (/These questions were generated without a grounded evidence index/.test(examModeSource)
    || /These questions were generated without a grounded evidence index/.test(examActiveSessionSource)) {
  throw new Error('Expected the app not to render the old unverified exam disclaimer.');
}

console.log('exam-unverified-fallback-regression.test.mjs passed');
