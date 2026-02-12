const KEYWORD_STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "your",
    "into",
    "about",
    "topic",
    "section",
    "chapter",
    "lesson",
    "overview",
    "introduction",
    "summary",
    "basics",
    "fundamentals",
    "study",
    "material",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const countWords = (value) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

const uniqueStrings = (values) => {
    const seen = new Set();
    const output = [];
    for (const value of values || []) {
        const cleaned = String(value || "").trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(cleaned);
    }
    return output;
};

const cleanHeading = (value) =>
    String(value || "")
        .replace(/^[#*\-\s]+/, "")
        .replace(/\s+/g, " ")
        .trim();

const isLikelyHeading = (line) => {
    const text = cleanHeading(line);
    if (!text) return false;
    if (text.length < 4 || text.length > 140) return false;
    if (/^[-=*•]{2,}$/.test(text)) return false;
    if (/^[a-z]/.test(text)) return false;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 14) return false;
    if (/^(chapter|section|topic|lesson|unit|module|part)\s+\d+/i.test(text)) return true;
    if (/^\d+(\.\d+){0,3}[)\-.:]?\s+[A-Z]/.test(text)) return true;
    if (/^[IVXLCDM]+\.\s+[A-Z]/.test(text)) return true;
    if (/:$/.test(text) && words.length <= 10) return true;

    const alphaWords = words.filter((word) => /[A-Za-z]/.test(word));
    if (alphaWords.length === 0) return false;

    const titleCaseWords = alphaWords.filter((word) => /^[A-Z][a-z0-9'/-]+$/.test(word));
    const upperWords = alphaWords.filter((word) => word.length > 1 && word === word.toUpperCase());
    const headingRatio = (titleCaseWords.length + upperWords.length) / alphaWords.length;
    if (headingRatio >= 0.7 && words.length <= 12) return true;

    if (/^[A-Z0-9][A-Z0-9 ,:&()'/-]+$/.test(text) && words.length <= 12) return true;
    if (/[.!?]$/.test(text) && words.length > 8) return false;
    return false;
};

const normalizeSectionContent = (lines) =>
    String((lines || []).join("\n"))
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const extractOutlineKeywords = (text) =>
    uniqueStrings(
        String(text || "")
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map((word) => word.trim())
            .filter((word) => word.length >= 4 && !KEYWORD_STOP_WORDS.has(word))
            .slice(0, 24)
    );

const splitLargeTextBlock = (text, maxChars) => {
    const paragraphs = String(text || "")
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) return [];

    const chunks = [];
    let current = "";

    const pushCurrent = () => {
        const trimmed = current.trim();
        if (trimmed) chunks.push(trimmed);
        current = "";
    };

    const append = (part) => {
        if (!part) return;
        if (!current) {
            current = part;
            return;
        }
        const candidate = `${current}\n\n${part}`;
        if (candidate.length > maxChars) {
            pushCurrent();
            current = part;
            return;
        }
        current = candidate;
    };

    for (const paragraph of paragraphs) {
        if (paragraph.length <= maxChars) {
            append(paragraph);
            continue;
        }

        const sentences = paragraph
            .split(/(?<=[.!?])\s+/)
            .map((sentence) => sentence.trim())
            .filter(Boolean);

        if (sentences.length === 0) {
            for (let index = 0; index < paragraph.length; index += maxChars) {
                append(paragraph.slice(index, index + maxChars));
            }
            continue;
        }

        for (const sentence of sentences) {
            if (sentence.length <= maxChars) {
                append(sentence);
                continue;
            }
            for (let index = 0; index < sentence.length; index += maxChars) {
                append(sentence.slice(index, index + maxChars));
            }
        }
    }

    pushCurrent();
    return chunks;
};

export const extractStructuredSections = (text, options = {}) => {
    const minSectionWords = Math.max(25, Number(options.minSectionWords || 45));
    const maxSections = Math.max(3, Number(options.maxSections || 120));
    const normalized = String(text || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[ \f\v]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!normalized) return [];

    const rawSections = [];
    const lines = normalized.split("\n");
    let currentHeading = "";
    let currentLines = [];

    const flushSection = () => {
        const content = normalizeSectionContent(currentLines);
        currentLines = [];
        if (!content) return;
        rawSections.push({
            heading: currentHeading || `Section ${rawSections.length + 1}`,
            content,
            wordCount: countWords(content),
        });
        currentHeading = "";
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (currentLines.length > 0 && currentLines[currentLines.length - 1] !== "") {
                currentLines.push("");
            }
            continue;
        }

        const shouldStartNewSection = isLikelyHeading(trimmed) && (
            currentLines.length === 0
            || countWords(currentLines.join(" ")) >= minSectionWords
            || currentLines.length >= 6
        );

        if (shouldStartNewSection) {
            if (currentLines.length > 0) {
                flushSection();
            }
            currentHeading = cleanHeading(trimmed);
            continue;
        }

        currentLines.push(trimmed);
    }

    flushSection();

    const sections = rawSections.length > 0
        ? rawSections
        : normalized
            .split(/\n{2,}/)
            .map((paragraph, index) => ({
                heading: `Section ${index + 1}`,
                content: paragraph.trim(),
                wordCount: countWords(paragraph),
            }))
            .filter((section) => section.content);

    if (sections.length === 0) return [];

    const merged = [];
    for (const section of sections) {
        if (merged.length === 0) {
            merged.push({ ...section });
            continue;
        }

        const last = merged[merged.length - 1];
        if (section.wordCount < Math.floor(minSectionWords / 2)) {
            last.content = `${last.content}\n\n${section.content}`.trim();
            last.wordCount = countWords(last.content);
            continue;
        }
        merged.push({ ...section });
    }

    if (merged.length <= maxSections) {
        return merged.map((section, index) => ({ ...section, id: index }));
    }

    const capped = [];
    const overflow = merged.length - maxSections + 1;
    for (let index = 0; index < merged.length; index += 1) {
        if (index < maxSections - 1) {
            capped.push(merged[index]);
            continue;
        }
        const tailSections = merged.slice(index, index + overflow);
        const title = tailSections[0]?.heading || `Section ${capped.length + 1}`;
        const content = tailSections.map((item) => item.content).join("\n\n").trim();
        capped.push({
            heading: title,
            content,
            wordCount: countWords(content),
        });
        break;
    }

    return capped.map((section, index) => ({ ...section, id: index }));
};

const mergeChunkPair = (left, right) => ({
    chunkIds: [...left.chunkIds, ...right.chunkIds],
    sectionIds: uniqueStrings([...left.sectionIds, ...right.sectionIds]),
    headingHints: uniqueStrings([...left.headingHints, ...right.headingHints]).slice(0, 8),
    text: `${left.text}\n\n${right.text}`.replace(/\n{3,}/g, "\n\n").trim(),
});

export const buildSemanticChunks = (sections, options = {}) => {
    const maxChunkChars = Math.max(1200, Number(options.maxChunkChars || 5200));
    const minChunkChars = clamp(Number(options.minChunkChars || 1800), 800, maxChunkChars);
    const maxChunks = Math.max(3, Number(options.maxChunks || 10));

    const sourceSections = Array.isArray(sections) ? sections.filter((section) => section?.content) : [];
    if (sourceSections.length === 0) return [];

    const roughChunks = [];
    let current = {
        chunkIds: [],
        sectionIds: [],
        headingHints: [],
        text: "",
    };
    let nextChunkId = 0;

    const pushCurrent = () => {
        const text = String(current.text || "").trim();
        if (!text) return;
        roughChunks.push({
            chunkIds: current.chunkIds.length > 0 ? current.chunkIds : [roughChunks.length],
            sectionIds: current.sectionIds,
            headingHints: current.headingHints,
            text,
        });
        current = {
            chunkIds: [],
            sectionIds: [],
            headingHints: [],
            text: "",
        };
    };

    for (const section of sourceSections) {
        const heading = cleanHeading(section.heading);
        const block = [heading, section.content].filter(Boolean).join("\n\n");
        const pieces = splitLargeTextBlock(block, maxChunkChars);

        for (const piece of pieces) {
            const currentLength = current.text.length;
            const pieceLength = piece.length;
            const projectedLength = currentLength + (currentLength > 0 ? 2 : 0) + pieceLength;

            if (currentLength >= minChunkChars && projectedLength > maxChunkChars) {
                pushCurrent();
            }

            if (!current.text) {
                current.text = piece;
            } else {
                current.text = `${current.text}\n\n${piece}`.trim();
            }
            current.chunkIds.push(nextChunkId);
            nextChunkId += 1;
            current.sectionIds.push(String(section.id));
            if (heading) current.headingHints.push(heading);
        }
    }

    pushCurrent();

    if (roughChunks.length === 0) return [];

    let mergedChunks = roughChunks.map((chunk) => ({
        ...chunk,
        wordCount: countWords(chunk.text),
    }));

    while (mergedChunks.length > maxChunks) {
        let mergeIndex = 0;
        let mergeScore = Number.POSITIVE_INFINITY;
        for (let index = 0; index < mergedChunks.length - 1; index += 1) {
            const combinedWords = mergedChunks[index].wordCount + mergedChunks[index + 1].wordCount;
            if (combinedWords < mergeScore) {
                mergeScore = combinedWords;
                mergeIndex = index;
            }
        }

        const merged = mergeChunkPair(mergedChunks[mergeIndex], mergedChunks[mergeIndex + 1]);
        mergedChunks.splice(mergeIndex, 2, {
            ...merged,
            wordCount: countWords(merged.text),
        });
    }

    return mergedChunks.map((chunk, index) => {
        const keywords = extractOutlineKeywords(
            `${chunk.headingHints.join(" ")} ${chunk.text.slice(0, 2000)}`
        ).slice(0, 14);

        return {
            id: index,
            text: chunk.text,
            sectionIds: chunk.sectionIds,
            headingHints: uniqueStrings(chunk.headingHints).slice(0, 6),
            keywords,
            wordCount: chunk.wordCount,
        };
    });
};

const keywordOverlapScore = (leftKeywords, rightKeywords) => {
    const leftSet = new Set((leftKeywords || []).map((value) => String(value || "").toLowerCase()));
    let overlap = 0;
    for (const keyword of rightKeywords || []) {
        if (leftSet.has(String(keyword || "").toLowerCase())) {
            overlap += 1;
        }
    }
    return overlap;
};

const buildGroupFromChunkIds = (chunkIds, chunkById) => {
    const chunks = chunkIds
        .map((id) => chunkById.get(id))
        .filter(Boolean);

    const text = chunks
        .map((chunk) => chunk.text)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return {
        id: 0,
        chunkIds,
        headingHints: uniqueStrings(chunks.flatMap((chunk) => chunk.headingHints || [])).slice(0, 8),
        keywords: uniqueStrings(chunks.flatMap((chunk) => chunk.keywords || [])).slice(0, 16),
        wordCount: countWords(text),
        text,
    };
};

const mergeGroupAtIndex = (groups, index, chunkById) => {
    const left = groups[index];
    const right = groups[index + 1];
    const mergedChunkIds = [...left.chunkIds, ...right.chunkIds];
    const mergedGroup = buildGroupFromChunkIds(mergedChunkIds, chunkById);
    groups.splice(index, 2, mergedGroup);
};

export const deriveTargetTopicCount = (options = {}) => {
    const wordCount = Math.max(0, Number(options.wordCount || 0));
    const chunkCount = Math.max(1, Number(options.chunkCount || 1));
    const minimum = Math.max(1, Number(options.minimum || 4));
    const maximum = Math.max(minimum, Number(options.maximum || 8));

    const byWords = Math.ceil(wordCount / 1100);
    const byChunks = Math.ceil(chunkCount * 0.85);
    const rawTarget = Math.max(2, byWords, byChunks);
    const bounded = clamp(rawTarget, minimum, maximum);
    return clamp(bounded, 1, chunkCount);
};

export const groupChunksIntoTopicBuckets = (chunks, options = {}) => {
    const sourceChunks = Array.isArray(chunks) ? chunks.filter((chunk) => chunk && Number.isFinite(chunk.id)) : [];
    if (sourceChunks.length === 0) return [];

    const chunkById = new Map(sourceChunks.map((chunk) => [chunk.id, chunk]));
    const targetTopicCount = clamp(
        Number(options.targetTopicCount || sourceChunks.length),
        1,
        sourceChunks.length
    );
    const idealWordsPerTopic = sourceChunks.reduce((sum, chunk) => sum + Number(chunk.wordCount || 0), 0) / targetTopicCount;

    const groups = sourceChunks.map((chunk) => buildGroupFromChunkIds([chunk.id], chunkById));

    while (groups.length > targetTopicCount) {
        let bestIndex = 0;
        let bestScore = -Infinity;
        let bestCombinedWords = Infinity;

        for (let index = 0; index < groups.length - 1; index += 1) {
            const left = groups[index];
            const right = groups[index + 1];
            const overlap = keywordOverlapScore(left.keywords, right.keywords);
            const headingOverlap = keywordOverlapScore(
                extractOutlineKeywords(left.headingHints.join(" ")),
                extractOutlineKeywords(right.headingHints.join(" "))
            );
            const combinedWords = left.wordCount + right.wordCount;
            const sizePenalty = Math.abs(combinedWords - idealWordsPerTopic) / Math.max(idealWordsPerTopic, 1);
            const score = overlap * 4 + headingOverlap * 2 - sizePenalty;

            if (score > bestScore || (score === bestScore && combinedWords < bestCombinedWords)) {
                bestScore = score;
                bestIndex = index;
                bestCombinedWords = combinedWords;
            }
        }

        mergeGroupAtIndex(groups, bestIndex, chunkById);
    }

    while (groups.length < targetTopicCount) {
        let splitIndex = -1;
        let splitWordCount = -1;
        for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index];
            if (group.chunkIds.length < 2) continue;
            if (group.wordCount > splitWordCount) {
                splitWordCount = group.wordCount;
                splitIndex = index;
            }
        }
        if (splitIndex === -1) break;

        const candidate = groups[splitIndex];
        const midpoint = Math.floor(candidate.chunkIds.length / 2);
        const leftIds = candidate.chunkIds.slice(0, midpoint);
        const rightIds = candidate.chunkIds.slice(midpoint);
        if (leftIds.length === 0 || rightIds.length === 0) break;
        groups.splice(
            splitIndex,
            1,
            buildGroupFromChunkIds(leftIds, chunkById),
            buildGroupFromChunkIds(rightIds, chunkById)
        );
    }

    return groups.map((group, index) => ({ ...group, id: index }));
};

export const buildCoverageStats = ({ chunkCount, groups }) => {
    const safeChunkCount = Math.max(0, Number(chunkCount || 0));
    const seen = new Set();
    for (const group of groups || []) {
        for (const chunkId of group?.chunkIds || []) {
            seen.add(Number(chunkId));
        }
    }
    const coveredChunkCount = seen.size;
    const coverageRatio = safeChunkCount > 0
        ? coveredChunkCount / safeChunkCount
        : 0;

    return {
        chunkCount: safeChunkCount,
        coveredChunkCount,
        coverageRatio,
        isComplete: safeChunkCount > 0 && coveredChunkCount >= safeChunkCount,
    };
};

export const buildGroupSourceSnippet = (group, chunks, options = {}) => {
    const maxChars = Math.max(900, Number(options.maxChars || 5000));
    const chunkById = new Map((chunks || []).map((chunk) => [chunk.id, chunk]));
    const text = (group?.chunkIds || [])
        .map((chunkId) => chunkById.get(chunkId)?.text || "")
        .filter(Boolean)
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (text.length <= maxChars) return text;
    const headSize = Math.floor(maxChars * 0.72);
    const tailSize = Math.floor(maxChars * 0.22);
    const trimmed = `${text.slice(0, headSize).trim()}\n\n...\n\n${text.slice(-tailSize).trim()}`;
    return trimmed.slice(0, maxChars).trim();
};
