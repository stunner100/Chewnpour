// Display-text helpers for single lines (titles, source passages) and the
// light cleanup applied to stored lesson markdown before it is parsed.
// Lesson structure is never rewritten here: the markdown parser reads it as is.

const SPACED_CAPS_OCR_SEQUENCE_REGEX = /\b(?:[A-Z]\s+){5,}[A-Z]\b/g;
const OCR_PHRASE_WORDS = [
    'PERFORMANCE',
    'REPORT',
    'MONTHLY',
    'BUSINESS',
    'REVIEW',
    'METRICS',
    'GMV',
    'VENDOR',
    'DELIVERED',
    'TOTAL',
    'ORDERS',
    'CANCELLATION',
    'RATE',
    'MARKET',
    'SEGMENTATION',
    'REVENUE',
    'EXPENSES',
    'SURPLUS',
    'PAYMENT',
    'PAYMENTS',
    'OPERATIONS',
    'SUMMARY',
    'KEY',
    'IDEAS',
].sort((a, b) => b.length - a.length);

const OCR_ACRONYMS = new Set(['AI', 'AIR', 'API', 'GMV', 'KPI', 'KPIS', 'OCR', 'PDF']);

const toTitleCase = (value) =>
    String(value || '')
        .split(/\s+/)
        .map((word) => {
            const normalized = word.toUpperCase();
            if (OCR_ACRONYMS.has(normalized)) return normalized === 'KPIS' ? 'KPIs' : normalized;
            return word.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
        })
        .join(' ');

const normalizeSpacedCapsOcrPhrase = (value) => {
    const compact = String(value || '').replace(/\s+/g, '');
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
            remaining = '';
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
            remaining = '';
            continue;
        }

        if (words.length > 0 && remaining.length <= 2) {
            remaining = '';
            continue;
        }

        return value;
    }

    return toTitleCase(words.join(' '));
};

/**
 * Remove any '[' that has no matching ']' after it, and any ']'
 * that has no matching '[' before it. Preserves balanced [text] pairs.
 */
const stripOrphanBrackets = (str) => {
    if (!str) return str;
    if (!str.includes('[') && !str.includes(']')) return str;

    // Pass 1: strip orphaned opening brackets
    const pass1 = [];
    let i = 0;
    while (i < str.length) {
        if (str[i] === '[') {
            const close = str.indexOf(']', i + 1);
            if (close === -1) {
                // No matching ] — skip the orphaned [
                i++;
                continue;
            }
            // Has closing ], keep the whole segment
            pass1.push(str.slice(i, close + 1));
            i = close + 1;
        } else {
            pass1.push(str[i]);
            i++;
        }
    }

    // Pass 2: strip orphaned closing brackets
    const joined = pass1.join('');
    return joined.replace(/](?![^[]*\[)/g, (match, offset) => {
        // Check if there's a matching [ before this ]
        const before = joined.slice(0, offset);
        const lastOpen = before.lastIndexOf('[');
        if (lastOpen === -1) return ''; // No opener, strip it
        // Check if the opener was already consumed by an earlier ]
        const closeBetween = before.slice(lastOpen).indexOf(']');
        if (closeBetween !== -1) return ''; // Opener already matched
        return match; // Balanced, keep it
    });
};

export const cleanInlineText = (text) => {
    if (!text) return '';
    return stripOrphanBrackets(
        String(text)
            .replace(SPACED_CAPS_OCR_SEQUENCE_REGEX, normalizeSpacedCapsOcrPhrase)
            .replace(/\\r\\n/g, ' ')
            .replace(/\\n/g, ' ')
            .replace(/\r?\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\([#*_[\]()`>~-])/g, '$1')
            .replace(/\\+/g, ' ')
            .replace(/\*\*([^*\n]+)\*\*/g, '$1')
            .replace(/__([^_\n]+)__/g, '$1')
            .replace(/(^|[\s(])\*([^*\n]+)\*([\s).,!?]|$)/g, '$1$2$3')
            .replace(/(^|[\s(])_([^_\n]+)_([\s).,!?]|$)/g, '$1$2$3')
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
            .replace(/\[\s*([^\]]+?)\s*\]/g, '$1')
            .replace(/#{1,6}\s*/g, '')
            .replace(/`([^`]+)`/g, '$1')
            // Safari-safe markdown marker cleanup (avoids lookbehind syntax).
            .replace(/(^|[^a-zA-Z0-9])[*_]{2,}(?=[^a-zA-Z0-9]|$)/g, '$1 ')
            .replace(/(^|[^a-zA-Z0-9])`{1,3}(?=[^a-zA-Z0-9]|$)/g, '$1 ')
            .replace(/\*\*([^*]+)$/g, '$1')
            .replace(/^([^*]*)\*\*$/g, '$1')
            .replace(/\s*\*\s*$/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
    );
};

export const cleanDisplayLine = (text) =>
    cleanInlineText(text)
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/^[-•*]\s+/, '')
        .replace(/^>\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

// Escaped newlines and tabs from double-encoded JSON become real ones. A
// backslash followed by a lowercase letter is left alone, since that is LaTeX
// (\nabla, \neq, \theta, \times).
export const normalizeLessonContent = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/\\r\\n(?![a-z])/g, '\n')
        .replace(/\\n(?![a-z])/g, '\n')
        .replace(/\\t(?![a-z])/g, '    ')
        .replace(/\\"/g, '"')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
