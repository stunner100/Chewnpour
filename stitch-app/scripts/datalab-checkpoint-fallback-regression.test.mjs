import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const datalabClientPath = resolve(root, "convex", "lib", "datalabClient.ts");
const extractionPipelinePath = resolve(root, "convex", "lib", "documentExtractionPipeline.ts");
const source = readFileSync(datalabClientPath, "utf8");
const extractionPipelineSource = readFileSync(extractionPipelinePath, "utf8");

assert.ok(
  source.includes('warnings.push("checkpoint_unavailable")')
    && source.includes("parseStructuredExtractionPayload(extractPayload || convertPayload)")
    && !source.includes('throw new Error("Datalab error: convert response missing checkpoint_id")'),
  "Expected Datalab convert flow to fall back to chunk output when checkpoint_id is unavailable, instead of failing the whole extraction."
);

assert.ok(
  source.includes("structured_extract_failed:")
    && source.includes("const blocks = flattenChunkBlocks(convertPayload?.chunks)"),
  "Expected Datalab extraction to preserve chunk-based grounding output even if the structured extract follow-up fails."
);

assert.ok(
  extractionPipelineSource.includes('normalizedFileType === "pptx" || normalizedFileType === "docx"')
    && extractionPipelineSource.includes("runNativePass(normalizedFileType, cloneArrayBuffer(args.fileBuffer))")
    && extractionPipelineSource.includes("const [nativePass, payload] = await Promise.all([nativePassPromise, payloadPromise])")
    && extractionPipelineSource.includes("nativePass,"),
  "Expected the Datalab extraction path to merge native Office-document text so empty chunk output can still recover docx/pptx processing."
);

console.log("datalab-checkpoint-fallback-regression.test.mjs passed");
