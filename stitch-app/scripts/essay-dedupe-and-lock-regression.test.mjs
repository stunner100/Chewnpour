import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const topicsPath = path.join(root, "convex", "topics.ts");
const aiPath = path.join(root, "convex", "ai.ts");
const schemaPath = path.join(root, "convex", "schema.ts");

const [topicsSource, aiSource, schemaSource] = await Promise.all([
  fs.readFile(topicsPath, "utf8"),
  fs.readFile(aiPath, "utf8"),
  fs.readFile(schemaPath, "utf8"),
]);

if (!/buildQuestionPromptSignature/.test(topicsSource) || !/areQuestionPromptsNearDuplicate/.test(topicsSource)) {
  throw new Error("Expected topics.ts to import prompt-similarity helpers for essay dedupe.");
}

if (!/const normalizedQuestionType = String\(args\.questionType \|\| ""\)\.trim\(\)\.toLowerCase\(\);[\s\S]*if \(normalizedQuestionType === "essay"\)/.test(topicsSource)) {
  throw new Error("Expected createQuestionInternal to apply same-format dedupe logic for essays.");
}

if (!/generationRunId: v\.optional\(v\.string\(\)\)/.test(schemaSource) || !/qualityScore: v\.optional\(v\.number\(\)\)/.test(schemaSource) || !/freshnessBucket: v\.optional\(v\.string\(\)\)/.test(schemaSource)) {
  throw new Error("Expected schema.ts questions table to persist generationRunId, qualityScore, and freshnessBucket.");
}

if (!/const runEssayGenerationWithLock = async/.test(aiSource) || !/const runMcqGenerationWithLock = async/.test(aiSource)) {
  throw new Error("Expected ai.ts to keep lock protection for both essay and MCQ generation.");
}

console.log("essay-dedupe-and-lock-regression.test.mjs passed");
