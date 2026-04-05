import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const aiPath = resolve(root, "convex", "ai.ts");
const generationPath = resolve(root, "convex", "lib", "groundedGeneration.ts");
const topicsPath = resolve(root, "convex", "topics.ts");
const schemaPath = resolve(root, "convex", "schema.ts");

const aiSource = readFileSync(aiPath, "utf8");
const generationSource = readFileSync(generationPath, "utf8");
const topicsSource = readFileSync(topicsPath, "utf8");
const schemaSource = readFileSync(schemaPath, "utf8");

assert.ok(
  aiSource.includes("loadStructuredExamTopicProfileForTopic")
    && aiSource.includes("buildStructuredExamTopicContext")
    && aiSource.includes("buildStructuredExamQueryFragments")
    && aiSource.includes("structuredTopicContext: groundedPack.structuredTopicContext"),
  "Expected exam generation to resolve and pass structured Datalab topic context through the grounded pipeline."
);

assert.ok(
  generationSource.includes("STRUCTURED_TOPIC_SCHEMA:")
    && generationSource.includes("Use the structured topic schema as curriculum guidance")
    && generationSource.includes("Use the structured topic schema to prefer the document's extracted learning objectives, definitions, formulas, examples, and confusions")
    && generationSource.includes("Use the structured topic schema to prefer the document's extracted objectives, examples, formulas, and confusions when framing authentic tasks."),
  "Expected assessment blueprint and question prompts to consume structured Datalab topic schema."
);

for (const requiredField of [
  "structuredSubtopics: v.optional(v.array(v.string()))",
  "structuredDefinitions: v.optional(v.array(v.object({",
  "structuredExamples: v.optional(v.array(v.string()))",
  "structuredFormulas: v.optional(v.array(v.string()))",
  "structuredLikelyConfusions: v.optional(v.array(v.string()))",
  "structuredLearningObjectives: v.optional(v.array(v.string()))",
  "structuredSourcePages: v.optional(v.array(v.number()))",
  "structuredSourceBlockIds: v.optional(v.array(v.string()))",
]) {
  assert.ok(
    schemaSource.includes(requiredField) && topicsSource.includes(requiredField),
    `Expected topics schema and mutation args to include ${requiredField}.`
  );
}

assert.ok(
  aiSource.includes("structuredDefinitions: topicData.definitions")
    && aiSource.includes("structuredLearningObjectives: topicData.learningObjectives")
    && aiSource.includes("sourceUploadId: uploadId"),
  "Expected newly created topics to persist structured Datalab fields for downstream exam generation."
);

console.log("datalab-structured-exam-handoff-regression.test.mjs passed");
