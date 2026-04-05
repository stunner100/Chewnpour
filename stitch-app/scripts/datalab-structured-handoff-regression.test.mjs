import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const datalabClientPath = resolve(root, "convex", "lib", "datalabClient.ts");
const extractionPipelinePath = resolve(root, "convex", "lib", "documentExtractionPipeline.ts");
const aiPath = resolve(root, "convex", "ai.ts");

const datalabClientSource = readFileSync(datalabClientPath, "utf8");
const extractionPipelineSource = readFileSync(extractionPipelinePath, "utf8");
const aiSource = readFileSync(aiPath, "utf8");

assert.ok(
  datalabClientSource.includes("DATALAB_STRUCTURED_COURSE_SCHEMA")
    && datalabClientSource.includes("extraction_schema_json")
    && datalabClientSource.includes("structuredCourseMap")
    && datalabClientSource.includes('formData.set("page_schema"')
    && datalabClientSource.includes('formData.set("save_checkpoint", "true")'),
  "Expected Datalab client to request checkpoint-backed structured extraction alongside markdown conversion."
);

assert.ok(
  extractionPipelineSource.includes("artifactMetadata: payload.metadata")
    && extractionPipelineSource.includes("metadata?: Record<string, unknown>"),
  "Expected extraction artifacts to preserve Datalab structured metadata for downstream generation."
);

assert.ok(
  aiSource.includes("loadStructuredCourseMapForUpload")
    && aiSource.includes("buildCourseOutlineFromStructuredMap")
    && aiSource.includes("structuredCourseMap")
    && aiSource.includes("structuredSource: true"),
  "Expected course generation to read and prefer the structured Datalab course map."
);

assert.ok(
  aiSource.includes("buildTopicStructuredSourceContext")
    && aiSource.includes("STRUCTURED SOURCE MAP:")
    && aiSource.includes("Prefer the structured source map over inferring missing structure from loose prose."),
  "Expected lesson generation prompts to consume the structured Datalab topic map."
);

console.log("datalab-structured-handoff-regression.test.mjs passed");
