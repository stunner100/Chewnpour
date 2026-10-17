// Quality gates and cleanup for text extracted from uploads, applied before
// the text is stored. Lessons are segmented and grounded against this text,
// so noise removed here (page numbers, running headers and footers, OCR
// artefacts) never reaches a lesson, its source quotes or "View source".

// A text layer averaging fewer readable characters per page than this is
// treated as a scan: OCR runs even though an extractor returned something.
export const MIN_CHARS_PER_PAGE = 200;

const PAGE_NUMBER_LINE_RE = /^\s*(?:[-–—]\s*)?(?:page\s+)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?(?:\s*[-–—])?\s*$/i;

export const isPageNumberLine = (line) => PAGE_NUMBER_LINE_RE.test(String(line || ""));

// Characters that could teach something: page-number lines and whitespace
// do not count.
export const readableChars = (text) => String(text || "")
    .split("\n")
    .filter((line) => !isPageNumberLine(line))
    .join(" ")
    .replace(/\s+/g, "")
    .length;

export const charsPerPage = ({ text, pageCount }) => {
    const pages = Number(pageCount);
    if (!Number.isFinite(pages) || pages < 1) return null;
    return readableChars(text) / pages;
};

export const isThinTextLayer = ({ text, pageCount }) => {
    const perPage = charsPerPage({ text, pageCount });
    return perPage !== null && perPage < MIN_CHARS_PER_PAGE;
};

// Running headers and footers repeat on most pages, often with the page
// number changing ("Unit 3 - Cells | page 4"), so lines are compared with
// their digits masked.
const runningLineKey = (line) => line.trim().toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
const MAX_RUNNING_LINE_CHARS = 120;
const isRunningLineCandidate = (line) => {
    const trimmed = line.trim();
    return trimmed.length > 0
        && trimmed.length <= MAX_RUNNING_LINE_CHARS
        && !trimmed.startsWith("|")
        && !trimmed.startsWith("```");
};

// Drops page-number lines and lines repeated on at least half the pages
// (three pages at least). Works on text without page boundaries, such as
// Anydoc's markdown, because only the repeat count matters.
export const removeRunningLines = (text, pageCount) => {
    const pages = Number(pageCount);
    const lines = String(text || "").split("\n");
    const threshold = Number.isFinite(pages) && pages >= 3 ? Math.max(3, Math.ceil(pages / 2)) : Infinity;
    const counts = new Map();
    for (const line of lines) {
        if (!isRunningLineCandidate(line)) continue;
        const key = runningLineKey(line);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return lines
        .filter((line) => !isPageNumberLine(line))
        .filter((line) => !isRunningLineCandidate(line) || counts.get(runningLineKey(line)) < threshold)
        .join("\n");
};

// OCR sometimes letter-spaces headings ("P E R F O R M A N C E R E P O R T").
// Known words are rejoined; anything else is left as it is.
const SPACED_CAPS_OCR_SEQUENCE_REGEX = /\b(?:[A-Z]\s+){5,}[A-Z]\b/g;
const OCR_PHRASE_WORDS = [
    "PERFORMANCE",
    "REPORT",
    "MONTHLY",
    "BUSINESS",
    "REVIEW",
    "METRICS",
    "GMV",
    "VENDOR",
    "DELIVERED",
    "TOTAL",
    "ORDERS",
    "CANCELLATION",
    "RATE",
    "MARKET",
    "SEGMENTATION",
    "REVENUE",
    "EXPENSES",
    "SURPLUS",
    "PAYMENT",
    "PAYMENTS",
    "OPERATIONS",
    "SUMMARY",
    "KEY",
    "IDEAS",
].sort((a, b) => b.length - a.length);

const OCR_ACRONYMS = new Set(["AI", "AIR", "API", "GMV", "KPI", "KPIS", "OCR", "PDF"]);

const toTitleCase = (value) =>
    String(value || "")
        .split(/\s+/)
        .map((word) => {
            const normalized = word.toUpperCase();
            if (OCR_ACRONYMS.has(normalized)) return normalized === "KPIS" ? "KPIs" : normalized;
            return word.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
        })
        .join(" ");

const normalizeSpacedCapsOcrPhrase = (value) => {
    const compact = String(value || "").replace(/\s+/g, "");
    if (compact.length < 8) return value;

    const words = [];
    let remaining = compact;
    while (remaining) {
        const next = OCR_PHRASE_WORDS.find((candidate) => remaining.startsWith(candidate));
        if (next) {
            words.push(next);
            remaining = remaining.slice(next.length);
            continue;
        }

        const partial = OCR_PHRASE_WORDS.find(
            (candidate) =>
                candidate.startsWith(remaining)
                && remaining.length >= Math.min(5, candidate.length - 1)
        );
        if (partial) {
            words.push(partial);
            remaining = "";
            continue;
        }

        const partialFollowingWord = OCR_PHRASE_WORDS.find(
            (candidate) =>
                words.length > 0
                && candidate.startsWith(remaining)
                && remaining.length >= 3
        );
        if (partialFollowingWord) {
            words.push(partialFollowingWord);
            remaining = "";
            continue;
        }

        if (words.length > 0 && remaining.length <= 2) {
            remaining = "";
            continue;
        }

        return value;
    }

    return toTitleCase(words.join(" "));
};

// A "[" or "]" with no partner on the same line is an OCR artefact.
const stripOrphanBrackets = (line) => {
    if (!/[[\]]/.test(line)) return line;
    const keep = new Array(line.length).fill(true);
    const open = [];
    for (let index = 0; index < line.length; index += 1) {
        if (line[index] === "[") open.push(index);
        else if (line[index] === "]") {
            if (open.length) open.pop();
            else keep[index] = false;
        }
    }
    open.forEach((index) => { keep[index] = false; });
    return [...line].filter((_, index) => keep[index]).join("");
};

export const cleanExtractedText = (text) => {
    let inCode = false;
    return String(text || "")
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .split("\n")
        .map((line) => {
            if (line.trim().startsWith("```")) {
                inCode = !inCode;
                return line;
            }
            if (inCode) return line;
            return stripOrphanBrackets(line.replace(SPACED_CAPS_OCR_SEQUENCE_REGEX, normalizeSpacedCapsOcrPhrase)).replace(/[ \t]+$/, "");
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

// The text stored for an upload. Paged documents (PDF) also lose page
// numbers and running headers and footers.
export const prepareExtractedText = ({ text, pageCount, paged = false }) =>
    cleanExtractedText(paged ? removeRunningLines(text, pageCount) : text);

// For a thin text layer, which text to keep once OCR has run: OCR's when it
// reads more, otherwise the text layer if it holds a page's worth of
// readable text, otherwise neither (the upload fails).
export const pickThinLayerText = ({ text, ocrText }) => {
    if (ocrText && readableChars(ocrText) > readableChars(text)) return "ocr";
    return readableChars(text) >= MIN_CHARS_PER_PAGE ? "extracted" : "none";
};
