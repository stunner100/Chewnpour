import assert from "node:assert/strict";
import {
    aggregateChunksByMajorKey,
    buildCoverageStats,
    buildGroupSourceSnippet,
    buildSemanticChunks,
    deriveStructureTopicCount,
    deriveTargetTopicCount,
    extractStructuredSections,
    groupChunksIntoTopicBuckets,
} from "../convex/lib/topicOutlinePipeline.js";

const makeParagraph = (label, repeats = 14) =>
    Array.from({ length: repeats }, (_, index) =>
        `${label} concept ${index + 1} explains the idea with examples, definitions, and practical usage for students.`
    ).join(" ");

const sourceText = [
    "Chapter 1: Information Retrieval Basics",
    makeParagraph("Retrieval"),
    "",
    "Chapter 2: Collection and Indexing",
    makeParagraph("Collection"),
    "",
    "Chapter 3: Query Processing",
    makeParagraph("Query"),
    "",
    "Chapter 4: Evaluation Metrics",
    makeParagraph("Evaluation"),
    "",
    "Chapter 5: Real-World Use Cases",
    makeParagraph("Use case"),
].join("\n");

const sections = extractStructuredSections(sourceText, {
    minSectionWords: 20,
    maxSections: 40,
});
assert.ok(sections.length >= 5, "Expected section extraction to keep chapter boundaries");
assert.ok(
    sections.some((section) => section.heading.toLowerCase().includes("chapter 3")),
    "Expected chapter heading to be preserved"
);

const chunks = buildSemanticChunks(sections, {
    minChunkChars: 650,
    maxChunkChars: 1100,
    maxChunks: 8,
});
assert.ok(chunks.length >= 4, "Expected semantic chunking to split long material into multiple chunks");

const structureCount = deriveStructureTopicCount(sections);
assert.equal(structureCount >= 2, true, "Expected structure-derived topic count to be detected");

const target = deriveTargetTopicCount({
    wordCount: sourceText.split(/\s+/).length,
    chunkCount: chunks.length,
    minimum: 3,
    maximum: 6,
});
assert.ok(target >= 3 && target <= 6, "Expected bounded topic target");

const preGrouped = aggregateChunksByMajorKey(chunks);
const groups = preGrouped.length === 3
    ? preGrouped
    : groupChunksIntoTopicBuckets(preGrouped, { targetTopicCount: 3 });
assert.equal(groups.length, 3, "Expected chunk groups to match requested topic count");

const coverage = buildCoverageStats({
    chunkCount: chunks.length,
    groups,
});
assert.equal(coverage.isComplete, true, "Expected grouped topics to cover all chunks");

const snippet = buildGroupSourceSnippet(groups[0], chunks, { maxChars: 700 });
assert.ok(snippet.length > 120, "Expected grouped snippet to include source context");

console.log("topic-outline-pipeline-regression tests passed");
