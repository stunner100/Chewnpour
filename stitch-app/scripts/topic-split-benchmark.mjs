import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {
    aggregateChunksByMajorKey,
    buildCoverageStats,
    buildSemanticChunks,
    deriveStructureTopicCount,
    deriveTargetTopicCount,
    extractStructuredSections,
    groupChunksIntoTopicBuckets,
} from "../convex/lib/topicOutlinePipeline.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const countWords = (value) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

const scoreCountAccuracy = (predicted, expected) => {
    if (expected <= 0) return 0;
    const ratio = Math.abs(predicted - expected) / expected;
    return clamp(1 - ratio, 0, 1);
};

const toSectionSet = (values) => new Set((values || []).map((value) => Number(value)));

const iouForSets = (left, right) => {
    const leftSet = left instanceof Set ? left : toSectionSet(left);
    const rightSet = right instanceof Set ? right : toSectionSet(right);
    if (leftSet.size === 0 || rightSet.size === 0) return 0;
    let intersection = 0;
    for (const value of leftSet) {
        if (rightSet.has(value)) intersection += 1;
    }
    const union = leftSet.size + rightSet.size - intersection;
    return union > 0 ? intersection / union : 0;
};

const iouForRanges = (left, right) => {
    if (!left || !right) return 0;
    const start = Math.max(left.start, right.start);
    const end = Math.min(left.end, right.end);
    const intersection = Math.max(0, end - start + 1);
    const union = Math.max(left.end, right.end) - Math.min(left.start, right.start) + 1;
    return union > 0 ? intersection / union : 0;
};

const meanMaxIoU = (expectedItems, predictedItems, iouFn) => {
    if (!Array.isArray(expectedItems) || expectedItems.length === 0) return 0;
    const usedPredicted = new Set();
    let total = 0;

    for (const expected of expectedItems) {
        let bestIndex = -1;
        let bestScore = -1;
        for (let index = 0; index < predictedItems.length; index += 1) {
            if (usedPredicted.has(index)) continue;
            const score = iouFn(expected, predictedItems[index]);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }
        if (bestIndex >= 0) {
            usedPredicted.add(bestIndex);
            total += bestScore;
        }
    }

    return total / expectedItems.length;
};

const runPipeline = (sourceText) => {
    const sections = extractStructuredSections(sourceText, {
        minSectionWords: 45,
        maxSections: 120,
    });
    const chunks = buildSemanticChunks(sections, {
        minChunkChars: 1800,
        maxChunkChars: 5200,
        maxChunks: 10,
    });

    const structureTopicCount = deriveStructureTopicCount(sections);
    const targetTopicCount = structureTopicCount > 0
        ? structureTopicCount
        : deriveTargetTopicCount({
            wordCount: countWords(sourceText),
            chunkCount: chunks.length,
            minimum: 4,
            maximum: 8,
        });
    const preGrouped = structureTopicCount > 0 ? aggregateChunksByMajorKey(chunks) : chunks;
    const groups = preGrouped.length === targetTopicCount
        ? preGrouped
        : groupChunksIntoTopicBuckets(preGrouped, { targetTopicCount });
    const coverage = buildCoverageStats({
        chunkCount: chunks.length,
        groups,
    });
    return { sections, chunks, groups, targetTopicCount, coverage };
};

const buildSyntheticDocument = ({ name, topicCount, sectionsPerTopic, sentenceRepeats = 42 }) => {
    const sections = [];
    const expectedGroups = [];
    let sectionCounter = 1;
    for (let topicIndex = 0; topicIndex < topicCount; topicIndex += 1) {
        const topicName = `Topic ${topicIndex + 1}`;
        const sectionCount = sectionsPerTopic[topicIndex];
        const chapterLabel = `Chapter ${topicIndex + 1}`;
        const sectionIds = [];
        for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
            const sectionTitle = `${topicName}: Section ${sectionIndex + 1}`;
            const keyword = `keyword_${topicIndex + 1}_${sectionIndex + 1}`;
            const body = Array.from({ length: sentenceRepeats }, (_, idx) =>
                `${sectionTitle} explains ${keyword} with examples, definitions, and practical scenarios for students in class ${idx + 1}.`
            ).join(" ");
            sections.push(`${chapterLabel}: ${sectionTitle}\n${body}`);
            sectionIds.push(sectionCounter - 1);
            sectionCounter += 1;
        }
        expectedGroups.push(sectionIds);
    }
    return {
        name,
        text: sections.join("\n\n"),
        expectedGroups,
    };
};

const syntheticCases = [
    buildSyntheticDocument({ name: "Synthetic_A_4_topics", topicCount: 4, sectionsPerTopic: [2, 2, 2, 2], sentenceRepeats: 44 }),
    buildSyntheticDocument({ name: "Synthetic_B_5_topics", topicCount: 5, sectionsPerTopic: [2, 1, 2, 2, 1], sentenceRepeats: 40 }),
    buildSyntheticDocument({ name: "Synthetic_C_6_topics", topicCount: 6, sectionsPerTopic: [2, 2, 1, 2, 1, 2], sentenceRepeats: 38 }),
    buildSyntheticDocument({ name: "Synthetic_D_8_topics", topicCount: 8, sectionsPerTopic: [1, 1, 1, 1, 1, 1, 1, 1], sentenceRepeats: 46 }),
];

const evaluateSynthetic = () => {
    const results = [];

    for (const testCase of syntheticCases) {
        const { sections, chunks, groups, coverage } = runPipeline(testCase.text);
        const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
        const predictedGroupSets = groups.map((group) =>
            toSectionSet(
                group.chunkIds.flatMap((chunkId) => chunkById.get(chunkId)?.sectionIds || [])
            )
        );
        const expectedSets = testCase.expectedGroups.map((group) => toSectionSet(group));

        const boundaryIoU = meanMaxIoU(expectedSets, predictedGroupSets, iouForSets);
        const countAccuracy = scoreCountAccuracy(groups.length, expectedSets.length);
        const score = boundaryIoU * 0.7 + countAccuracy * 0.3;

        results.push({
            name: testCase.name,
            sourceType: "synthetic",
            expectedTopics: expectedSets.length,
            predictedTopics: groups.length,
            sections: sections.length,
            chunks: chunks.length,
            coverageRatio: coverage.coverageRatio,
            boundaryIoU,
            countAccuracy,
            score,
        });
    }

    return results;
};

const flattenOutline = (outlineItems) => {
    if (!Array.isArray(outlineItems)) return [];
    const output = [];
    for (const item of outlineItems) {
        if (!item) continue;
        output.push(item);
        if (Array.isArray(item.items) && item.items.length > 0) {
            for (const child of item.items) {
                output.push({ ...child, __parent: item.title || "" });
            }
        }
    }
    return output;
};

const cleanHeadingCandidate = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .replace(/^[#*\-\s]+/, "")
        .trim();

const isHeadingCandidate = (line) => {
    const text = cleanHeadingCandidate(line);
    if (!text) return false;
    if (text.length < 4 || text.length > 110) return false;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 14) return false;
    if (/^(chapter|section|topic|lesson|unit|module|part)\s+\d+/i.test(text)) return true;
    if (/^\d+(\.\d+){0,3}[)\-.:]?\s+[A-Z]/.test(text)) return true;
    if (/^[A-Z0-9][A-Z0-9 ,:&()'/-]+$/.test(text) && words.length <= 12) return true;
    const alphaWords = words.filter((word) => /[A-Za-z]/.test(word));
    if (alphaWords.length === 0) return false;
    const titleCaseWords = alphaWords.filter((word) => /^[A-Z][a-z0-9'/-]+$/.test(word));
    const headingRatio = titleCaseWords.length / alphaWords.length;
    return headingRatio >= 0.7;
};

const extractPageLines = async (page) => {
    const content = await page.getTextContent();
    const items = (content.items || [])
        .map((item) => ({
            text: String(item.str || "").trim(),
            x: Number(item.transform?.[4] || 0),
            y: Number(item.transform?.[5] || 0),
        }))
        .filter((item) => item.text);

    const groups = new Map();
    for (const item of items) {
        const yKey = Math.round(item.y);
        if (!groups.has(yKey)) groups.set(yKey, []);
        groups.get(yKey).push(item);
    }

    const lines = [];
    for (const [, lineItems] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
        const text = lineItems
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        if (text) lines.push(text);
    }
    return lines;
};

const extractHeadingAnchorsFromPages = async (pdf) => {
    const anchors = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const lines = await extractPageLines(page);
        const candidate = lines
            .slice(0, 14)
            .map((line) => cleanHeadingCandidate(line))
            .find((line) => isHeadingCandidate(line));
        if (!candidate) continue;
        anchors.push({
            title: candidate,
            page: pageNumber,
        });
    }

    const uniqueByPage = [];
    const seenPages = new Set();
    for (const item of anchors.sort((a, b) => a.page - b.page)) {
        if (seenPages.has(item.page)) continue;
        seenPages.add(item.page);
        uniqueByPage.push(item);
    }
    return uniqueByPage;
};

const resolveOutlinePage = async (pdf, item) => {
    if (!item?.dest) return null;
    let destination = item.dest;
    if (typeof destination === "string") {
        destination = await pdf.getDestination(destination);
    }
    if (!Array.isArray(destination) || !destination[0]) return null;
    try {
        const pageIndex = await pdf.getPageIndex(destination[0]);
        return Number.isFinite(pageIndex) ? pageIndex + 1 : null;
    } catch {
        return null;
    }
};

const rebucketRanges = (ranges, targetCount) => {
    const cleanRanges = Array.isArray(ranges) ? ranges.filter(Boolean) : [];
    if (cleanRanges.length === 0 || targetCount <= 0) return [];
    if (cleanRanges.length === targetCount) return cleanRanges;

    if (cleanRanges.length > targetCount) {
        const bucketSize = cleanRanges.length / targetCount;
        const output = [];
        for (let bucketIndex = 0; bucketIndex < targetCount; bucketIndex += 1) {
            const startIndex = Math.floor(bucketIndex * bucketSize);
            const endIndex = Math.max(startIndex, Math.floor((bucketIndex + 1) * bucketSize) - 1);
            const group = cleanRanges.slice(startIndex, endIndex + 1);
            output.push({
                start: group[0].start,
                end: group[group.length - 1].end,
            });
        }
        return output;
    }

    const output = [...cleanRanges];
    while (output.length < targetCount) {
        let splitIndex = -1;
        let splitSize = -1;
        for (let index = 0; index < output.length; index += 1) {
            const size = output[index].end - output[index].start + 1;
            if (size > splitSize) {
                splitSize = size;
                splitIndex = index;
            }
        }
        if (splitIndex === -1 || splitSize <= 1) break;
        const candidate = output[splitIndex];
        const midpoint = Math.floor((candidate.start + candidate.end) / 2);
        const left = { start: candidate.start, end: midpoint };
        const right = { start: midpoint + 1, end: candidate.end };
        output.splice(splitIndex, 1, left, right);
    }
    return output;
};

const extractPageRangesFromGroups = (groups) => {
    const ranges = [];
    for (const group of groups) {
        const pages = [];
        const pattern = /<<PAGE_(\d+)>>/g;
        const text = String(group?.text || "");
        let match;
        while ((match = pattern.exec(text)) !== null) {
            pages.push(Number(match[1]));
        }
        if (pages.length === 0) continue;
        ranges.push({
            start: Math.min(...pages),
            end: Math.max(...pages),
        });
    }
    return ranges.sort((a, b) => a.start - b.start);
};

const toRangesFromAnchors = (anchors, totalPages) => {
    const ranges = [];
    for (let index = 0; index < anchors.length; index += 1) {
        const start = anchors[index].page;
        const nextStart = anchors[index + 1]?.page || (totalPages + 1);
        const end = Math.max(start, nextStart - 1);
        ranges.push({ start, end });
    }
    return ranges;
};

const evaluatePdfFile = async (pdfPath) => {
    const data = await fs.readFile(pdfPath);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    const pdf = await loadingTask.promise;

    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const pageLines = await extractPageLines(page);
        const pageText = pageLines.join("\n").trim();
        pageTexts.push(`<<PAGE_${pageNumber}>>\n${pageText}`);
    }
    const sourceText = pageTexts.join("\n\n");
    const { sections, chunks, groups, coverage } = runPipeline(sourceText);

    const outline = await pdf.getOutline();
    const flattenedOutline = flattenOutline(outline);
    const withPages = [];
    for (const item of flattenedOutline) {
        const page = await resolveOutlinePage(pdf, item);
        if (!page) continue;
        withPages.push({
            title: String(item.title || "").trim(),
            page,
        });
    }

    const uniqueByPage = [];
    const seenPage = new Set();
    for (const item of withPages.sort((a, b) => a.page - b.page)) {
        if (seenPage.has(item.page)) continue;
        seenPage.add(item.page);
        uniqueByPage.push(item);
    }

    let anchorSource = "outline";
    let anchors = uniqueByPage;
    if (anchors.length < 2) {
        anchors = await extractHeadingAnchorsFromPages(pdf);
        anchorSource = "page_heading_proxy";
    }

    const initialRanges = toRangesFromAnchors(anchors, pdf.numPages);

    const expectedCountTarget = clamp(anchors.length, 1, 8);
    const expectedRanges = rebucketRanges(initialRanges, expectedCountTarget);
    const predictedRanges = extractPageRangesFromGroups(groups);

    if (expectedRanges.length === 0 || predictedRanges.length === 0) {
        return {
            name: path.basename(pdfPath),
            sourceType: "pdf_proxy",
            skipped: true,
            reason: "missing_outline_or_predicted_ranges",
            anchorSource,
            pages: pdf.numPages,
            sections: sections.length,
            chunks: chunks.length,
            predictedTopics: groups.length,
            coverageRatio: coverage.coverageRatio,
        };
    }

    const boundaryIoU = meanMaxIoU(expectedRanges, predictedRanges, iouForRanges);
    const countAccuracy = scoreCountAccuracy(predictedRanges.length, expectedRanges.length);
    const score = boundaryIoU * 0.7 + countAccuracy * 0.3;

    return {
        name: path.basename(pdfPath),
        sourceType: "pdf_proxy",
        skipped: false,
        anchorSource,
        pages: pdf.numPages,
        sections: sections.length,
        chunks: chunks.length,
        expectedTopics: expectedRanges.length,
        predictedTopics: predictedRanges.length,
        coverageRatio: coverage.coverageRatio,
        boundaryIoU,
        countAccuracy,
        score,
    };
};

const average = (values) => {
    if (!Array.isArray(values) || values.length === 0) return 0;
    return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
};

const run = async () => {
    const syntheticResults = evaluateSynthetic();

    const pdfCandidates = [
        path.resolve("./stitch-app/Channel Ideas Without Remotion.pdf"),
        path.resolve("./doctra-service/notebooks/sample_data/wipo_financial_report_min.pdf"),
        path.resolve("./doctra-service/notebooks/sample_data/wipo_financial_report.pdf"),
        path.resolve("./doctra-service/notebooks/sample_data/wipo_doc_to_restore.pdf"),
    ];

    const pdfResults = [];
    for (const candidate of pdfCandidates) {
        try {
            await fs.access(candidate);
            const result = await evaluatePdfFile(candidate);
            pdfResults.push(result);
        } catch (error) {
            pdfResults.push({
                name: path.basename(candidate),
                sourceType: "pdf_proxy",
                skipped: true,
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const allScored = [...syntheticResults, ...pdfResults.filter((item) => !item.skipped)];
    const syntheticScore = average(syntheticResults.map((item) => item.score));
    const pdfProxyScore = average(pdfResults.filter((item) => !item.skipped).map((item) => item.score));
    const overallScore = average(allScored.map((item) => item.score));

    const summary = {
        generatedAt: new Date().toISOString(),
        sampleCounts: {
            synthetic: syntheticResults.length,
            pdfProxyEvaluated: pdfResults.filter((item) => !item.skipped).length,
            pdfProxySkipped: pdfResults.filter((item) => item.skipped).length,
            totalScored: allScored.length,
        },
        scores: {
            syntheticScore,
            pdfProxyScore,
            overallScore,
            overallAccuracyPercent: Number((overallScore * 100).toFixed(2)),
        },
        details: {
            syntheticResults,
            pdfResults,
        },
    };

    console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
    console.error("topic-split-benchmark failed", error);
    process.exitCode = 1;
});
