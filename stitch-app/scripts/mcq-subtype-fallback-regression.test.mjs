import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiPath = path.join(root, "convex", "ai.ts");
const aiSource = await fs.readFile(aiPath, "utf8");

for (const expectedSnippet of [
  "const buildObjectiveSubtypeGenerationDeficits = (args:",
  "preferCountFillOverSubtypeMix",
  "questionType: QUESTION_TYPE_MULTIPLE_CHOICE",
  "(coveragePolicy.needsGeneration || getUniqueQuestionCount() < targetCount)",
  "if (initialCount >= targetCount && coveragePolicy.ready) {",
]) {
  if (!aiSource.includes(expectedSnippet)) {
    throw new Error(`Expected convex/ai.ts to include \"${expectedSnippet}\" for first-pass subtype fallback.`);
  }
}

for (const forbiddenSnippet of [
  "const buildDeterministicTrueFalseFallbackCandidate = (args:",
  "\"deterministic_true_false_fallback\"",
  "[QuestionBank] deterministic_true_false_fallback_saved",
  "quality_gate_bypassed_for_grounded_fallback",
  "const isDeterministicTrueFalseFallback =",
]) {
  if (aiSource.includes(forbiddenSnippet)) {
    throw new Error(`Expected convex/ai.ts not to include fallback subtype behavior: ${forbiddenSnippet}`);
  }
}

console.log("mcq-subtype-fallback-regression.test.mjs passed");
