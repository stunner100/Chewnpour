const captionWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

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
