import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../convex/lib/documentExtractionPipeline.ts", import.meta.url),
  "utf8",
);

const pipelineMatch = source.match(
  /export const runDocumentExtractionPipeline = async \([\s\S]*?\n\};/
);

if (!pipelineMatch) {
  throw new Error("Expected runDocumentExtractionPipeline to exist.");
}

const pipelineSource = pipelineMatch[0];

if (!/isDoclingEnabled\(\)/.test(pipelineSource)) {
  throw new Error("Expected Docling to remain the primary extractor when enabled.");
}

if (!/catch \(error\)/.test(pipelineSource)) {
  throw new Error("Expected Docling primary failures to be caught.");
}

if (!/runAzureExtractionCandidate/.test(pipelineSource)) {
  throw new Error("Expected Docling failures to fall back to native/Azure extraction.");
}

if (!/summarizeDoclingFallbackWarning/.test(source)) {
  throw new Error("Expected Docling fallback warnings to be summarized before user display.");
}

if (/`docling_primary_failed:\$\{errorSummary\.slice/.test(source)) {
  throw new Error("Docling fallback must not persist raw extractor errors as user-facing warnings.");
}

if (!/continued with another extractor/.test(source)) {
  throw new Error("Expected Docling fallback to record a readable user-facing warning.");
}

if (!/pass:\s*"docling_primary"/.test(pipelineSource)) {
  throw new Error("Expected provider trace to include failed Docling primary pass.");
}

console.log("docling-primary-extraction-fallback-regression.test.mjs passed");
