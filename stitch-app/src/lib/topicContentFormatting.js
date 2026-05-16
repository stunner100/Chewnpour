export const LESSON_SECTION_TITLES = [
    'Simple Introduction',
    'Key Ideas in Plain English',
    'Key Ideas',
    'Step-by-Step Breakdown',
    'Worked Example',
    'Worked Examples',
    'Common Mistakes and Misconceptions',
    'Common Mistakes',
    'Everyday Analogy',
    'Everyday Analogies',
    'Practical Use Cases',
    'Practical Use',
    'Quick Glossary',
    'Summary',
    'Conclusion',
    'Self-check',
    'Self-Check Prompts',
    'Introduction',
    'Overview',
    'Key Takeaways',
    'Review Questions',
    'Word Bank',
    'Quick Check',
];

export const SECTION_TITLES_SET = new Set(
    LESSON_SECTION_TITLES.map((title) => title.toLowerCase())
);

const escapeRegex = (value) =>
    String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SECTION_TITLE_PATTERN = LESSON_SECTION_TITLES.map(escapeRegex).join('|');
const SECTION_TITLE_REGEX = new RegExp(`([.!?])\\s+(${SECTION_TITLE_PATTERN})\\b`, 'gi');
const INLINE_SECTION_REGEX = new RegExp(`([a-z])(${SECTION_TITLE_PATTERN})`, 'g');
const SPACED_CAPS_OCR_SEQUENCE_REGEX = /\b(?:[A-Z]\s+){5,}[A-Z]\b/g;
const SPACED_CAPS_OCR_TEST_REGEX = /\b(?:[A-Z]\s+){5,}[A-Z]\b/;
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

const isStructuredLine = (line) =>
    /^(#{1,6}\s+|[-*•]\s+|\d+[.)](?:\s+|$)|>\s+)/.test(String(line || '').trim());

const shouldMergeParagraphLines = (previousLine, currentLine) => {
    if (!previousLine || !currentLine) return false;
    const prev = String(previousLine).trim();
    const curr = String(currentLine).trim();
    if (!prev || !curr) return false;
    if (isStructuredLine(prev) || isStructuredLine(curr)) return false;
    if (/:$/.test(prev) && prev.length < 70) return false;
    if (/[.!?]"?$/.test(prev)) return false;
    if (/^topic\s*\d+[:.-]?/i.test(curr)) return false;
    // Don't merge pipe-delimited table rows
    if (/^\|.+\|$/.test(prev) || /^\|.+\|$/.test(curr)) return false;
    // Don't merge if current line is a known section title
    const currTitle = curr.replace(/:$/, '').toLowerCase();
    if (SECTION_TITLES_SET.has(currTitle)) return false;
    return true;
};

export const isArtifactLine = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return true;

    const deEscaped = raw
        .replace(/^\\+/, '')
        .replace(/\\+/g, '')
        .trim();

    if (!deEscaped) return true;
    if (/^['"`]+$/.test(deEscaped)) return true;
    if (/^(?:[-–—•*#|`])+$/u.test(deEscaped)) return true;
    if (/^>\s*[-–—•*#|`]*$/u.test(deEscaped)) return true;
    if (/^(?:\d+[.)]\s*)?(?:[-–—•*#|`])+$/u.test(deEscaped)) return true;
    return false;
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

const LOW_SIGNAL_LESSON_LINE_PATTERNS = [
    /\bthe correct answer comes from following the steps in order\b/i,
    /\baccording to the source,\s*what is reported for\b/i,
    /\bwhat is reported for\b/i,
    /\bwhat does the source say about\b/i,
    /\bthe answer can be found by checking the source\b/i,
    /\bfollowing the topic rules\b/i,
];

export const isLowSignalLessonLine = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return true;

    const cleaned = cleanDisplayLine(raw);
    if (!cleaned) return true;

    const comparable = `${raw} ${cleaned}`.replace(/\s+/g, ' ').trim();
    if (LOW_SIGNAL_LESSON_LINE_PATTERNS.some((pattern) => pattern.test(comparable))) {
        return true;
    }

    if (SPACED_CAPS_OCR_TEST_REGEX.test(raw) && SPACED_CAPS_OCR_TEST_REGEX.test(cleaned)) {
        return true;
    }

    return false;
};

export const slugifyText = (text, suffix = '') =>
    cleanDisplayLine(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') + (suffix ? `-${suffix}` : '');

export const normalizeLessonContent = (text) => {
    if (!text || typeof text !== 'string') return '';

    const normalizedBase = String(text)
        .replace(/\u00a0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' ')
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(SPACED_CAPS_OCR_SEQUENCE_REGEX, normalizeSpacedCapsOcrPhrase)
        .replace(/\\\\([#*_[\]()`>~-])/g, '$1')
        .replace(/\\(?=\s)/g, '')
        .replace(/"\s*>\s*"/g, '\n')
        .replace(/"\s*>\s*/g, '\n')
        .replace(/\s*>\s*"/g, '\n')
        .replace(/>\s*(?=[A-Za-z])/g, '\n> ')
        .replace(/\n>\s*/g, '\n> ')
        .replace(/([^\n])(#{1,6}\s+)/g, '$1\n\n$2')
        .replace(SECTION_TITLE_REGEX, '$1\n\n### $2')
        .replace(INLINE_SECTION_REGEX, '$1\n\n### $2')
        .replace(/([.!?:,])\s*(Step\s+\d+\s*:)/gi, '$1\n\n### $2')
        .replace(/([.?!])\s+(?=(?:\d+\.\s+[A-Z]|[A-Z][A-Za-z]+:\s))/g, '$1\n\n')
        .replace(/\s+(- \*\*)/g, '\n\n$1')
        .replace(/\s+(\*\*[^*]+\*\*\s*:)/g, '\n\n$1')
        .replace(/([.?!])\s+(\*\*)/g, '$1\n\n$2')
        .replace(/([a-z])\s+-\s+([A-Z])/g, '$1\n\n- $2')
        .replace(/\s+-\s+([A-Z])/g, '\n\n- $1');

    const compactLines = [];
    for (const sourceLine of normalizedBase.split('\n')) {
        const line = stripOrphanBrackets(
            String(sourceLine || '')
                .replace(/^\\+/, '')
                .replace(/\s*\\\s*/g, ' ')
                .replace(/^(\d+)\)\s+/, '$1. ')
                .replace(/\s{2,}/g, ' ')
                .trim()
        );

        if (!line) {
            if (compactLines.length > 0 && compactLines[compactLines.length - 1] !== '') {
                compactLines.push('');
            }
            continue;
        }

        // Drop marker-only leftovers from malformed markdown that create fake empty blocks.
        if (isArtifactLine(line)) continue;
        if (isLowSignalLessonLine(line)) continue;

        if (/^(dr|mr|mrs|ms|prof)\.?$/i.test(line)) continue;
        if (/@/.test(line) && line.length < 140) continue;
        compactLines.push(line);
    }

    const splitTrailingMarkers = [];
    for (const line of compactLines) {
        if (!line) {
            if (splitTrailingMarkers.length > 0 && splitTrailingMarkers[splitTrailingMarkers.length - 1] !== '') {
                splitTrailingMarkers.push('');
            }
            continue;
        }

        const trailingMarker = line.match(/^(.+?)\s+(\d+)[.)]$/);
        if (trailingMarker) {
            const itemText = trailingMarker[1].trim();
            if (itemText) {
                splitTrailingMarkers.push(itemText);
            }
            splitTrailingMarkers.push(`${trailingMarker[2]}.`);
            continue;
        }

        splitTrailingMarkers.push(line);
    }

    const findNextNonEmptyIndex = (lines, startIndex) => {
        for (let index = startIndex; index < lines.length; index += 1) {
            if (String(lines[index] || '').trim()) return index;
        }
        return -1;
    };

    const repairedListLines = [];
    for (let index = 0; index < splitTrailingMarkers.length; index += 1) {
        const line = splitTrailingMarkers[index];
        if (!line) {
            if (repairedListLines.length > 0 && repairedListLines[repairedListLines.length - 1] !== '') {
                repairedListLines.push('');
            }
            continue;
        }

        const orphanMarker = line.match(/^(\d+)[.)]$/);
        if (orphanMarker) {
            const nextIndex = findNextNonEmptyIndex(splitTrailingMarkers, index + 1);
            if (nextIndex !== -1) {
                const nextLine = String(splitTrailingMarkers[nextIndex] || '').trim();
                const nextLineIsContent = nextLine
                    && !/^\d+[.)]$/.test(nextLine)
                    && !/^[-•*]\s+/.test(nextLine)
                    && !/^>/.test(nextLine);
                if (nextLineIsContent) {
                    repairedListLines.push(`${orphanMarker[1]}. ${nextLine}`);
                    index = nextIndex;
                    continue;
                }
            }
        }

        repairedListLines.push(line);
    }

    const mergedLines = [];
    for (const line of repairedListLines) {
        if (!line) {
            if (mergedLines.length > 0 && mergedLines[mergedLines.length - 1] !== '') {
                mergedLines.push('');
            }
            continue;
        }

        const previous = mergedLines[mergedLines.length - 1];
        if (shouldMergeParagraphLines(previous, line)) {
            mergedLines[mergedLines.length - 1] = `${previous} ${line}`
                .replace(/\s{2,}/g, ' ')
                .trim();
            continue;
        }
        mergedLines.push(line);
    }

    return mergedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
