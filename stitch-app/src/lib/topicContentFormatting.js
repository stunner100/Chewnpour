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

const isStructuredLine = (line) =>
    /^(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|>\s+)/.test(String(line || '').trim());

const shouldMergeParagraphLines = (previousLine, currentLine) => {
    if (!previousLine || !currentLine) return false;
    const prev = String(previousLine).trim();
    const curr = String(currentLine).trim();
    if (!prev || !curr) return false;
    if (isStructuredLine(prev) || isStructuredLine(curr)) return false;
    if (/:$/.test(prev) && prev.length < 70) return false;
    if (/[.!?]"?$/.test(prev)) return false;
    if (/^topic\s*\d+[:.-]?/i.test(curr)) return false;
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

export const cleanInlineText = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/\\r\\n/g, ' ')
        .replace(/\\n/g, ' ')
        .replace(/\r?\n/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\([#*_[\]()`>~-])/g, '$1')
        .replace(/\\+/g, ' ')
        .replace(/(^|[\s(])\*([^*\n]+)\*([\s).,!?]|$)/g, '$1$2$3')
        .replace(/(^|[\s(])_([^_\n]+)_([\s).,!?]|$)/g, '$1$2$3')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\[\s*([^\]]+?)\s*\]/g, '$1')
        .replace(/#{1,6}\s*/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s*[*_`|]+\s*/g, (match) => (/^\s*$/.test(match) ? match : ' '))
        .replace(/\s{2,}/g, ' ')
        .trim();
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
        .replace(/\\([#*_[\]()`>~-])/g, '$1')
        .replace(/\\(?=\d+[.)])/g, '')
        .replace(/\\(?=[A-Za-z])/g, '')
        .replace(/\\+/g, ' ')
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
        const line = String(sourceLine || '')
            .replace(/^\\+/, '')
            .replace(/\s*\\\s*/g, ' ')
            .replace(/^(\d+)\)\s+/, '$1. ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (!line) {
            if (compactLines.length > 0 && compactLines[compactLines.length - 1] !== '') {
                compactLines.push('');
            }
            continue;
        }

        // Drop marker-only leftovers from malformed markdown that create fake empty blocks.
        if (isArtifactLine(line)) continue;

        if (/^(dr|mr|mrs|ms|prof)\.?$/i.test(line)) continue;
        if (/@/.test(line) && line.length < 140) continue;
        compactLines.push(line);
    }

    const mergedLines = [];
    for (const line of compactLines) {
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
