import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiPath = path.join(root, "convex", "ai.ts");

const aiSource = await fs.readFile(aiPath, "utf8");

if (!/const hasUsableGeneratedTopicIllustration = \(topic: \{ illustrationStorageId\?: string \| null; illustrationUrl\?: string \| null \}\) => \{/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to define hasUsableGeneratedTopicIllustration.");
}

if (!/normalizedIllustrationUrl !== resolveTopicPlaceholderIllustrationUrl\(\)/.test(aiSource)) {
  throw new Error("Expected topic illustration generation to ignore the placeholder URL when deciding whether artwork already exists.");
}

if (!/const hasUsableStoredIllustration = hasUsableGeneratedTopicIllustration\(topic\);/.test(aiSource)) {
  throw new Error("Expected generateTopicIllustration to use hasUsableGeneratedTopicIllustration.");
}

console.log("topic-illustration-placeholder-skip-regression.test.mjs passed");
