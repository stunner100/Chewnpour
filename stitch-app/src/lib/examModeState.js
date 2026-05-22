export const resolveAutostartExamFormat = (search) => {
    const params = new URLSearchParams(String(search || ''));
    const raw = String(params.get('autostart') || '').trim().toLowerCase();
    if (raw === 'essay') return 'essay';
    if (raw === 'mcq' || raw === 'objective' || raw === 'quiz') return 'mcq';
    return null;
};

export const createInitialExamState = (search) => ({
    attemptId: null,
    attemptQualityTier: '',
    attemptQuestions: null,
    currentQuestion: 0,
    examFormat: resolveAutostartExamFormat(search),
    examStarted: false,
    gradingEssay: false,
    routingBootstrapPending: false,
    selectedAnswers: {},
    startExamError: '',
    startingExamAttempt: false,
    submitError: '',
});

export const examModeReducer = (state, action) => {
    switch (action.type) {
        case 'answerSelected':
            return {
                ...state,
                selectedAnswers: {
                    ...state.selectedAnswers,
                    [action.questionId]: action.answer,
                },
                submitError: '',
            };
        case 'beginPreparation':
            return {
                ...state,
                attemptId: null,
                attemptQualityTier: '',
                attemptQuestions: null,
                examStarted: false,
                startExamError: '',
                startingExamAttempt: true,
                submitError: '',
            };
        case 'chooseFormat':
            return {
                ...state,
                examFormat: action.examFormat,
                startExamError: '',
            };
        case 'clearStartAndFormat':
            return {
                ...state,
                examFormat: null,
                startExamError: '',
            };
        case 'finishPreparation':
            return {
                ...state,
                startingExamAttempt: false,
            };
        case 'moveQuestion':
            return {
                ...state,
                currentQuestion: Math.min(Math.max(action.index, 0), Math.max(action.maxIndex, 0)),
            };
        case 'patch':
            return {
                ...state,
                ...action.patch,
            };
        case 'preparationFailed':
            return {
                ...state,
                attemptId: null,
                attemptQuestions: null,
                examStarted: false,
                startExamError: action.message,
            };
        case 'preparationSucceeded':
            return {
                ...state,
                attemptId: action.attemptId,
                attemptQualityTier: action.qualityTier,
                attemptQuestions: action.questions,
                currentQuestion: 0,
                examStarted: true,
                selectedAnswers: {},
                startExamError: '',
            };
        case 'resetForRoute':
            return createInitialExamState(action.search);
        default:
            return state;
    }
};
