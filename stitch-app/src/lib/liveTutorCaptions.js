const captionWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

const SKIP_SEGMENT_PATTERN = /^(quick check|word bank|glossary|self-check|review questions)\b/i;

const countQuestionMarks = (text) => (String(text || '').match(/\?/g) || []).length;

const isQuestionSegment = (text) =>
    String(text || '').trim().endsWith('?') && !SKIP_SEGMENT_PATTERN.test(String(text || '').trim());

/**
 * Split a completed tutor utterance into per-question segments. Each segment
 * ends at a question mark; trailing recap text after the last question joins
 * the final segment. Sections like "Quick check" never count as questions.
 */
export const questionSegments = (text) => {
    const tokens = captionWords(text);
    const segments = [];
    let current = [];
    for (const token of tokens) {
        current.push(token);
        if (!token.endsWith('?')) continue;
        const segment = current.join(' ').trim();
        current = [];
        if (!isQuestionSegment(segment)) continue;
        segments.push(segment);
    }
    const rest = current.join(' ').trim();
    if (rest) {
        if (segments.length) segments[segments.length - 1] = `${segments[segments.length - 1]} ${rest}`;
        else if (!SKIP_SEGMENT_PATTERN.test(rest)) segments.push(rest);
    }
    return segments;
};

/**
 * 1-based question progress for a transcript. Tutor turns containing a
 * question mark mark an asked question; a following learner turn marks it
 * answered. Counts are clamped to the session total so the review UI can
 * render "Question n of total".
 */
export const questionProgress = (entries = [], total = 0) => {
    const cap = Math.max(0, Math.floor(Number(total) || 0));
    if (!cap) return null;
    let asked = 0;
    let answered = 0;
    let lastRole = null;
    for (const entry of Array.isArray(entries) ? entries : []) {
        if (entry?.role === 'assistant') {
            asked += countQuestionMarks(entry?.text);
        } else if (entry?.role === 'user' && lastRole === 'assistant') {
            answered += 1;
        }
        if (entry?.role) lastRole = entry.role;
    }
    asked = Math.min(cap, asked);
    answered = Math.min(cap, answered);
    if (!asked && !answered) return null;
    return {
        asked,
        answered,
        current: Math.min(cap, Math.max(asked, answered, 1)),
        total: cap,
    };
};

export const revealedCaption = (text, progress, previous = '') => {
    const words = captionWords(text);
    if (!words.length) return '';
    const ratio = Math.min(1, Math.max(0, Number(progress) || 0));
    if (ratio <= 0) return previous || '';
    const count = Math.min(
        words.length,
        Math.max(1, Math.round(ratio * words.length)),
    );
    const next = words.slice(0, count).join(' ');
    if (previous && previous.split(/\s+/).length > count) return previous;
    return next;
};
