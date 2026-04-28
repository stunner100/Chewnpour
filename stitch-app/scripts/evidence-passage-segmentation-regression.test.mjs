import process from "node:process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const modulePath = path.join(root, "convex", "lib", "groundedEvidenceIndex.ts");
const source = readFileSync(modulePath, "utf8");

if (!source.includes('GROUNDED_EVIDENCE_INDEX_VERSION = "grounded-v2"')) {
    throw new Error("Expected grounded evidence index version grounded-v2.");
}

for (const expectedSnippet of [
    "splitBlockOnStructuredLines",
    "isHeadingLikeLine",
    "PASSAGE_TARGET_CHARS = 900",
]) {
    if (!source.includes(expectedSnippet)) {
        throw new Error(`Expected grounded evidence index to preserve page-text segmentation behavior: ${expectedSnippet}.`);
    }
}

for (const expectedSnippet of [
    "doclingBlocks",
    'sourceBackend: "docling"',
    "blockType",
    "headingPath",
    "mergeFlags(buildFlags(text), block?.flags)",
]) {
    if (!source.includes(expectedSnippet)) {
        throw new Error(`Expected Docling structured blocks to become first-class evidence passages: ${expectedSnippet}.`);
    }
}

console.log("evidence-passage-segmentation-regression.test.mjs passed");
