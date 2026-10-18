const DAY_MS = 24 * 60 * 60 * 1000;

// Review due dates are UTC calendar days (server/reviewSchedule.js).
export const formatReviewDay = (dueAtMs, now = Date.now()) => {
    if (dueAtMs == null || !Number.isFinite(Number(dueAtMs))) return '';
    const days = Math.floor(Number(dueAtMs) / DAY_MS) - Math.floor(now / DAY_MS);
    if (days <= 0) return 'today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
};

export const reviewCardCopy = (review, now = Date.now()) => {
    const dueCount = Number(review?.dueCount || 0);
    const upcomingCount = Number(review?.upcomingCount || 0);
    if (dueCount > 0) {
        return {
            state: 'due',
            heading: `${dueCount} question${dueCount === 1 ? '' : 's'} to review today`,
            hint: 'Questions you missed come back on a schedule, so they stick before your exam.',
        };
    }
    if (upcomingCount > 0) {
        return {
            state: 'upcoming',
            heading: 'All caught up',
            hint: `Next review ${formatReviewDay(review?.nextDueAt, now)}. ${upcomingCount} question${upcomingCount === 1 ? '' : 's'} scheduled.`,
        };
    }
    return { state: 'empty', heading: '', hint: '' };
};
