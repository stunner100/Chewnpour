export const EXAM_PREWARM_MIN_QUESTION_COUNT = 30;

export const shouldPrewarmExamQuestions = ({
    topicId,
    topicData,
    questionCount,
    alreadyTriggered,
    minQuestionCount = EXAM_PREWARM_MIN_QUESTION_COUNT,
}) => {
    if (!topicId) return false;
    if (topicData === undefined || topicData === null) return false;
    if (alreadyTriggered) return false;

    const count = Number(questionCount || 0);
    return count < Number(minQuestionCount || EXAM_PREWARM_MIN_QUESTION_COUNT);
};
