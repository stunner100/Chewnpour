export const STUDY_POSITION_KEY = "__studyPosition";

const MAX_TITLE = 180;

const toCount = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
};

const toIndex = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
};

/**
 * Persistable lesson cursor. Derived at read time from the existing
 * markdown sections — this is not a new lesson-section table.
 */
export const normalizeStudyPosition = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const sectionCount = toCount(raw.sectionCount);
    const hasIndex = Number.isFinite(Number(raw.sectionIndex));
    const sectionTitle = String(raw.sectionTitle || "").trim().slice(0, MAX_TITLE);
    const finished = Boolean(raw.finished);

    if (sectionCount <= 0 && !hasIndex && !sectionTitle && !finished) {
        return null;
    }

    const sectionIndex = sectionCount > 0
        ? Math.min(toIndex(raw.sectionIndex), sectionCount - 1)
        : toIndex(raw.sectionIndex);

    return {
        sectionIndex,
        sectionCount,
        sectionTitle,
        finished,
    };
};

export const studyPositionPercent = (position, completedAt) => {
    if (completedAt || position?.finished) return 100;
    const count = Number(position?.sectionCount || 0);
    if (count <= 0) return null;
    const index = Math.min(Number(position.sectionIndex || 0), count - 1);
    const raw = Math.round(((index + 1) / count) * 100);
    return Math.max(0, Math.min(99, raw));
};

export const splitLessonChecks = (raw) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
    const studyPosition = normalizeStudyPosition(source[STUDY_POSITION_KEY]);
    delete source[STUDY_POSITION_KEY];
    return {
        lessonChecks: source,
        studyPosition,
    };
};

export const mergeStudyPositionIntoChecks = (lessonChecks, studyPosition) => {
    const next = lessonChecks && typeof lessonChecks === "object" && !Array.isArray(lessonChecks)
        ? { ...lessonChecks }
        : {};
    delete next[STUDY_POSITION_KEY];
    const normalized = normalizeStudyPosition(studyPosition);
    if (normalized) next[STUDY_POSITION_KEY] = normalized;
    return next;
};

export const lessonCheckCount = (lessonChecks) => {
    if (!lessonChecks || typeof lessonChecks !== "object" || Array.isArray(lessonChecks)) {
        return 0;
    }
    return Object.keys(lessonChecks).filter((key) => key !== STUDY_POSITION_KEY).length;
};
