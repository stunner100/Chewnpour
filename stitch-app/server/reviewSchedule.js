// Leitner-style spacing for missed questions. Pure so it can be unit-tested.
// A miss puts the question in box 0, due tomorrow. Each correct answer on a
// due question moves it up one box; past the last box it graduates (dueAt
// null). Days are UTC calendar days, so "due" means "due any time today".
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 16, 35];

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfUtcDay = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;

// Exclusive upper bound for due_at: anything due before tomorrow is due now.
export const dueCutoff = (now = Date.now()) => startOfUtcDay(now) + DAY_MS;

export const isReviewDue = (dueAt, now = Date.now()) =>
    dueAt != null && Number(dueAt) < dueCutoff(now);

/**
 * @param previous {box, dueAt, lapses} | null — the stored row, dueAt in ms
 * @returns the next {box, dueAt, lapses}, or null when nothing should change
 */
export const nextReviewState = (previous, isCorrect, now = Date.now()) => {
    const lapses = Number(previous?.lapses || 0);
    if (!isCorrect) {
        return {
            box: 0,
            dueAt: startOfUtcDay(now) + REVIEW_INTERVAL_DAYS[0] * DAY_MS,
            lapses: lapses + 1,
        };
    }
    // Never missed, graduated, or answered again before it was due (e.g. an
    // immediate quiz retake): a correct answer here is not a spaced recall.
    if (!previous || !isReviewDue(previous.dueAt, now)) return null;

    const box = Number(previous.box || 0) + 1;
    if (box >= REVIEW_INTERVAL_DAYS.length) {
        return { box, dueAt: null, lapses };
    }
    return {
        box,
        dueAt: startOfUtcDay(now) + REVIEW_INTERVAL_DAYS[box] * DAY_MS,
        lapses,
    };
};
