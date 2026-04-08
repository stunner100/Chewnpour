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

console.log("mcq-subtype-fallback-regression.test.mjs passed");
