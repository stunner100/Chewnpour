import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const aiPath = resolve(root, "convex", "ai.ts");
const topicsPath = resolve(root, "convex", "topics.ts");
const schemaPath = resolve(root, "convex", "schema.ts");

const aiSource = readFileSync(aiPath, "utf8");
const topicsSource = readFileSync(topicsPath, "utf8");
const schemaSource = readFileSync(schemaPath, "utf8");

assert.ok(
  aiSource.includes("type TopicContentGraph = {")
    && aiSource.includes("sourcePassages: TopicContentGraphSourcePassage[]")
    && aiSource.includes("buildTopicContentGraph(")
    && aiSource.includes("buildTopicContentGraphContext"),
  "Expected AI pipeline to define and build a canonical topic content graph."
);

assert.ok(
  aiSource.includes("contentGraph.sourcePassages[0]?.text")
    && aiSource.includes("normalizeDefinitionEntries(contentGraph.definitions")
    && aiSource.includes("normalizeFormulaEntries(")
    && aiSource.includes("contentGraph.formulas.map"),
  "Expected lesson fallback generation to preserve source passages, definitions, and formulas from the content graph."
);

assert.ok(
  schemaSource.includes("sourcePassages: v.array(v.object({")
    && topicsSource.includes("sourcePassages: v.array(v.object({")
    && topicsSource.includes("contentGraph: args.contentGraph"),
  "Expected topic schema and mutation to persist source passages inside the content graph."
);

console.log("content-graph-handoff-regression.test.mjs passed");
