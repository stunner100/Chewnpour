export const EXAM_STEPS = {
    MISSING_TOPIC: 'missing_topic',
    LOADING_TOPIC: 'loading_topic',
    STALE_LINK: 'stale_link',
    FINAL_EXAM_LOADING: 'final_exam_loading',
    ROUTING_BOOTSTRAP: 'routing_bootstrap',
    FINAL_EXAM_REDIRECT: 'final_exam_redirect',
    FINAL_EXAM_UNAVAILABLE: 'final_exam_unavailable',
    CHOOSE_FORMAT: 'choose_format',
    PREPARATION: 'preparation',
    ACTIVE: 'active',
};

export const resolveExamStep = ({
    routeTopicId,
    isLoadingRouteTopic,
    isMissingRouteTopic,
    shouldRedirectToFinalExam,
    routedFinalAssessmentTopic,
    topicId,
    routingBootstrapPending,
    examFormat,
    examStarted,
    startingExamAttempt,
    hasAttemptQuestions,
    attemptId,
    questionCount,
}) => {
    if (!routeTopicId) return EXAM_STEPS.MISSING_TOPIC;
    if (isLoadingRouteTopic) return EXAM_STEPS.LOADING_TOPIC;
    if (isMissingRouteTopic) return EXAM_STEPS.STALE_LINK;

    if (shouldRedirectToFinalExam && routedFinalAssessmentTopic === undefined) {
        return EXAM_STEPS.FINAL_EXAM_LOADING;
    }
    if (routingBootstrapPending) return EXAM_STEPS.ROUTING_BOOTSTRAP;
    if (
        shouldRedirectToFinalExam
        && routedFinalAssessmentTopic?._id
        && routedFinalAssessmentTopic._id !== topicId
    ) {
        return EXAM_STEPS.FINAL_EXAM_REDIRECT;
    }
    if (shouldRedirectToFinalExam && !routedFinalAssessmentTopic?._id) {
        return EXAM_STEPS.FINAL_EXAM_UNAVAILABLE;
    }

    if (!examFormat && !examStarted && !startingExamAttempt && !hasAttemptQuestions) {
        return EXAM_STEPS.CHOOSE_FORMAT;
    }
    if (startingExamAttempt || !examStarted || !attemptId || questionCount === 0) {
        return EXAM_STEPS.PREPARATION;
    }

    return EXAM_STEPS.ACTIVE;
};
