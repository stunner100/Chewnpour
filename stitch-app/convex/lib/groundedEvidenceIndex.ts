"use node";

export type EvidencePassage = {
    passageId: string;
    page: number;
    startChar: number;
    endChar: number;
    sectionHint: string;
    text: string;
    flags: string[];
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

type ExtractionArtifactLike = {
    pages?: ExtractionArtifactPage[];
};

const INDEX_VERSION = "grounded-v1";
const PASSAGE_TARGET_CHARS = 900;
const PASSAGE_MIN_CHARS = 260;

const sanitizeText = (value: string) =>
    String(value || "")
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

const splitIntoPassages = (pageText: string, page: number): EvidencePassage[] => {
    const sanitized = sanitizeText(pageText);
    if (!sanitized) return [];

    // Split on double-newlines and track each paragraph's position in the
    // sanitized string so we never need indexOf (which can fail after
    // sanitization modifies whitespace).
    const paragraphsWithPos: Array<{ text: string; start: number }> = [];
    const splitRegex = /\n{2,}/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = splitRegex.exec(sanitized)) !== null) {
        const chunk = sanitizeText(sanitized.slice(lastEnd, match.index));
        if (chunk) {
            paragraphsWithPos.push({ text: chunk, start: lastEnd });
        }
        lastEnd = match.index + match[0].length;
    }
    // Trailing text after last separator
    const trailing = sanitizeText(sanitized.slice(lastEnd));
    if (trailing) {
        paragraphsWithPos.push({ text: trailing, start: lastEnd });
    }

    if (paragraphsWithPos.length === 0) {
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

    const passages: EvidencePassage[] = [];
    let current = "";
    let currentStart = 0;

    const flush = () => {
        const text = sanitizeText(current);
        if (!text) return;
        const sectionHint = text.split("\n")[0]?.slice(0, 120).trim() || "";
        passages.push({
            passageId: `p${page + 1}-${passages.length}`,
            page,
            startChar: currentStart,
            endChar: currentStart + text.length,
            sectionHint,
            text,
            flags: buildFlags(text),
        });
    };

    for (const { text: paragraph, start: paragraphStart } of paragraphsWithPos) {
        if (!current) {
            current = paragraph;
            currentStart = paragraphStart;
            continue;
        }

        const candidate = `${current}\n\n${paragraph}`;
        if (candidate.length <= PASSAGE_TARGET_CHARS || current.length < PASSAGE_MIN_CHARS) {
            current = candidate;
            continue;
        }

        flush();
        current = paragraph;
        currentStart = paragraphStart;
    }

    if (current) flush();

    return passages;
};

export const buildGroundedEvidenceIndexFromArtifact = (args: {
    artifact: ExtractionArtifactLike;
    uploadId?: string;
}): GroundedEvidenceIndex => {
    const pages = Array.isArray(args.artifact?.pages) ? args.artifact.pages : [];

    const passages = pages.flatMap((page, pageOffset) => {
        const pageIndex = Number.isFinite(Number(page?.index)) ? Number(page?.index) : pageOffset;
        return splitIntoPassages(String(page?.text || ""), Math.max(0, Math.floor(pageIndex)));
    });

    return {
        version: INDEX_VERSION,
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
