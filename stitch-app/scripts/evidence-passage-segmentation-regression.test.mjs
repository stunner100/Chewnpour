import process from "node:process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const modulePath = path.join(root, "convex", "lib", "groundedEvidenceIndex.ts");
const source = readFileSync(modulePath, "utf8");
const aiSource = readFileSync(path.join(root, "convex", "ai.ts"), "utf8");
const groundedGenerationSource = readFileSync(path.join(root, "convex", "lib", "groundedGeneration.ts"), "utf8");

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
    "coalesceStructuredPassages",
    "buildContextualizedStructuredText",
    "isStandaloneHeadingPassage",
]) {
    if (!source.includes(expectedSnippet)) {
        throw new Error(`Expected Docling structured blocks to become first-class evidence passages: ${expectedSnippet}.`);
    }
}

for (const expectedSnippet of [
    "section=${sectionHint}",
    "headingPath=${headingPath}",
    "blockType=${blockType}",
]) {
    if (!aiSource.includes(expectedSnippet) || !groundedGenerationSource.includes(expectedSnippet)) {
        throw new Error(`Expected evidence prompts to expose structured passage context: ${expectedSnippet}.`);
    }
}

const tempDir = mkdtempSync(path.join(tmpdir(), "grounded-evidence-index-"));
const bundledModulePath = path.join(tempDir, "groundedEvidenceIndex.mjs");

try {
    await build({
        entryPoints: [modulePath],
        bundle: true,
        platform: "node",
        format: "esm",
        outfile: bundledModulePath,
        logLevel: "silent",
    });

    const grounded = await import(`${pathToFileURL(bundledModulePath).href}?t=${Date.now()}`);
    const index = grounded.buildGroundedEvidenceIndexFromArtifact({
        uploadId: "docling-quality-fixture",
        artifact: {
            metadata: {
                doclingBlocks: [
                    {
                        id: "docling-p1-0",
                        page: 0,
                        blockType: "heading",
                        sectionHint: "Course Title",
                        headingPath: ["Course Title"],
                        text: "# Course Title",
                        startChar: 0,
                        endChar: 14,
                        flags: ["heading"],
                    },
                    {
                        id: "docling-p1-1",
                        page: 0,
                        blockType: "heading",
                        sectionHint: "Course Title > Overview",
                        headingPath: ["Course Title", "Overview"],
                        text: "## Overview",
                        startChar: 16,
                        endChar: 27,
                        flags: ["heading"],
                    },
                    {
                        id: "docling-p1-2",
                        page: 0,
                        blockType: "paragraph",
                        sectionHint: "Course Title > Overview",
                        headingPath: ["Course Title", "Overview"],
                        text: "Active reading starts with a clear purpose.",
                        startChar: 29,
                        endChar: 72,
                        flags: ["paragraph"],
                    },
                    {
                        id: "docling-p1-3",
                        page: 0,
                        blockType: "list",
                        sectionHint: "Course Title > Overview",
                        headingPath: ["Course Title", "Overview"],
                        text: "- Survey the source\n- Ask questions before reading",
                        startChar: 74,
                        endChar: 126,
                        flags: ["list"],
                    },
                    {
                        id: "docling-p1-4",
                        page: 0,
                        blockType: "table",
                        sectionHint: "Course Title > Overview",
                        headingPath: ["Course Title", "Overview"],
                        text: "| Strategy | Purpose |\n| --- | --- |\n| Survey | Preview structure |",
                        startChar: 128,
                        endChar: 194,
                        flags: ["table"],
                    },
                ],
            },
        },
    });

    if (index.version !== "grounded-v2") {
        throw new Error(`Expected grounded-v2 dynamic index, received ${index.version || "unknown"}.`);
    }
    if (index.passages.some((passage) => passage.blockType === "heading")) {
        throw new Error("Expected standalone Docling headings to enrich content passages, not become heading-only passages.");
    }
    if (index.passages.length !== 2) {
        throw new Error(`Expected short paragraph/list blocks to coalesce while preserving the table, received ${index.passages.length} passages.`);
    }

    const overview = index.passages[0];
    if (!overview.text.startsWith("Course Title\nOverview\n\nActive reading")) {
        throw new Error("Expected coalesced Docling passage text to include heading context before body content.");
    }
    if (!overview.flags.includes("section") || overview.sourceBackend !== "docling") {
        throw new Error("Expected coalesced Docling passage to retain section flag and docling source backend.");
    }
    if (!index.passages[1].flags.includes("table")) {
        throw new Error("Expected table block to remain an atomic table passage.");
    }
} finally {
    rmSync(tempDir, { recursive: true, force: true });
}

console.log("evidence-passage-segmentation-regression.test.mjs passed");
