import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/ai.ts", import.meta.url), "utf8");

if (!/featureAllowsDocumentPipelineProviderFallback/.test(source)) {
  throw new Error("Expected exam generation to declare document-pipeline provider fallback support.");
}

if (!/\"mcq_generation\",\s*\"essay_generation\"/.test(source)) {
  throw new Error("Expected MCQ and essay generation to allow provider fallback when DeepSeek fails.");
}

if (!/pipelineOpenAiRequired && !pipelineProviderFallbackAllowed/.test(source)) {
  throw new Error("Expected strict DeepSeek requirement to be bypassed only for allowed exam features.");
}

if (!/examFormat === "essay"[\s\S]*\? FRESH_CONTEXT_AUTHORING_TIMEOUT_MS[\s\S]*: 15000/.test(source)) {
  throw new Error("Expected objective exam DeepSeek calls to use a shorter timeout before fallback.");
}

console.log("exam-provider-fallback-regression.test.mjs passed");
