import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const llmClient = readFileSync(path.join(root, "server/llmClient.js"), "utf8");
const envExample = readFileSync(path.join(root, ".env.example"), "utf8");

assert.match(llmClient, /GRID_API_KEY/);
assert.match(llmClient, /api\.thegrid\.ai/);
assert.match(llmClient, /provider:\s*"grid"/);
assert.match(llmClient, /text-prime/);
assert.ok(
  llmClient.indexOf('provider: "grid"') < llmClient.indexOf('provider: "deepseek"'),
  "Grid should be preferred before DeepSeek",
);
assert.match(envExample, /^GRID_API_KEY=/m);
assert.match(envExample, /^GRID_BASE_URL=https:\/\/api\.thegrid\.ai\/v1\/?$/m);
assert.match(envExample, /^GRID_MODEL=text-prime$/m);

console.log("supabase-grid-llm-regression.test.mjs passed");
