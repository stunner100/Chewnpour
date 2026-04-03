import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "convex", "schema.ts");
const preparationsPath = path.join(root, "convex", "examPreparations.ts");
const versioningPath = path.join(root, "convex", "lib", "examVersioning.js");
const extractionStatePath = path.join(root, "convex", "extractionState.ts");
const assessmentBlueprintPath = path.join(root, "convex", "lib", "assessmentBlueprint.js");
const topicsPath = path.join(root, "convex", "topics.ts");

const [
  schemaSource,
  preparationsSource,
  versioningSource,
  extractionStateSource,
  assessmentBlueprintSource,
  topicsSource,
] = await Promise.all([
  fs.readFile(schemaPath, "utf8"),
  fs.readFile(preparationsPath, "utf8"),
  fs.readFile(versioningPath, "utf8"),
  fs.readFile(extractionStatePath, "utf8"),
  fs.readFile(assessmentBlueprintPath, "utf8"),
  fs.readFile(topicsPath, "utf8"),
]);

if (!/topics:\s*defineTable\(\{[\s\S]*questionSetVersion:\s*v\.optional\(v\.number\(\)\)/.test(schemaSource)) {
  throw new Error("Expected topics schema to persist questionSetVersion.");
}

for (const tableName of ["questions", "examAttempts", "examPreparations"]) {
  const pattern = new RegExp(`${tableName}:\\s*defineTable\\(\\{[\\s\\S]*questionSetVersion:\\s*v\\.optional\\(v\\.number\\(\\)\\)`);
  if (!pattern.test(schemaSource)) {
    throw new Error(`Expected ${tableName} schema to persist questionSetVersion.`);
  }
}

if (!/assessmentVersion:\s*v\.optional\(v\.string\(\)\)/.test(schemaSource)) {
  throw new Error("Expected exam attempt persistence to record assessmentVersion.");
}

if (!/export const resolveTopicQuestionSetVersion/.test(versioningSource)) {
  throw new Error("Expected examVersioning.js to expose the topic question-set resolver.");
}

if (!/export const isExamSnapshotCompatible/.test(versioningSource)) {
  throw new Error("Expected examVersioning.js to expose shared snapshot compatibility checks.");
}

if (/targetDifficultyDistribution|difficultyBand/.test(versioningSource)) {
  throw new Error("Expected saved exam compatibility to stay independent of global difficulty-policy changes.");
}

if (!/const createExamAttemptSnapshot = async/.test(preparationsSource)) {
  throw new Error("Expected exam preparations to clone fresh attempts from a persisted exam set.");
}

if (!/questionSetVersion,\s*\n\s*assessmentVersion:\s*requestedAssessmentVersion/.test(preparationsSource)) {
  throw new Error("Expected new preparations and cloned attempts to stamp the current question-set and assessment versions.");
}

if (!/preparationCompatible = isExamSnapshotCompatible/.test(preparationsSource)) {
  throw new Error("Expected exam preparations to reject stale preparations after topic or assessment changes.");
}

if (!/This saved exam set is outdated because the topic changed/.test(preparationsSource)) {
  throw new Error("Expected stale preparation reads to surface a clear outdated exam-set message.");
}

if (!/preparation.status !== "failed" && preparationCompatible/.test(preparationsSource)) {
  throw new Error("Expected retryExamPreparation to allow retries for stale preparations even when the stored status is not failed.");
}

if (!/assessmentBlueprint:\s*undefined/.test(extractionStateSource) || !/questionSetVersion/.test(extractionStateSource)) {
  throw new Error("Expected topic content patches to invalidate the assessment blueprint and bump the question-set version.");
}

if (!/questionSetVersion,\s*\n\s*examReady: false/.test(topicsSource)) {
  throw new Error("Expected assessment blueprint changes to roll the topic question-set version.");
}

if (!/const activeQuestionSetItems = currentQuestionSetVersion > 0/.test(assessmentBlueprintSource)) {
  throw new Error("Expected active assessment filtering to scope questions to the current question-set version.");
}

console.log("exam-set-persistence-regression.test.mjs passed");
