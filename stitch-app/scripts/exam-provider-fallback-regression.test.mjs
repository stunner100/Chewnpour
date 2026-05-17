import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/ai.ts", import.meta.url), "utf8");

if (!/featureAllowsDocumentPipelineProviderFallback/.test(source)) {
  throw new Error("Expected exam generation to declare document-pipeline provider fallback support.");
}

const providerFallbackAllowlist = source.match(
  /const featureAllowsDocumentPipelineProviderFallback = \(feature: string\) =>\s*\[([\s\S]*?)\]\.includes/
)?.[1] || "";

if (!/"course_generation"[\s\S]*"mcq_generation"[\s\S]*"essay_generation"/.test(providerFallbackAllowlist)) {
  throw new Error("Expected course, MCQ, and essay generation to allow provider fallback when DeepSeek fails.");
}

if (!/pipelineOpenAiRequired && !pipelineProviderFallbackAllowed/.test(source)) {
  throw new Error("Expected strict DeepSeek requirement to be bypassed only for allowed exam features.");
}

if (!/examFormat === "essay"[\s\S]*\? FRESH_CONTEXT_AUTHORING_TIMEOUT_MS[\s\S]*: 15000/.test(source)) {
  throw new Error("Expected objective exam DeepSeek calls to use a shorter timeout before fallback.");
}

console.log("exam-provider-fallback-regression.test.mjs passed");
