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

if (/if \(!groundedPack\.index \|\| groundedPack\.evidence\.length === 0\) \{\s*throw new ConvexError\(\{\s*code: "EXAM_GENERATION_FAILED",\s*message: "We couldn't find enough grounded evidence/.test(aiSource)) {
  throw new Error('Expected the early EXAM_GENERATION_FAILED throw on missing grounded evidence to be replaced by the synthetic-evidence fallback.');
}

if (!/const buildFreshEssayCountCandidates = \(/.test(aiSource)) {
  throw new Error('Expected ai.ts to define buildFreshEssayCountCandidates for the essay step-down ladder.');
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

if (!/examQualityTier === 'unverified'/.test(examModeSource)) {
  throw new Error('Expected ExamMode to render an Unverified banner when the attempt qualityTier is "unverified".');
}

console.log('exam-unverified-fallback-regression.test.mjs passed');
