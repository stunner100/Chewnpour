import { EXAM_STEPS, resolveExamStep } from '../src/lib/resolveExamStep.js';

const baseInput = {
    routeTopicId: 'topic_123',
    isLoadingRouteTopic: false,
    isMissingRouteTopic: false,
    shouldRedirectToFinalExam: false,
    routedFinalAssessmentTopic: null,
    topicId: 'topic_123',
    routingBootstrapPending: false,
    examFormat: 'mcq',
    examStarted: true,
    startingExamAttempt: false,
    hasAttemptQuestions: true,
    attemptId: 'attempt_1',
    questionCount: 5,
};

const assertStep = (label, input, expected) => {
    const actual = resolveExamStep({ ...baseInput, ...input });
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
};

assertStep('missing topic', { routeTopicId: '' }, EXAM_STEPS.MISSING_TOPIC);
assertStep('loading topic', { isLoadingRouteTopic: true }, EXAM_STEPS.LOADING_TOPIC);
assertStep('stale link', { isMissingRouteTopic: true }, EXAM_STEPS.STALE_LINK);
assertStep(
    'final exam loading',
    { shouldRedirectToFinalExam: true, routedFinalAssessmentTopic: undefined },
    EXAM_STEPS.FINAL_EXAM_LOADING,
);
assertStep(
    'routing bootstrap',
    { routingBootstrapPending: true },
    EXAM_STEPS.ROUTING_BOOTSTRAP,
);
assertStep(
    'final exam redirect',
    {
        shouldRedirectToFinalExam: true,
        routedFinalAssessmentTopic: { _id: 'final_topic' },
        topicId: 'topic_123',
    },
    EXAM_STEPS.FINAL_EXAM_REDIRECT,
);
assertStep(
    'final exam unavailable',
    {
        shouldRedirectToFinalExam: true,
        routedFinalAssessmentTopic: null,
    },
    EXAM_STEPS.FINAL_EXAM_UNAVAILABLE,
);
assertStep(
    'choose format',
    {
        examFormat: null,
        examStarted: false,
        startingExamAttempt: false,
        hasAttemptQuestions: false,
        attemptId: null,
        questionCount: 0,
    },
    EXAM_STEPS.CHOOSE_FORMAT,
);
assertStep(
    'preparation',
    {
        examFormat: 'mcq',
        examStarted: false,
        startingExamAttempt: true,
        attemptId: null,
        questionCount: 0,
    },
    EXAM_STEPS.PREPARATION,
);
assertStep('active exam', {}, EXAM_STEPS.ACTIVE);

console.log('exam-step-regression.test.mjs passed');
