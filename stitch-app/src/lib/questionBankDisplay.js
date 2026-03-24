const formatGeneratedCount = (count, singular, plural = `${singular}s`) => {
    const normalizedCount = Math.max(0, Math.round(Number(count || 0)));
    const label = normalizedCount === 1 ? singular : plural;
    return `${normalizedCount} ${label}`;
};

export const formatReadyCount = (count, singular, plural = `${singular}s`) =>
    `${formatGeneratedCount(count, singular, plural)} ready`;

export const formatEssayQuizButtonLabel = ({ startingExam }) => {
    if (startingExam) return 'Preparing...';
    return 'Essay Quiz';
};

export const formatEssayPreparingMessage = (usableEssayCount) => {
    const readyCount = Math.max(0, Math.round(Number(usableEssayCount || 0)));
    if (readyCount > 0) {
        return `Essay questions will finish generating when you start the exam. ${formatReadyCount(readyCount, 'essay question')} so far.`;
    }
    return 'Essay questions will generate when you start the exam. The first run can take 10-20 seconds.';
};

export const formatQuestionBankProgressMessage = ({
    usableObjectiveCount,
    usableEssayCount,
    objectiveReady,
    examReady,
}) => {
    if (usableObjectiveCount <= 0 && usableEssayCount <= 0) {
        return 'Questions are generated when you start an exam. The first run usually takes 10-20 seconds.';
    }
    if (!objectiveReady) {
        return `${formatReadyCount(usableObjectiveCount, 'objective question')} and ${formatReadyCount(usableEssayCount, 'essay question')} so far. Missing questions will finish when you start an exam.`;
    }
    if (!examReady) {
        return `Objective ready. ${formatReadyCount(usableEssayCount, 'essay question')} so far. Missing essays will finish when you start the exam.`;
    }
    return '';
};
