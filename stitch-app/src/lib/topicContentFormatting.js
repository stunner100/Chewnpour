// Display-text helpers for single lines (titles, source passages) and the
// light cleanup applied to stored lesson markdown before it is parsed.
// Lesson structure is never rewritten here: the markdown parser reads it as is.
// OCR noise is removed when text is extracted (server/extractionQuality.js).

export const cleanInlineText = (text) => {
    if (!text) return '';
    return String(text)
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
