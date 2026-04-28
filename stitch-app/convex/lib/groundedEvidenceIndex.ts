"use node";

import { cleanDataLabBlockText } from "./datalabText";

export type EvidencePassage = {
    passageId: string;
    page: number;
    startChar: number;
    endChar: number;
    sectionHint: string;
    text: string;
    flags: string[];
    blockType?: string;
    headingPath?: string[];
    sourceBackend?: string;
};

export type GroundedEvidenceIndex = {
    version: string;
    uploadId?: string;
    createdAt: number;
    passageCount: number;
    pageCount: number;
    passages: EvidencePassage[];
};

type ExtractionArtifactPage = {
    index?: number;
    text?: string;
};

type ExtractionArtifactBlock = {
    id?: string;
    page?: number;
    blockType?: string;
    sectionHint?: string;
    headingPath?: string[];
    startChar?: number;
    endChar?: number;
    flags?: string[];
    source?: string;
    text?: string;
};

type ExtractionArtifactLike = {
    pages?: ExtractionArtifactPage[];
    metadata?: {
        datalabBlocks?: ExtractionArtifactBlock[];
        doclingBlocks?: ExtractionArtifactBlock[];
    };
};

export const GROUNDED_EVIDENCE_INDEX_VERSION = "grounded-v2";
const PASSAGE_TARGET_CHARS = 900;
const PASSAGE_MIN_CHARS = 260;
const PASSAGE_HARD_SPLIT_CHARS = 1100;

type SegmentationBlock = {
    start: number;
    end: number;
    text: string;
};

const sanitizeText = (value: string) =>
    cleanDataLabBlockText(String(value || ""))
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const buildFlags = (text: string) => {
    const normalized = text.toLowerCase();
    const flags: string[] = [];
    if (normalized.includes("[table]")) flags.push("table");
    if (normalized.includes("[formula]") || /\$[^$]+\$/.test(text)) flags.push("formula");
    if (/```/.test(text)) flags.push("code");
    return flags;
};

const mergeFlags = (...flagGroups: Array<string[] | undefined>) =>
    Array.from(
        new Set(
            flagGroups
                .flatMap((group) => Array.isArray(group) ? group : [])
                .map((flag) => String(flag || "").trim())
                .filter(Boolean)
        )
    );

const createSegmentationBlock = (
    source: string,
    start: number,
    end: number,
): SegmentationBlock | null => {
    let safeStart = Math.max(0, Math.floor(Number(start || 0)));
    let safeEnd = Math.max(safeStart, Math.floor(Number(end || 0)));

    while (safeStart < safeEnd && /\s/.test(source[safeStart] || "")) {
        safeStart += 1;
    }
    while (safeEnd > safeStart && /\s/.test(source[safeEnd - 1] || "")) {
        safeEnd -= 1;
    }

    const text = source.slice(safeStart, safeEnd).trim();
    if (!text) return null;

    return {
        start: safeStart,
        end: safeEnd,
        text,
    };
};

const splitIntoParagraphBlocks = (sanitized: string): SegmentationBlock[] => {
    const blocks: SegmentationBlock[] = [];
    const splitRegex = /\n{2,}/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = splitRegex.exec(sanitized)) !== null) {
        const block = createSegmentationBlock(sanitized, lastEnd, match.index);
        if (block) {
            blocks.push(block);
        }
        lastEnd = match.index + match[0].length;
    }
    const trailing = createSegmentationBlock(sanitized, lastEnd, sanitized.length);
    if (trailing) {
        blocks.push(trailing);
    }
    return blocks;
};

const isBulletLikeLine = (line: string) =>
    /^[-*•]\s+/.test(line)
    || /^\d+[.)]\s+/.test(line)
    || /^>\s*/.test(line);

const isHeadingLikeLine = (line: string) => {
    const normalized = sanitizeText(line);
    if (!normalized) return false;
    if (/^#{1,6}\s+/.test(normalized)) return true;
    if (/^(big idea|key ideas?|everyday analogies|step-by-step breakdown|mini worked example|common mistakes|word bank|quick check|summary)\b:?$/i.test(normalized)) {
        return true;
    }
    if (/^[A-Z][A-Za-z0-9 ,/&()'’-]{0,90}:$/.test(normalized)) return true;
    if (normalized.length > 90) return false;
    if (isBulletLikeLine(normalized)) return false;
    return /^[A-Z][A-Za-z0-9 ,/&()'’-]+$/.test(normalized) && !/[.!?]$/.test(normalized);
};

const splitBlockOnStructuredLines = (
    source: string,
    block: SegmentationBlock,
): SegmentationBlock[] => {
    const lines = Array.from(block.text.matchAll(/[^\n]+/g))
        .map((match) => {
            const text = sanitizeText(match[0] || "");
            if (!text) return null;
            const relativeStart = Number(match.index || 0);
            return {
                text,
                start: block.start + relativeStart,
                end: block.start + relativeStart + String(match[0] || "").length,
            };
        })
        .filter((entry): entry is { text: string; start: number; end: number } => Boolean(entry));

    if (lines.length <= 1) {
        return [block];
    }

    const segments: SegmentationBlock[] = [];
    let currentStart = -1;
    let currentEnd = -1;

    const flush = () => {
        if (currentStart < 0 || currentEnd < currentStart) return;
        const segment = createSegmentationBlock(source, currentStart, currentEnd);
        if (segment) {
            segments.push(segment);
        }
        currentStart = -1;
        currentEnd = -1;
    };

    for (const line of lines) {
        const currentLength = currentStart >= 0 ? currentEnd - currentStart : 0;
        const startsNewSection =
            isHeadingLikeLine(line.text)
            || (
                isBulletLikeLine(line.text)
                && currentLength >= Math.max(140, Math.floor(PASSAGE_MIN_CHARS / 2))
            )
            || currentLength >= PASSAGE_HARD_SPLIT_CHARS;

        if (currentStart >= 0 && startsNewSection) {
            flush();
        }

        if (currentStart < 0) {
            currentStart = line.start;
        }
        currentEnd = line.end;
    }

    flush();

    return segments.length > 1 ? segments : [block];
};

const splitBlockBySentenceWindows = (
    source: string,
    block: SegmentationBlock,
): SegmentationBlock[] => {
    const sentences = Array.from(block.text.matchAll(/[^.!?]+(?:[.!?]+|$)/g))
        .map((match) => {
            const text = sanitizeText(match[0] || "");
            if (!text) return null;
            const relativeStart = Number(match.index || 0);
            return {
                start: block.start + relativeStart,
                end: block.start + relativeStart + String(match[0] || "").length,
            };
        })
        .filter((entry): entry is { start: number; end: number } => Boolean(entry));

    if (sentences.length <= 1) {
        return [block];
    }

    const segments: SegmentationBlock[] = [];
    let currentStart = sentences[0].start;
    let currentEnd = sentences[0].end;

    const flush = () => {
        const segment = createSegmentationBlock(source, currentStart, currentEnd);
        if (segment) {
            segments.push(segment);
        }
    };

    for (let index = 1; index < sentences.length; index += 1) {
        const sentence = sentences[index];
        const currentLength = currentEnd - currentStart;
        const candidateLength = sentence.end - currentStart;
        if (candidateLength <= PASSAGE_TARGET_CHARS || currentLength < PASSAGE_MIN_CHARS) {
            currentEnd = sentence.end;
            continue;
        }

        flush();
        currentStart = sentence.start;
        currentEnd = sentence.end;
    }

    flush();

    if (segments.length > 1) {
        const last = segments[segments.length - 1];
        if (last.text.length < PASSAGE_MIN_CHARS) {
            const merged = createSegmentationBlock(
                source,
                segments[segments.length - 2].start,
                last.end,
            );
            if (merged) {
                segments.splice(segments.length - 2, 2, merged);
            }
        }
    }

    return segments.length > 1 ? segments : [block];
};

const normalizeBlocksForPassages = (
    source: string,
    blocks: SegmentationBlock[],
): SegmentationBlock[] => {
    const normalized: SegmentationBlock[] = [];

    for (const block of blocks) {
        const structuredBlocks =
            blocks.length === 1 || block.text.length > PASSAGE_HARD_SPLIT_CHARS
                ? splitBlockOnStructuredLines(source, block)
                : [block];

        for (const structuredBlock of structuredBlocks) {
            const sentenceBlocks =
                structuredBlock.text.length > PASSAGE_HARD_SPLIT_CHARS
                || (blocks.length === 1 && structuredBlock.text.length > PASSAGE_TARGET_CHARS)
                    ? splitBlockBySentenceWindows(source, structuredBlock)
                    : [structuredBlock];
            normalized.push(...sentenceBlocks);
        }
    }

    return normalized;
};

const coalesceSmallBlocks = (
    source: string,
    blocks: SegmentationBlock[],
): SegmentationBlock[] => {
    const merged: SegmentationBlock[] = [];

    for (const block of blocks) {
        const previous = merged[merged.length - 1];
        if (previous && previous.text.length < Math.floor(PASSAGE_MIN_CHARS / 2)) {
            const combined = createSegmentationBlock(source, previous.start, block.end);
            if (combined) {
                merged[merged.length - 1] = combined;
                continue;
            }
        }
        merged.push(block);
    }

    if (merged.length > 1) {
        const last = merged[merged.length - 1];
        if (last.text.length < Math.floor(PASSAGE_MIN_CHARS / 2)) {
            const combined = createSegmentationBlock(
                source,
                merged[merged.length - 2].start,
                last.end,
            );
            if (combined) {
                merged.splice(merged.length - 2, 2, combined);
            }
        }
    }

    return merged;
};

const buildPassage = (
    sanitized: string,
    page: number,
    passageIndex: number,
    start: number,
    end: number,
): EvidencePassage | null => {
    const block = createSegmentationBlock(sanitized, start, end);
    if (!block) return null;
    const sectionHint = block.text.split("\n")[0]?.slice(0, 120).trim() || "";
    return {
        passageId: `p${page + 1}-${passageIndex}`,
        page,
        startChar: block.start,
        endChar: block.end,
        sectionHint,
        text: block.text,
        flags: buildFlags(block.text),
    };
};

const splitIntoPassages = (pageText: string, page: number): EvidencePassage[] => {
    const sanitized = sanitizeText(pageText);
    if (!sanitized) return [];

    const paragraphBlocks = splitIntoParagraphBlocks(sanitized);
    const segmentationBlocks = normalizeBlocksForPassages(
        sanitized,
        paragraphBlocks.length > 0
            ? paragraphBlocks
            : [createSegmentationBlock(sanitized, 0, sanitized.length)].filter(Boolean) as SegmentationBlock[],
    );

    if (segmentationBlocks.length === 0) {
        return [{
            passageId: `p${page + 1}-0`,
            page,
            startChar: 0,
            endChar: sanitized.length,
            sectionHint: "",
            text: sanitized,
            flags: buildFlags(sanitized),
        }];
    }

    if (paragraphBlocks.length <= 1 && segmentationBlocks.length > 1) {
        return coalesceSmallBlocks(sanitized, segmentationBlocks)
            .map((block, index) => buildPassage(sanitized, page, index, block.start, block.end))
            .filter((passage): passage is EvidencePassage => Boolean(passage));
    }

    const passages: EvidencePassage[] = [];
    let currentStart = -1;
    let currentEnd = -1;

    const flush = () => {
        if (currentStart < 0 || currentEnd < currentStart) return;
        const passage = buildPassage(
            sanitized,
            page,
            passages.length,
            currentStart,
            currentEnd,
        );
        if (passage) {
            passages.push(passage);
        }
        currentStart = -1;
        currentEnd = -1;
    };

    for (const block of segmentationBlocks) {
        if (currentStart < 0) {
            currentStart = block.start;
            currentEnd = block.end;
            continue;
        }

        const currentLength = currentEnd - currentStart;
        const candidateLength = block.end - currentStart;
        if (candidateLength <= PASSAGE_TARGET_CHARS || currentLength < PASSAGE_MIN_CHARS) {
            currentEnd = block.end;
            continue;
        }

        flush();
        currentStart = block.start;
        currentEnd = block.end;
    }

    flush();

    return passages;
};

const buildStructuredBlockPassages = (args: {
    blocks: ExtractionArtifactBlock[];
    sourceBackend: "datalab" | "docling";
}) =>
    (Array.isArray(args.blocks) ? args.blocks : [])
        .map((block, index) => {
            const text = sanitizeText(String(block?.text || ""));
            const page = Number(block?.page);
            const blockType = sanitizeText(String(block?.blockType || "")).toLowerCase();
            const rawId = String(block?.id || "").trim();
            const passageId = rawId || `${args.sourceBackend}-p${Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0) + 1}-${index}`;
            if (!passageId || !text || !Number.isFinite(page) || page < 0) {
                return null;
            }
            const headingPath = Array.isArray(block?.headingPath)
                ? block.headingPath.map((entry) => sanitizeText(String(entry || ""))).filter(Boolean).slice(0, 12)
                : [];
            const sectionHint = sanitizeText(
                String(block?.sectionHint || headingPath.join(" > ") || block?.blockType || text.split("\n")[0] || "")
            ).slice(0, 160);
            const flags = mergeFlags(buildFlags(text), block?.flags);
            const structuralHint = String([
                block?.sectionHint || "",
                block?.blockType || "",
                ...(headingPath || []),
            ].join(" "));
            if (/table/i.test(structuralHint) && !flags.includes("table")) flags.push("table");
            if (/formula|equation/i.test(structuralHint) && !flags.includes("formula")) flags.push("formula");
            if (blockType && !flags.includes(blockType)) flags.push(blockType);
            const startChar = Math.max(0, Math.floor(Number(block?.startChar || 0)));
            const endChar = Math.max(startChar, Math.floor(Number(block?.endChar || text.length)));
            return {
                passageId,
                page: Math.max(0, Math.floor(page)),
                startChar,
                endChar,
                sectionHint,
                text,
                flags,
                blockType: blockType || undefined,
                headingPath,
                sourceBackend: args.sourceBackend,
            } satisfies EvidencePassage;
        })
        .filter((passage): passage is EvidencePassage => Boolean(passage));

export const buildGroundedEvidenceIndexFromArtifact = (args: {
    artifact: ExtractionArtifactLike;
    uploadId?: string;
}): GroundedEvidenceIndex => {
    const blockPassages = (() => {
        const doclingBlocks = Array.isArray(args.artifact?.metadata?.doclingBlocks)
            ? args.artifact.metadata.doclingBlocks
            : [];
        const datalabBlocks = Array.isArray(args.artifact?.metadata?.datalabBlocks)
            ? args.artifact.metadata.datalabBlocks
            : [];
        return [
            ...buildStructuredBlockPassages({ blocks: doclingBlocks, sourceBackend: "docling" }),
            ...buildStructuredBlockPassages({ blocks: datalabBlocks, sourceBackend: "datalab" }),
        ];
    })();

    if (blockPassages.length > 0) {
        const pageCount = new Set(blockPassages.map((passage) => passage.page)).size;
        return {
            version: GROUNDED_EVIDENCE_INDEX_VERSION,
            uploadId: args.uploadId,
            createdAt: Date.now(),
            passageCount: blockPassages.length,
            pageCount,
            passages: blockPassages,
        };
    }

    const pages = Array.isArray(args.artifact?.pages) ? args.artifact.pages : [];

    const passages = pages.flatMap((page, pageOffset) => {
        const pageIndex = Number.isFinite(Number(page?.index)) ? Number(page?.index) : pageOffset;
        return splitIntoPassages(String(page?.text || ""), Math.max(0, Math.floor(pageIndex)));
    });

    return {
        version: GROUNDED_EVIDENCE_INDEX_VERSION,
        uploadId: args.uploadId,
        createdAt: Date.now(),
        passageCount: passages.length,
        pageCount: pages.length,
        passages,
    };
};

export const normalizeCitationQuote = (value: string) =>
    String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const normalizeLooseCitationQuote = (value: string) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const doesQuoteMatchPassage = (quote: string, passageText: string) => {
    const normalizedQuote = normalizeCitationQuote(quote);
    if (!normalizedQuote) return false;
    const normalizedPassage = normalizeCitationQuote(passageText);
    if (normalizedPassage.includes(normalizedQuote)) {
        return true;
    }

    const looseQuote = normalizeLooseCitationQuote(quote);
    if (!looseQuote || looseQuote.length < 10) {
        return false;
    }
    const loosePassage = normalizeLooseCitationQuote(passageText);
    if (loosePassage.includes(looseQuote)) {
        return true;
    }

    const quoteTokens = looseQuote.split(" ").filter((token) => token.length >= 3);
    const passageTokens = loosePassage.split(" ").filter((token) => token.length >= 3);
    if (quoteTokens.length < 6 || passageTokens.length < 6) {
        return false;
    }

    let matched = 0;
    let searchFrom = 0;
    for (const token of quoteTokens) {
        const nextIndex = passageTokens.indexOf(token, searchFrom);
        if (nextIndex < 0) {
            continue;
        }
        matched += 1;
        searchFrom = nextIndex + 1;
    }

    return matched / quoteTokens.length >= 0.82;
};
