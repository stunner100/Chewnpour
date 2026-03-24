const formatGeneratedCount = (count, singular, plural = `${singular}s`) => {
    const normalizedCount = Math.max(0, Math.round(Number(count || 0)));
    const label = normalizedCount === 1 ? singular : plural;
    return `${normalizedCount} ${label}`;
};

export const formatReadyCount = (count, singular, plural = `${singular}s`) =>
    `${formatGeneratedCount(count, singular, plural)} ready`;

export const formatEssayQuizButtonLabel = ({ startingExam, essayReady, usableEssayCount }) => {
    if (startingExam) return 'Preparing...';
    if (essayReady) return 'Essay Quiz';
    return `Essay (${Math.max(0, Math.round(Number(usableEssayCount || 0)))} ready)`;
};

export const formatEssayPreparingMessage = (usableEssayCount) =>
    `Essay questions are still preparing. ${formatReadyCount(usableEssayCount, 'essay question')} so far. Please check back in a moment.`;

export const formatQuestionBankProgressMessage = ({
    usableObjectiveCount,
    usableEssayCount,
    objectiveReady,
    examReady,
}) => {
    if (!objectiveReady) {
        return `${formatReadyCount(usableObjectiveCount, 'objective question')} and ${formatReadyCount(usableEssayCount, 'essay question')} so far.`;
    }
    if (!examReady) {
        return `Objective ready. ${formatReadyCount(usableEssayCount, 'essay question')} so far.`;
    }
    return '';
};
