import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const source = await fs.readFile(path.join(__dirname, "../convex/topics.ts"), "utf8");

assert.match(
  source,
  /handler:\s*async\s*\(ctx,\s*args\)\s*=>\s*\{\s*const\s+topic\s*=\s*await\s+ctx\.db\.get\(args\.topicId\);\s*if\s*\(!topic\)\s*\{\s*throw\s+new\s+Error\("Topic not found"\);/s,
  "Expected createQuestionInternal to load topic context before reading questionSetVersion."
);

assert.match(
  source,
  /questionSetVersion:\s*Number\(topic\?\.questionSetVersion\s*\|\|\s*topic\?\.examReadyUpdatedAt\s*\|\|\s*topic\?\._creationTime\s*\|\|\s*0\)\s*\|\|\s*undefined/s,
  "Expected question persistence to derive questionSetVersion from the loaded topic context."
);

console.log("topic-question-context-regression.test.mjs passed");
