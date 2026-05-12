import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const aiSource = await fs.readFile(path.join(process.cwd(), "convex", "ai.ts"), "utf8");

const requiredSnippets = [
  "parsePartialJsonEnvelope",
  "parseCompleteJsonObjectsFromArray",
  "normalized.lastIndexOf(\"}\")",
  'normalized.includes("question")',
  'normalized.includes("sub_claim")',
  "[JSONRepair] salvaged partial",
  "parsePartialJsonEnvelope(raw, label)",
];

for (const snippet of requiredSnippets) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`Expected convex/ai.ts to include partial JSON salvage snippet: ${snippet}`);
  }
}

const parseJsonFunctionMatch = aiSource.match(
  /const parseJsonFromResponse = [\s\S]*?const normalizeDifficultyLabel/
);
if (!parseJsonFunctionMatch) {
  throw new Error("Could not locate parseJsonFromResponse in convex/ai.ts.");
}

const parseJsonFunction = parseJsonFunctionMatch[0];
const salvageIndex = parseJsonFunction.indexOf("parsePartialJsonEnvelope(raw, label)");
const errorLogIndex = parseJsonFunction.indexOf("console.error(`Failed to parse ${label}:`, raw)");

if (salvageIndex < 0 || errorLogIndex < 0 || salvageIndex > errorLogIndex) {
  throw new Error("Expected parseJsonFromResponse to try partial salvage before logging parse failure.");
}

console.log("partial-json-salvage-regression.test.mjs passed");
