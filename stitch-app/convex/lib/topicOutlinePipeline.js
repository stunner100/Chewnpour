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

const dedupeNumbers = (values) => {
    const output = [];
    const seen = new Set();
    for (const value of values || []) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) continue;
        if (seen.has(numberValue)) continue;
        seen.add(numberValue);
        output.push(numberValue);
    }
    return output;
};

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

const detectMajorHeadingKey = (line) => {
    const text = cleanHeading(line);
    if (!text) return "";
    const lower = text.toLowerCase();

    const labeledMatch = lower.match(/^(chapter|section|topic|lesson|unit|module|part|week)\s+([ivxlcdm]+|\d+)/i);
    if (labeledMatch) {
        return `${labeledMatch[1]}-${labeledMatch[2]}`.toLowerCase();
    }

    const numberedMatch = text.match(/^(\d+)(\.\d+)*[)\-.:]?\s+/);
    if (numberedMatch?.[1]) {
        return `section-${numberedMatch[1]}`;
    }

    return "";
};

const detectHeadingLevel = (line) => {
    const text = cleanHeading(line);
    if (!text) return 0;
    if (/^(chapter|section|topic|lesson|unit|module|part|week)\s+([ivxlcdm]+|\d+)/i.test(text)) return 1;
    if (/^\d+(\.\d+){1,}[)\-.:]?\s+/.test(text)) return 2;
    if (/^\d+[)\-.:]?\s+/.test(text)) return 1;
    return 2;
};

const isLikelyHeading = (line) => {
    const text = cleanHeading(line);
    if (!text) return false;
    if (text.length < 4 || text.length > 140) return false;
    if (/^[-=*•]{2,}$/.test(text)) return false;

    // Markdown-style headings: ## Heading, ### Heading
    if (/^#{1,6}\s+.+/.test(String(line || '').trim())) return true;

    // Bold-text headings: **Section Title** (standalone bold lines)
    const boldMatch = String(line || '').trim().match(/^\*\*([^*]{3,90})\*\*\s*$/);
    if (boldMatch) return true;

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
            majorKey: detectMajorHeadingKey(currentHeading),
            headingLevel: detectHeadingLevel(currentHeading),
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
                majorKey: "",
                headingLevel: 0,
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
        majorKeys: [],
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
            majorKeys: current.majorKeys,
            text,
        });
        current = {
            chunkIds: [],
            sectionIds: [],
            headingHints: [],
            majorKeys: [],
            text: "",
        };
    };

    for (const section of sourceSections) {
        const heading = cleanHeading(section.heading);
        const majorKey = section.majorKey || detectMajorHeadingKey(heading);
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
            if (majorKey) current.majorKeys.push(majorKey);
        }
    }

    pushCurrent();

    if (roughChunks.length === 0) return [];

    let mergedChunks = roughChunks.map((chunk) => ({
        ...chunk,
        primaryMajorKey: chunk.majorKeys?.[0] || "",
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
            majorKeys: uniqueStrings(chunk.majorKeys).slice(0, 6),
            primaryMajorKey: chunk.primaryMajorKey || "",
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

const mergeGroups = (left, right) => {
    const text = `${left.text}\n\n${right.text}`.replace(/\n{3,}/g, "\n\n").trim();
    return {
        id: 0,
        chunkIds: dedupeNumbers([...(left.chunkIds || []), ...(right.chunkIds || [])]),
        headingHints: uniqueStrings([...(left.headingHints || []), ...(right.headingHints || [])]).slice(0, 8),
        keywords: uniqueStrings([...(left.keywords || []), ...(right.keywords || [])]).slice(0, 16),
        majorKeys: uniqueStrings([...(left.majorKeys || []), ...(right.majorKeys || [])]).slice(0, 8),
        wordCount: countWords(text),
        text,
    };
};

export const deriveTargetTopicCount = (options = {}) => {
    const wordCount = Math.max(0, Number(options.wordCount || 0));
    const chunkCount = Math.max(1, Number(options.chunkCount || 1));
    const minimum = Math.max(1, Number(options.minimum || 4));
    const maximum = Math.max(minimum, Number(options.maximum || 8));

    const byWords = Math.ceil(wordCount / 800);
    const byChunks = Math.ceil(chunkCount * 0.85);
    const rawTarget = Math.max(2, byWords, byChunks);
    const bounded = clamp(rawTarget, minimum, maximum);
    return clamp(bounded, 1, chunkCount);
};

export const groupChunksIntoTopicBuckets = (chunks, options = {}) => {
    const sourceChunks = Array.isArray(chunks) ? chunks.filter((chunk) => chunk && Number.isFinite(chunk.id)) : [];
    if (sourceChunks.length === 0) return [];

    const targetTopicCount = clamp(
        Number(options.targetTopicCount || sourceChunks.length),
        1,
        sourceChunks.length
    );
    const idealWordsPerTopic = sourceChunks.reduce((sum, chunk) => sum + Number(chunk.wordCount || 0), 0) / targetTopicCount;

    const groups = sourceChunks.map((chunk) => ({
        id: chunk.id,
        chunkIds: Array.isArray(chunk.sourceChunkIds) ? dedupeNumbers(chunk.sourceChunkIds) : [chunk.id],
        headingHints: uniqueStrings(chunk.headingHints || []).slice(0, 8),
        keywords: uniqueStrings(chunk.keywords || []).slice(0, 16),
        majorKeys: uniqueStrings(chunk.majorKeys || []).slice(0, 8),
        wordCount: Number(chunk.wordCount || 0),
        text: chunk.text || "",
    }));

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
            const majorOverlap = keywordOverlapScore(left.majorKeys, right.majorKeys);
            const combinedWords = left.wordCount + right.wordCount;
            const sizePenalty = Math.abs(combinedWords - idealWordsPerTopic) / Math.max(idealWordsPerTopic, 1);
            const structuralPenalty = left.majorKeys?.length > 0 && right.majorKeys?.length > 0 && majorOverlap === 0
                ? 3
                : 0;
            const score = overlap * 4 + headingOverlap * 2 - sizePenalty - structuralPenalty;

            if (score > bestScore || (score === bestScore && combinedWords < bestCombinedWords)) {
                bestScore = score;
                bestIndex = index;
                bestCombinedWords = combinedWords;
            }
        }

        const merged = mergeGroups(groups[bestIndex], groups[bestIndex + 1]);
        groups.splice(bestIndex, 2, merged);
    }

    while (groups.length < targetTopicCount) {
        let splitIndex = -1;
        let splitWordCount = -1;
        for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index];
            // Allow splitting groups with multiple chunks OR single large chunks (text-based split)
            if (group.chunkIds.length < 2 && group.wordCount < 400) continue;
            if (group.wordCount > splitWordCount) {
                splitWordCount = group.wordCount;
                splitIndex = index;
            }
        }
        if (splitIndex === -1) break;

        const candidate = groups[splitIndex];

        // For multi-chunk groups, split by chunk IDs
        if (candidate.chunkIds.length >= 2) {
            const midpoint = Math.floor(candidate.chunkIds.length / 2);
            const leftIds = candidate.chunkIds.slice(0, midpoint);
            const rightIds = candidate.chunkIds.slice(midpoint);
            if (leftIds.length === 0 || rightIds.length === 0) break;
            const left = {
                id: groups.length,
                chunkIds: leftIds,
                headingHints: [...candidate.headingHints],
                keywords: [...candidate.keywords],
                majorKeys: [...candidate.majorKeys],
                wordCount: Math.floor(candidate.wordCount / 2),
                text: candidate.text,
            };
            const right = {
                id: groups.length + 1,
                chunkIds: rightIds,
                headingHints: [...candidate.headingHints],
                keywords: [...candidate.keywords],
                majorKeys: [...candidate.majorKeys],
                wordCount: candidate.wordCount - left.wordCount,
                text: candidate.text,
            };
            groups.splice(splitIndex, 1, left, right);
        } else {
            // Single-chunk large group: split by paragraph boundary
            const paragraphs = candidate.text.split(/\n{2,}/).filter(Boolean);
            if (paragraphs.length < 2) break;
            const midPara = Math.floor(paragraphs.length / 2);
            const leftText = paragraphs.slice(0, midPara).join('\n\n').trim();
            const rightText = paragraphs.slice(midPara).join('\n\n').trim();
            if (!leftText || !rightText) break;
            const leftHeadings = candidate.headingHints.slice(0, Math.max(1, Math.floor(candidate.headingHints.length / 2)));
            const rightHeadings = candidate.headingHints.slice(Math.max(1, Math.floor(candidate.headingHints.length / 2)));
            const left = {
                id: groups.length,
                chunkIds: [...candidate.chunkIds],
                headingHints: leftHeadings.length > 0 ? leftHeadings : [...candidate.headingHints],
                keywords: [...candidate.keywords],
                majorKeys: [...candidate.majorKeys],
                wordCount: countWords(leftText),
                text: leftText,
            };
            const right = {
                id: groups.length + 1,
                chunkIds: [...candidate.chunkIds],
                headingHints: rightHeadings.length > 0 ? rightHeadings : [...candidate.headingHints],
                keywords: extractOutlineKeywords(rightText),
                majorKeys: [...candidate.majorKeys],
                wordCount: countWords(rightText),
                text: rightText,
            };
            groups.splice(splitIndex, 1, left, right);
        }
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

export const deriveStructureTopicCount = (sections) => {
    const majors = new Set();
    for (const section of sections || []) {
        if (!section?.majorKey) continue;
        majors.add(section.majorKey);
    }
    if (majors.size >= 2) {
        return clamp(majors.size, 2, 15);
    }
    return 0;
};

export const aggregateChunksByMajorKey = (chunks) => {
    const sourceChunks = Array.isArray(chunks) ? chunks : [];
    if (sourceChunks.length === 0) return [];

    const aggregated = [];
    let current = null;

    const pushCurrent = () => {
        if (!current) return;
        aggregated.push(current);
        current = null;
    };

    for (const chunk of sourceChunks) {
        const primaryKey = chunk.primaryMajorKey || chunk.majorKeys?.[0] || "";
        if (!current) {
            current = {
                id: aggregated.length,
                sourceChunkIds: [chunk.id],
                headingHints: [...(chunk.headingHints || [])],
                keywords: [...(chunk.keywords || [])],
                majorKeys: primaryKey ? [primaryKey] : [],
                wordCount: Number(chunk.wordCount || 0),
                text: chunk.text,
            };
            continue;
        }

        const currentKey = current.majorKeys?.[0] || "";
        const sameKey = currentKey && primaryKey && currentKey === primaryKey;
        if (sameKey || (!currentKey && !primaryKey)) {
            current.sourceChunkIds.push(chunk.id);
            current.headingHints.push(...(chunk.headingHints || []));
            current.keywords.push(...(chunk.keywords || []));
            if (primaryKey && !current.majorKeys.includes(primaryKey)) current.majorKeys.push(primaryKey);
            current.wordCount += Number(chunk.wordCount || 0);
            current.text = `${current.text}\n\n${chunk.text}`.trim();
            continue;
        }

        pushCurrent();
        current = {
            id: aggregated.length,
            sourceChunkIds: [chunk.id],
            headingHints: [...(chunk.headingHints || [])],
            keywords: [...(chunk.keywords || [])],
            majorKeys: primaryKey ? [primaryKey] : [],
            wordCount: Number(chunk.wordCount || 0),
            text: chunk.text,
        };
    }

    pushCurrent();
    return aggregated.map((group, index) => ({
        ...group,
        id: index,
        headingHints: uniqueStrings(group.headingHints).slice(0, 8),
        keywords: uniqueStrings(group.keywords).slice(0, 16),
        sourceChunkIds: dedupeNumbers(group.sourceChunkIds),
        chunkIds: dedupeNumbers(group.sourceChunkIds),
    }));
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
