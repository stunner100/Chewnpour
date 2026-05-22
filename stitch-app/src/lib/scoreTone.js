export const getScoreTone = (score) => {
    const value = Number(score);
    if (!Number.isFinite(value)) {
        return { textClass: 'text-error', barClass: 'bg-error' };
    }
    if (value >= 80) {
        return { textClass: 'text-success', barClass: 'bg-success' };
    }
    if (value >= 60) {
        return { textClass: 'text-warning', barClass: 'bg-warning' };
    }
    return { textClass: 'text-error', barClass: 'bg-error' };
};
