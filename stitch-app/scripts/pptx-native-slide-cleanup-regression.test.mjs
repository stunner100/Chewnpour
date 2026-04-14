import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extractionPipelinePath = resolve(root, "convex", "lib", "documentExtractionPipeline.ts");
const source = readFileSync(extractionPipelinePath, "utf8");

assert.ok(
  source.includes("const PPTX_SLIDE_SEPARATOR_PATTERN = /(?:^|\\n\\n)--- Slide\\s+\\d+\\s+---\\s*/g;")
    && source.includes(".split(PPTX_SLIDE_SEPARATOR_PATTERN)")
    && source.includes(".map((entry) => sanitizeText(entry))"),
  "Expected native pptx parsing to strip leading slide separators so slide labels do not leak into lesson handoff text."
);

console.log("pptx-native-slide-cleanup-regression.test.mjs passed");
