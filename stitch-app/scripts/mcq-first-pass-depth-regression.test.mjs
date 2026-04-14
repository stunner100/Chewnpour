import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const configModuleUrl = pathToFileURL(path.join(root, "convex", "lib", "questionBankConfig.js")).href;
const {
  QUESTION_BANK_BACKGROUND_PROFILE,
  QUESTION_BANK_INTERACTIVE_PROFILE,
  rebaseQuestionBankTargetAfterRun,
} = await import(configModuleUrl);

if (QUESTION_BANK_BACKGROUND_PROFILE.preserveThinFirstPassTarget !== true) {
  throw new Error("Expected background MCQ profile to preserve thin first-pass target depth.");
}

if (QUESTION_BANK_INTERACTIVE_PROFILE.preserveThinFirstPassTarget === true) {
  throw new Error("Did not expect interactive MCQ profile to preserve thin first-pass target depth.");
}

const preservedTarget = rebaseQuestionBankTargetAfterRun({
  targetCount: 10,
  initialCount: 0,
  finalCount: 3,
  addedCount: 3,
  outcome: "no_progress_limit_reached",
  minTarget: 1,
  supportTargetCount: 10,
  minimumRetainedTarget: 5,
  preserveThinFirstPassTarget: QUESTION_BANK_BACKGROUND_PROFILE.preserveThinFirstPassTarget,
  thinFirstPassMaxRatio: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxRatio,
  thinFirstPassMaxCount: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxCount,
});

if (preservedTarget !== 10) {
  throw new Error(`Expected thin first-pass MCQ run to preserve requested target 10, got ${preservedTarget}.`);
}

const rebasedTarget = rebaseQuestionBankTargetAfterRun({
  targetCount: 10,
  initialCount: 4,
  finalCount: 5,
  addedCount: 1,
  outcome: "no_progress_limit_reached",
  minTarget: 1,
  supportTargetCount: 10,
  minimumRetainedTarget: 5,
  preserveThinFirstPassTarget: QUESTION_BANK_BACKGROUND_PROFILE.preserveThinFirstPassTarget,
  thinFirstPassMaxRatio: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxRatio,
  thinFirstPassMaxCount: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxCount,
});

if (rebasedTarget !== 5) {
  throw new Error(`Expected later partially-filled run to retain a smaller target of 5, got ${rebasedTarget}.`);
}

const insufficientEvidenceTarget = rebaseQuestionBankTargetAfterRun({
  targetCount: 10,
  initialCount: 0,
  finalCount: 2,
  addedCount: 2,
  outcome: "insufficient_evidence",
  minTarget: 1,
  supportTargetCount: 2,
  minimumRetainedTarget: 5,
  preserveThinFirstPassTarget: QUESTION_BANK_BACKGROUND_PROFILE.preserveThinFirstPassTarget,
  thinFirstPassMaxRatio: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxRatio,
  thinFirstPassMaxCount: QUESTION_BANK_BACKGROUND_PROFILE.thinFirstPassMaxCount,
});

if (insufficientEvidenceTarget !== 2) {
  throw new Error(`Expected insufficient-evidence run to rebase down to 2, got ${insufficientEvidenceTarget}.`);
}

console.log("mcq-first-pass-depth-regression.test.mjs passed");
