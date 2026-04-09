import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "convex", "schema.ts");
const schemaSource = await fs.readFile(schemaPath, "utf8");

if (!schemaSource.includes("template: v.optional(v.array(v.string()))")) {
  throw new Error("conceptExercises.template must stay optional so existing deployments can validate stored exercises.");
}

if (!schemaSource.includes("tokens: v.optional(v.array(v.string()))")) {
  throw new Error("conceptExercises.tokens must stay optional so existing deployments can validate stored exercises.");
}

const legacyShapeSnippets = [
  "active: v.optional(v.boolean())",
  "conceptKey: v.optional(v.string())",
  "exerciseType: v.optional(v.string())",
  "options: v.optional(v.array(v.any()))",
  "correctOptionId: v.optional(v.string())",
  "explanation: v.optional(v.string())",
  "difficulty: v.optional(v.string())",
  "sourcePassageIds: v.optional(v.array(v.string()))",
  "qualityScore: v.optional(v.number())",
];

for (const snippet of legacyShapeSnippets) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`conceptExercises schema is missing legacy deployment field: ${snippet}`);
  }
}

console.log("concept-exercise-schema-regression.test.mjs passed");
