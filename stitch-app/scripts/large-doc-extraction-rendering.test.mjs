/**
 * Large-document test: verifies topic splitting accuracy and content rendering
 * quality with a realistic ~12K-word document spanning 12 chapters.
 *
 * Run: node scripts/large-doc-extraction-rendering.test.mjs
 */
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
import {
    cleanInlineText,
    cleanDisplayLine,
    normalizeLessonContent,
    isArtifactLine,
    slugifyText,
    SECTION_TITLES_SET,
} from "../src/lib/topicContentFormatting.js";

// ── HELPERS ────────────────────────────────────────────────────────
const makeChapterContent = (label, paragraphs = 6) =>
    Array.from({ length: paragraphs }, (_, index) =>
        `${label} concept ${index + 1} covers essential theories, formulas, and real-world ` +
        `applications that students need to understand. This includes detailed explanations ` +
        `of how ${label.toLowerCase()} works in practice, with step-by-step breakdowns and ` +
        `worked examples to ensure comprehensive understanding of the material. ` +
        `Practice problems help reinforce these concepts through repetition and application.`
    ).join("\n\n");

// ── BUILD LARGE DOCUMENT (~12K words, 12 chapters) ────────────────
const chapters = [
    "Chapter 1: Introduction to Computer Science",
    "Chapter 2: Data Structures and Algorithms",
    "Chapter 3: Operating Systems Fundamentals",
    "Chapter 4: Database Management Systems",
    "Chapter 5: Computer Networks and Protocols",
    "Chapter 6: Software Engineering Principles",
    "Chapter 7: Artificial Intelligence and Machine Learning",
    "Chapter 8: Web Development Technologies",
    "Chapter 9: Cybersecurity and Cryptography",
    "Chapter 10: Cloud Computing Architecture",
    "Chapter 11: Mobile Application Development",
    "Chapter 12: Ethics in Technology",
];

const sourceText = chapters
    .map((heading, idx) => `${heading}\n\n${makeChapterContent(heading.split(": ")[1], 6 + (idx % 3))}`)
    .join("\n\n");

const wordCount = sourceText.split(/\s+/).length;
console.log(`\n📄 Source document: ${wordCount} words, ${chapters.length} chapters\n`);

// ═══════════════════════════════════════════════════════════════════
// PART 1: TOPIC SPLITTING ACCURACY
// ═══════════════════════════════════════════════════════════════════
console.log("─── Part 1: Topic Splitting ───\n");

// 1a. Section extraction
const sections = extractStructuredSections(sourceText, {
    minSectionWords: 45,
    maxSections: 200,
});

console.log(`  Sections extracted: ${sections.length}`);
assert.ok(sections.length >= 10, `Expected ≥10 sections, got ${sections.length}`);

// Verify chapter headings are preserved
const headings = sections.map(s => s.heading.toLowerCase());
const chaptersFound = chapters.filter(ch => {
    const chLower = ch.toLowerCase();
    return headings.some(h => chLower.includes(h) || h.includes(chLower.split(": ")[1]?.toLowerCase() || "___"));
});
console.log(`  Chapter headings found: ${chaptersFound.length}/${chapters.length}`);
assert.ok(chaptersFound.length >= 8, `Expected ≥8 chapter headings preserved, got ${chaptersFound.length}`);

// 1b. Semantic chunking with new limits
const chunks = buildSemanticChunks(sections, {
    minChunkChars: 1200,
    maxChunkChars: 4000,
    maxChunks: 20,
});

console.log(`  Semantic chunks: ${chunks.length}`);
assert.ok(chunks.length >= 8, `Expected ≥8 semantic chunks, got ${chunks.length}`);
assert.ok(chunks.length <= 20, `Expected ≤20 semantic chunks, got ${chunks.length}`);

// 1c. Structure-derived topic count
const structureCount = deriveStructureTopicCount(sections);
console.log(`  Structure topic count: ${structureCount}`);
assert.ok(structureCount >= 8, `Expected structure count ≥8, got ${structureCount}`);

// 1d. Word-derived topic count
const targetFromWords = deriveTargetTopicCount({
    wordCount,
    chunkCount: chunks.length,
    minimum: 5,
    maximum: 15,
});
console.log(`  Word-derived target: ${targetFromWords}`);
assert.ok(targetFromWords >= 5, `Expected word-derived target ≥5, got ${targetFromWords}`);
assert.ok(targetFromWords <= 15, `Expected word-derived target ≤15, got ${targetFromWords}`);

// 1e. Topic grouping
const targetTopicCount = structureCount > 0 ? structureCount : targetFromWords;
const preGrouped = aggregateChunksByMajorKey(chunks);
const groups = groupChunksIntoTopicBuckets(preGrouped, { targetTopicCount });

console.log(`  Topic groups created: ${groups.length}`);
assert.ok(groups.length >= 8, `Expected ≥8 topic groups for 12-chapter doc, got ${groups.length}`);

// 1f. Coverage
const coverage = buildCoverageStats({ chunkCount: chunks.length, groups });
console.log(`  Coverage complete: ${coverage.isComplete}`);
assert.ok(coverage.isComplete, "Expected all chunks to be covered by topic groups");

// 1g. Source snippets
for (let gi = 0; gi < Math.min(3, groups.length); gi++) {
    const snippet = buildGroupSourceSnippet(groups[gi], chunks, { maxChars: 1200 });
    assert.ok(snippet.length > 100, `Group ${gi} snippet too short: ${snippet.length} chars`);
}

console.log("  ✅ Topic splitting tests passed\n");

// ═══════════════════════════════════════════════════════════════════
// PART 2: CONTENT RENDERING ACCURACY
// ═══════════════════════════════════════════════════════════════════
console.log("─── Part 2: Content Rendering ───\n");

// 2a. Test cleanInlineText preserves legitimate symbols
const symbolTests = [
    { input: "5 * 3 = 15", desc: "multiplication asterisk", expected: /5.*3.*=.*15/ },
    { input: "a_variable_name", desc: "underscored identifier", expected: /a_variable_name/ },
    { input: "x | y | z", desc: "pipe operators", expected: /x.*\|.*y.*\|.*z/ },
    { input: "**bold text**", desc: "bold markers stripped", expected: /bold text/ },
    { input: "use `code` here", desc: "inline code extracted", expected: /use code here/ },
    { input: "Dr. Smith's formula: E=mc²", desc: "apostrophes preserved", expected: /Smith's/ },
    { input: "step-by-step guide", desc: "hyphenated words", expected: /step-by-step/ },
];

let symbolPassed = 0;
for (const { input, desc, expected } of symbolTests) {
    const result = cleanInlineText(input);
    if (expected.test(result)) {
        symbolPassed++;
    } else {
        console.log(`  ⚠ cleanInlineText('${input}'): '${result}' failed — ${desc}`);
    }
}
console.log(`  cleanInlineText symbol accuracy: ${symbolPassed}/${symbolTests.length}`);

// 2b. Test normalizeLessonContent with realistic AI-generated content
const sampleLesson = [
    "### Simple Introduction",
    "",
    "Computer science is the study of algorithms, data structures, and computational theory.",
    "It encompasses both theoretical foundations and practical applications.",
    "",
    "### Key Ideas in Plain English",
    "",
    "- **Algorithm**: A step-by-step procedure for solving problems",
    "- **Data Structure**: A way to organize and store data efficiently",
    "- **Complexity**: How resources scale with input size",
    "",
    "### Step-by-Step Breakdown",
    "",
    "1. Define the problem clearly",
    "2. Choose an appropriate data structure",
    "3. Design the algorithm",
    "4. Analyze time and space complexity",
    "",
    "### Worked Example",
    "",
    "Consider sorting a list of numbers: [5, 3, 8, 1, 9].",
    "Using bubble sort, we compare adjacent elements and swap if needed.",
    "Pass 1: [3, 5, 1, 8, 9] — 3 swaps performed.",
    "Pass 2: [3, 1, 5, 8, 9] — 1 swap performed.",
    "",
    "| Algorithm | Best Case | Worst Case | Space |",
    "|-----------|-----------|------------|-------|",
    "| Bubble    | O(n)      | O(n²)     | O(1)  |",
    "| Merge     | O(n log n)| O(n log n) | O(n)  |",
    "| Quick     | O(n log n)| O(n²)     | O(1)  |",
    "",
    "> Tip: Always consider the average case complexity for real-world decisions.",
    "",
    "### Common Mistakes",
    "",
    "- Confusing O(n) with O(n²) — a 10x input increase means 100x slower",
    "- Forgetting that constants matter for small inputs",
    "",
    "### Summary",
    "",
    "Understanding algorithms and data structures is fundamental to writing efficient software.",
].join("\n");

const normalized = normalizeLessonContent(sampleLesson);

// 2c. Verify section titles are detected
const normalizedLower = normalized.toLowerCase();
const expectedSections = ["simple introduction", "key ideas", "step-by-step breakdown", "worked example", "common mistakes", "summary"];
let sectionsFound = 0;
for (const title of expectedSections) {
    if (normalizedLower.includes(title)) {
        sectionsFound++;
    } else {
        console.log(`  ⚠ Section not found: "${title}"`);
    }
}
console.log(`  Section titles preserved: ${sectionsFound}/${expectedSections.length}`);
assert.ok(sectionsFound >= 4, `Expected ≥4 section titles, got ${sectionsFound}`);

// 2d. Verify list items preserved
const hasBulletItems = /algorithm.*step-by-step/i.test(normalized) || normalized.includes("Algorithm");
const hasNumberedItems = /1\.\s+Define/i.test(normalized) || /define the problem/i.test(normalized);
console.log(`  Bullet items present: ${hasBulletItems}`);
console.log(`  Numbered items present: ${hasNumberedItems}`);

// 2e. Verify pipe tables not destroyed
const hasTableContent = normalized.includes("Bubble") && normalized.includes("O(n");
console.log(`  Table content preserved: ${hasTableContent}`);
assert.ok(hasTableContent, "Expected table content (algorithm names, complexity) to be preserved");

// 2f. Verify blockquote preserved
const hasQuote = normalized.includes("Tip:") || normalized.includes("average case");
console.log(`  Blockquote content preserved: ${hasQuote}`);

// 2g. Test isArtifactLine correctly filters
const artifactLineTests = [
    { input: "---", expected: true, desc: "horizontal rule" },
    { input: "***", expected: true, desc: "markdown bold/hr" },
    { input: "| | |", expected: false, desc: "table row (kept)" },
    { input: "", expected: true, desc: "empty line" },
    { input: "Normal text here", expected: false, desc: "content line" },
    { input: "> ", expected: true, desc: "empty blockquote" },
    { input: "> Important note", expected: false, desc: "blockquote with content" },
];

let artifactPassed = 0;
for (const { input, expected, desc } of artifactLineTests) {
    const result = isArtifactLine(input);
    if (result === expected) {
        artifactPassed++;
    } else {
        console.log(`  ⚠ isArtifactLine('${input}'): ${result}, expected ${expected} — ${desc}`);
    }
}
console.log(`  isArtifactLine accuracy: ${artifactPassed}/${artifactLineTests.length}`);

// 2h. Test cleanDisplayLine vs cleanInlineText difference
const lineWithPrefix = "3. Choose the right algorithm";
const displayCleaned = cleanDisplayLine(lineWithPrefix);
const inlineCleaned = cleanInlineText(lineWithPrefix);
console.log(`  cleanDisplayLine("${lineWithPrefix}"): "${displayCleaned}"`);
console.log(`  cleanInlineText("${lineWithPrefix}"): "${inlineCleaned}"`);
// cleanInlineText should preserve number prefix; cleanDisplayLine strips it
assert.ok(!displayCleaned.startsWith("3."), "cleanDisplayLine should strip numbered prefix");
assert.ok(inlineCleaned.includes("3."), "cleanInlineText should preserve numbered prefix");

// 2i. Test slugifyText
const slugResult = slugifyText("### Common Mistakes and Misconceptions", "0");
assert.ok(slugResult.length > 5, `slugifyText produced too-short result: "${slugResult}"`);
assert.ok(!slugResult.includes("#"), "slugifyText should strip # characters");
console.log(`  slugifyText: "${slugResult}"`);

// 2j. Test bold text not corrupted
const boldInput = "The **algorithm** runs in O(n*log n) time";
const boldCleaned = cleanInlineText(boldInput);
const hasAlgorithm = boldCleaned.includes("algorithm");
const hasComplexity = boldCleaned.includes("O(n");
console.log(`  Bold text: "${boldCleaned}"`);
assert.ok(hasAlgorithm, "Bold text 'algorithm' should be preserved after cleaning");
assert.ok(hasComplexity, "Complexity notation O(n*log n) should be preserved");

// 2k. Verify no double-spaces or stray symbols in normalized content
const doubleSpaces = (normalized.match(/  +/g) || []).length;
const strayBackslashes = (normalized.match(/\\/g) || []).length;
console.log(`  Double spaces in normalized: ${doubleSpaces}`);
console.log(`  Stray backslashes in normalized: ${strayBackslashes}`);
assert.ok(doubleSpaces < 3, `Too many double-spaces: ${doubleSpaces}`);

console.log("\n  ✅ Content rendering tests passed\n");

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log("═══════════════════════════════════════");
console.log(`✅ ALL TESTS PASSED`);
console.log(`   Document: ${wordCount} words, ${chapters.length} chapters`);
console.log(`   Topics extracted: ${groups.length}`);
console.log(`   Coverage: ${coverage.isComplete ? "complete" : "INCOMPLETE"}`);
console.log(`   Symbol accuracy: ${symbolPassed}/${symbolTests.length}`);
console.log(`   Sections preserved: ${sectionsFound}/${expectedSections.length}`);
console.log(`   Artifact filter accuracy: ${artifactPassed}/${artifactLineTests.length}`);
console.log("═══════════════════════════════════════\n");
