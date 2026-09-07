export const GENERATION_STAGES = [
    { id: 'uploading', label: 'Uploading' },
    { id: 'extracting', label: 'Extracting content' },
    { id: 'structuring', label: 'Structuring course' },
    { id: 'lessons', label: 'Creating lessons' },
    { id: 'quizzes', label: 'Generating quizzes' },
    { id: 'ready', label: 'Ready' },
];

const EXTRACTION_STEPS = new Set(['extracting', 'ocr', 'transcribing']);

export const resolveGenerationStageIndex = ({
    status,
    extractionStatus,
    processingStep,
    topicCount = 0,
    quizzesReady = 0,
    studyReady = false,
} = {}) => {
    const normalizedStatus = String(status || '').toLowerCase();
    const extraction = String(extractionStatus || '').toLowerCase();
    const step = String(processingStep || '').toLowerCase();
    const topics = Math.max(0, Number(topicCount) || 0);
    const quizzes = Math.max(0, Number(quizzesReady) || 0);

    if (normalizedStatus === 'error' || extraction === 'failed' || step.includes('fail')) {
        return -1;
    }
    if (studyReady || (normalizedStatus === 'ready' && extraction === 'complete' && topics > 0 && quizzes > 0)) {
        return 5;
    }
    if (topics > 0 && quizzes === 0) return 4;
    if (topics > 0) return 3;
    if (normalizedStatus === 'ready' && extraction === 'complete') return 2;
    if (
        normalizedStatus === 'extracting'
        || extraction === 'running'
        || EXTRACTION_STEPS.has(step)
    ) {
        return 1;
    }
    if (step === 'ready' && topics === 0) return 2;
    return 0;
};

export const describeGenerationStage = (index) => {
    if (index < 0) return 'Could not finish this upload.';
    return GENERATION_STAGES[index]?.label || 'Processing';
};
