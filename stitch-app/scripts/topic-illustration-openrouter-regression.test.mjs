import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiPath = path.join(root, "convex", "ai.ts");
const envExamplePath = path.join(root, ".env.example");

const [aiSource, envExampleSource] = await Promise.all([
  fs.readFile(aiPath, "utf8"),
  fs.readFile(envExamplePath, "utf8"),
]);

if (!/const TOPIC_ILLUSTRATION_OPENROUTER_BASE_URL = \(\(\) => \{/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to define TOPIC_ILLUSTRATION_OPENROUTER_BASE_URL.");
}

if (
  !/const TOPIC_ILLUSTRATION_OPENROUTER_MODEL =[\s\S]*process\.env\.TOPIC_ILLUSTRATION_OPENROUTER_MODEL \|\| "bytedance-seed\/seedream-4\.5"/.test(aiSource)
) {
  throw new Error("Expected convex/ai.ts to default the topic illustration model to bytedance-seed/seedream-4.5.");
}

if (!/const generateTopicIllustrationWithOpenRouter = async \(prompt: string\) => \{/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to expose an OpenRouter topic illustration generator.");
}

if (!/TOPIC_ILLUSTRATION_OPENROUTER_BASE_URL}\/?chat\/completions/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to call OpenRouter chat/completions for topic illustrations.");
}

if (!/modalities:\s*\["image"\]/.test(aiSource)) {
  throw new Error("Expected convex/ai.ts to request image-only output from OpenRouter.");
}

if (!/const illustration = await generateTopicIllustrationWithOpenRouter\(prompt\);/.test(aiSource)) {
  throw new Error("Expected topic illustration generation to use the OpenRouter helper.");
}

if (!/reason: "topic_illustration_no_image"/.test(aiSource)) {
  throw new Error("Expected topic illustration failures to use a provider-neutral no-image reason.");
}

if (/generateTopicIllustrationWithGemini/.test(aiSource)) {
  throw new Error("Expected Gemini-specific topic illustration helper to be removed.");
}

for (const expectedLine of [
  "TOPIC_ILLUSTRATION_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/",
  "TOPIC_ILLUSTRATION_OPENROUTER_MODEL=bytedance-seed/seedream-4.5",
  "TOPIC_ILLUSTRATION_OPENROUTER_TIMEOUT_MS=60000",
]) {
  if (!envExampleSource.includes(expectedLine)) {
    throw new Error(`Expected .env.example to include ${expectedLine}.`);
  }
}

console.log("topic-illustration-openrouter-regression.test.mjs passed");
