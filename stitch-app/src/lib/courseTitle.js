// Convert file-style course titles into human-readable course titles.
// Examples:
//   "AI_Powered_Food_Delivery_Operations" -> "AI-Powered Food Delivery Operations"
//   "intro-to-microeconomics.pdf"        -> "Intro to Microeconomics"
//   "BIOL_201 - Cell Biology Lecture 1"  -> "BIOL 201 - Cell Biology Lecture 1"
//   "math151 notes"                      -> "MATH151 Notes"

const SMALL_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of',
    'on', 'or', 'so', 'the', 'to', 'up', 'with', 'vs',
]);

const ALL_CAPS_KEEP = new Set([
    'AI', 'API', 'CPU', 'GPU', 'GPT', 'IT', 'IO', 'UX', 'UI', 'CRM', 'ERP',
    'SQL', 'HTML', 'CSS', 'JS', 'TS', 'PDF', 'PPT', 'PPTX', 'DOCX', 'NLP',
    'OCR', 'ML', 'IOT', 'TCP', 'IP', 'HTTP', 'HTTPS', 'JSON', 'XML', 'CEO',
    'CFO', 'CTO', 'CMO', 'COO', 'B2B', 'B2C', 'KPI', 'OKR', 'ROI',
]);

const KNOWN_HYPHENATED_PREFIXES = new Set([
    'AI', 'AR', 'VR', 'API', 'B2B', 'B2C', 'IO', 'UX', 'UI',
]);

const stripExtension = (value) =>
    value.replace(/\.(pdf|pptx?|docx?|txt|md|rtf|key|odp|ods|odt|csv|xlsx?|mp3|m4a|mp4|wav|webm|ogg|aac|flac)$/i, '');

const normaliseSeparators = (value) => value.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

// Course codes like "MATH151", "cs50" or "BIOL 101".
const COURSE_CODE = /^([A-Za-z]{2,4})\d{2,4}[A-Za-z]?$/;
const CODE_PREFIX = /^[A-Z]{2,4}$/;
const ALL_CAPS_WORD = /^[A-Z]{2,}$/;
const NUMBER_WORD = /^\d+[A-Za-z]?$/;
// Words that come before a number without being a department code.
const NUMBERED_WORDS = new Set([
    'DAY', 'EXAM', 'LAB', 'PAGE', 'PART', 'QUIZ', 'SET', 'TERM', 'TEST', 'UNIT', 'WEEK', 'YEAR',
]);

const isCourseCode = (word) => {
    const match = word.match(COURSE_CODE);
    return Boolean(match) && !NUMBERED_WORDS.has(match[1].toUpperCase());
};

const capitalizeWord = (word, { isFirst, keepCaps, beforeNumber }) => {
    if (!word) return word;
    const upperCandidate = word.toUpperCase();
    if (ALL_CAPS_KEEP.has(upperCandidate)) return upperCandidate;
    if (isCourseCode(word)) return upperCandidate;
    // "BIOL 101" is a code even in an all-caps title; other caps words are kept
    // only when the title is not shouting ("Intro to MATLAB").
    if (ALL_CAPS_WORD.test(word) && keepCaps) return word;
    if (beforeNumber && CODE_PREFIX.test(word) && !NUMBERED_WORDS.has(word)) return word;

    // Keep tokens that already mix case (e.g. "iOS", "GraphQL", "PostgreSQL").
    if (/[a-z]/.test(word) && /[A-Z]/.test(word.slice(1))) return word;

    const lower = word.toLowerCase();
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const isSeparator = (part) => /^\s+$/.test(part) || part === '—' || part === '–' || part === '-' || part === ':';

const titleCase = (input) => {
    const parts = input.split(/(\s+|—|–|-|:)/).filter((part) => part !== '');
    const keepCaps = /[a-z]/.test(input);
    let wordIndex = 0;
    return parts
        .map((part, index) => {
            if (isSeparator(part)) return part;
            const next = parts.slice(index + 1).find((candidate) => !isSeparator(candidate)) || '';
            const cap = capitalizeWord(part, {
                isFirst: wordIndex === 0,
                keepCaps,
                beforeNumber: NUMBER_WORD.test(next),
            });
            wordIndex += 1;
            return cap;
        })
        .join('');
};

// Re-hyphenate well known compounds like "AI Powered" -> "AI-Powered" so the
// final title reads as designed: "AI-Powered Food Delivery Operations".
const rejoinHyphenated = (value) => {
    let out = value;
    KNOWN_HYPHENATED_PREFIXES.forEach((prefix) => {
        const re = new RegExp(`\\b${prefix}\\s+([A-Z][a-zA-Z]+)`, 'g');
        out = out.replace(re, `${prefix}-$1`);
    });
    return out;
};

export const formatCourseTitle = (raw) => {
    if (!raw) return '';
    const stripped = stripExtension(String(raw));
    const normalised = normaliseSeparators(stripped);
    if (!normalised) return '';
    const cased = titleCase(normalised);
    return rejoinHyphenated(cased);
};

export default formatCourseTitle;
