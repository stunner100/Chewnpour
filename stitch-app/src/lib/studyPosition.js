const MAX_TITLE = 180;

export const normalizeStudyPosition = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const sectionCount = Number.isFinite(Number(raw.sectionCount))
        ? Math.max(0, Math.round(Number(raw.sectionCount)))
        : 0;
    const hasIndex = Number.isFinite(Number(raw.sectionIndex));
    const sectionTitle = String(raw.sectionTitle || '').trim().slice(0, MAX_TITLE);
    const finished = Boolean(raw.finished);
    if (sectionCount <= 0 && !hasIndex && !sectionTitle && !finished) return null;
    const sectionIndex = sectionCount > 0
        ? Math.min(Math.max(0, Math.round(Number(raw.sectionIndex || 0))), sectionCount - 1)
        : Math.max(0, Math.round(Number(raw.sectionIndex || 0)));
    return {
        sectionIndex,
        sectionCount,
        sectionTitle,
        finished,
    };
};

export const buildStudyContext = ({
    sectionIndex,
    sectionCount,
    sectionTitle,
    sectionExcerpt,
} = {}) => {
    const position = normalizeStudyPosition({
        sectionIndex,
        sectionCount,
        sectionTitle,
        finished: false,
    });
    const excerpt = String(sectionExcerpt || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (!position && !excerpt) return null;
    return {
        sectionIndex: position?.sectionIndex ?? 0,
        sectionCount: position?.sectionCount ?? 0,
        sectionTitle: position?.sectionTitle || '',
        sectionExcerpt: excerpt,
    };
};
