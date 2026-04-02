const EXAM_PREPARATION_PROFILES = {
    mcq: {
        estimateSeconds: 38,
        helperLabel: 'Objective exams are usually ready in 25-45 seconds.',
        stages: {
            queued: { progressFloor: 8, maxRemainingSeconds: 30, detailLabel: 'Queueing your objective exam request.' },
            checking_previous_attempt: { progressFloor: 16, maxRemainingSeconds: 26, detailLabel: 'Checking for an unfinished objective exam we can safely reuse.' },
            building_assessment_plan: { progressFloor: 30, maxRemainingSeconds: 20, detailLabel: 'Mapping the topic into a balanced objective quiz plan.' },
            generating_candidates: { progressFloor: 58, maxRemainingSeconds: 14, detailLabel: 'Generating grounded objective questions from your lesson.' },
            reviewing_quality: { progressFloor: 80, maxRemainingSeconds: 8, detailLabel: 'Filtering weak questions and keeping the strongest set.' },
            finalizing_attempt: { progressFloor: 92, maxRemainingSeconds: 4, detailLabel: 'Locking the final question set and opening the attempt.' },
        },
    },
    essay: {
        estimateSeconds: 30,
        helperLabel: 'Essay exams are usually ready in 20-35 seconds.',
        stages: {
            queued: { progressFloor: 10, maxRemainingSeconds: 24, detailLabel: 'Queueing your essay exam request.' },
            checking_previous_attempt: { progressFloor: 18, maxRemainingSeconds: 20, detailLabel: 'Checking for an unfinished essay attempt we can reuse.' },
            building_assessment_plan: { progressFloor: 34, maxRemainingSeconds: 16, detailLabel: 'Outlining the essay prompts and target coverage.' },
            generating_candidates: { progressFloor: 62, maxRemainingSeconds: 10, detailLabel: 'Generating grounded essay prompts from your lesson.' },
            reviewing_quality: { progressFloor: 82, maxRemainingSeconds: 6, detailLabel: 'Reviewing the prompts for clarity and coverage.' },
            finalizing_attempt: { progressFloor: 94, maxRemainingSeconds: 3, detailLabel: 'Packaging the final essay set and opening the attempt.' },
        },
    },
};

const DEFAULT_STAGE = 'queued';
const PROGRESS_MIN = 8;
const PROGRESS_MAX = 96;

const resolveExamPreparationProfile = (examFormat) =>
    EXAM_PREPARATION_PROFILES[String(examFormat || '').trim().toLowerCase()] || EXAM_PREPARATION_PROFILES.mcq;

export const getExamPreparationLoadingState = ({
    examFormat = 'mcq',
    stage = DEFAULT_STAGE,
    elapsedMs = 0,
} = {}) => {
    const profile = resolveExamPreparationProfile(examFormat);
    const normalizedStage = String(stage || DEFAULT_STAGE).trim().toLowerCase() || DEFAULT_STAGE;
    const stageProfile = profile.stages[normalizedStage] || profile.stages[DEFAULT_STAGE];
    const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
    const elapsedSeconds = safeElapsedMs / 1000;
    const baseRemainingSeconds = Math.max(0, Math.ceil(profile.estimateSeconds - elapsedSeconds));
    const boundedRemainingSeconds = Math.min(baseRemainingSeconds, stageProfile.maxRemainingSeconds);

    const progressFromElapsed = Math.min(
        PROGRESS_MAX,
        Math.max(
            PROGRESS_MIN,
            Math.round(PROGRESS_MIN + (Math.min(1, elapsedSeconds / profile.estimateSeconds) * (PROGRESS_MAX - PROGRESS_MIN))),
        ),
    );
    const progressPercent = Math.max(stageProfile.progressFloor, progressFromElapsed);

    let etaLabel = boundedRemainingSeconds > 1 ? `About ${boundedRemainingSeconds}s left` : 'Almost there';
    if (elapsedSeconds > profile.estimateSeconds + 8) {
        etaLabel = 'Taking longer than usual, still preparing';
    }

    return {
        progressPercent,
        etaLabel,
        detailLabel: stageProfile.detailLabel,
        helperLabel: profile.helperLabel,
    };
};
