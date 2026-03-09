const CONVEX_ID_PATTERN = /^[a-z0-9]{32}$/;

export const isLikelyConvexId = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    return CONVEX_ID_PATTERN.test(normalized);
};
