import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const examsPath = path.join(root, 'convex', 'exams.ts');
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');

const aiSource = await fs.readFile(aiPath, 'utf8');
const examsSource = await fs.readFile(examsPath, 'utf8');
const examModeSource = await fs.readFile(examModePath, 'utf8');

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
  throw new Error('Expected fresh exam authoring to use a bounded timeout before falling back.');
}

if (!/const buildDeterministicFreshExamFallbackSnapshot = \(/.test(aiSource)) {
  throw new Error('Expected ai.ts to define a deterministic fresh exam fallback snapshot for authoring failures.');
}

if (!/deterministic-fresh-exam-fallback/.test(aiSource)) {
  throw new Error('Expected deterministic fresh exam fallback snapshots to include an explicit quality warning.');
}

if (!/isFreshExamAuthoringFallbackEligibleError\(error\)[\s\S]*buildDeterministicFreshExamFallbackSnapshot\(\{/.test(aiSource)) {
  throw new Error('Expected fresh exam authoring timeouts/network failures to return a deterministic fallback snapshot.');
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

if (!/setAttemptQualityTier\(typeof result\?\.qualityTier === 'string' \? result\.qualityTier : ''\);/.test(examModeSource)) {
  throw new Error('Expected ExamMode to store the snapshot qualityTier into component state on successful start.');
}

if (/These questions were generated without a grounded evidence index/.test(examModeSource)) {
  throw new Error('Expected ExamMode not to render the old unverified exam disclaimer.');
}

console.log('exam-unverified-fallback-regression.test.mjs passed');
