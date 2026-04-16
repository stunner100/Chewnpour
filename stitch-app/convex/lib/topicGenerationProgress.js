export const clampGeneratedTopicCount = ({ generatedTopicCount, totalTopics }) => {
    const safeTotal = Math.max(0, Number(totalTopics || 0));
    if (safeTotal === 0) return 0;
    const rawGenerated = Number(generatedTopicCount || 0);
    return Number.isFinite(rawGenerated)
        ? Math.min(Math.max(rawGenerated, 0), safeTotal)
        : 0;
};

export const normalizeGeneratedTopicCount = ({ generatedTopicCount, totalTopics }) => {
    const clamped = clampGeneratedTopicCount({ generatedTopicCount, totalTopics });
    if (clamped === 0 && Math.max(0, Number(totalTopics || 0)) === 0) {
        return 0;
    }
    return Math.max(clamped, 1);
};

export const calculateRemainingTopicProgress = ({ generatedTopicCount, totalTopics }) => {
    const safeTotal = Math.max(1, Number(totalTopics || 1));
    const safeGenerated = normalizeGeneratedTopicCount({
        generatedTopicCount,
        totalTopics: safeTotal,
    });
    if (safeTotal <= 1) return 60;
    if (safeGenerated <= 1) return 60;
    return 60 + Math.floor(((safeGenerated - 1) / (safeTotal - 1)) * 25);
};
