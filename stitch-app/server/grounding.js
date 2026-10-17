// Checks that generated text is supported by the source document before it
// is kept: quiz answers, in-lesson checks, ordering steps, lesson sections and
// word bank terms.
//
// Matching is on whole words (light plural stemming), so "cat" never matches
// "education". Numbers and names are facts a model invents easily, so every
// number and every capitalised name in the claim must appear in the source;
// the remaining words only need to be mostly present, since answers are often
// reworded.

const STOPWORDS = new Set([
    "the", "and", "for", "are", "was", "were", "with", "that", "this", "from", "into", "its", "has",
    "have", "had", "but", "not", "you", "your", "they", "their", "them", "which", "what", "when",
    "where", "who", "why", "how", "all", "any", "can", "will", "would", "should", "could", "may",
    "also", "than", "then", "there", "these", "those", "such", "each", "other", "more", "most",
    "some", "only", "both", "about", "over", "under", "between", "because", "while", "being", "been",
]);

const foldAccents = (value) => String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "");

const stem = (token) => (token.length > 4 ? token.replace(/(?:ies|es|s)$/, "") : token);

const tokensOf = (value) => foldAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

// The source's words, built once per source text.
const sourceIndexCache = new Map();
const sourceIndex = (source) => {
    const key = String(source || "");
    let index = sourceIndexCache.get(key);
    if (!index) {
        const tokens = tokensOf(key);
        index = { words: new Set(tokens.map(stem)), joined: ` ${tokens.join(" ")} ` };
        if (sourceIndexCache.size > 50) sourceIndexCache.clear();
        sourceIndexCache.set(key, index);
    }
    return index;
};

const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
const LIST_MARKER_RE = /^\s*(?:\d+[.)]|[-*+])\s+/gm;

export const numbersIn = (text) =>
    (String(text || "").replace(LIST_MARKER_RE, "").match(NUMBER_RE) || [])
        .flatMap((number) => number.split(/[.,]/))
        .filter(Boolean);

// Capitalised words that do not start a sentence or line: proper names,
// acronyms and named terms ("Krueger", "DNA", "Golgi").
export const namesIn = (text) => {
    const names = [];
    const plain = foldAccents(String(text || ""))
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[*_`#>|[\]()]/g, " ");
    for (const sentence of plain.split(/(?<=[.!?:;])\s+|\n+/)) {
        const words = sentence.trim().split(/\s+/);
        words.slice(1).forEach((word) => {
            const clean = word.replace(/[^A-Za-z0-9'-]/g, "");
            if (/^[A-Z][A-Za-z'-]*[A-Za-z]$/.test(clean) && !STOPWORDS.has(clean.toLowerCase())) names.push(clean);
        });
    }
    return names;
};

export const sourceHasWord = (word, source) =>
    tokensOf(word).every((token) => sourceIndex(source).words.has(stem(token)));

export const sourceHasPhrase = (phrase, source) => {
    const tokens = tokensOf(phrase);
    return tokens.length > 0 && sourceIndex(source).joined.includes(` ${tokens.join(" ")} `);
};

// Share of the claim's content words (3+ letters, not stopwords) found in the
// source as whole words.
export const contentWordCoverage = (text, source) => {
    const words = tokensOf(text).filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !/\d/.test(token));
    if (words.length === 0) return 1;
    const index = sourceIndex(source);
    return words.filter((token) => index.words.has(stem(token))).length / words.length;
};

export const isTextGroundedInSource = (text, source, { minTokenRatio = 0.5 } = {}) => {
    if (!tokensOf(text).length) return false;
    // Fail open when there is no source to check against rather than dropping
    // every question on a missing extraction.
    if (!String(source || "").trim()) return true;
    if (sourceHasPhrase(text, source)) return true;
    if (!numbersIn(text).every((number) => sourceHasWord(number, source))) return false;
    if (!namesIn(` ${text}`).every((name) => sourceHasWord(name, source))) return false;
    const hasContentWords = tokensOf(text).some((token) => token.length >= 3 && !STOPWORDS.has(token) && !/\d/.test(token));
    if (!hasContentWords) return numbersIn(text).length > 0;
    return contentWordCoverage(text, source) >= minTokenRatio;
};
