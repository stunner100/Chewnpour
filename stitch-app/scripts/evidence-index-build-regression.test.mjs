import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const extractionSource = await fs.readFile(path.join(root, "convex", "extraction.ts"), "utf8");
const groundedSource = await fs.readFile(path.join(root, "convex", "grounded.ts"), "utf8");
const indexSource = await fs.readFile(path.join(root, "convex", "lib", "groundedEvidenceIndex.ts"), "utf8");

if (!/buildGroundedEvidenceIndexFromArtifact/.test(indexSource)) {
    throw new Error("Expected grounded evidence index builder implementation.");
}
if (!extractionSource.includes("buildEvidenceIndexForUpload")
    || !extractionSource.includes("grounded.buildEvidenceIndex")) {
    throw new Error("Expected extraction pipeline to trigger grounded evidence index build.");
}
if (!/export const buildEvidenceIndex = internalAction/.test(groundedSource)) {
    throw new Error("Expected grounded buildEvidenceIndex internal action.");
}
if (!/evidenceIndexStorageId/.test(groundedSource) || !/evidencePassageCount/.test(groundedSource)) {
    throw new Error("Expected evidence index metadata updates on uploads.");
}

console.log("evidence-index-build-regression.test.mjs passed");
