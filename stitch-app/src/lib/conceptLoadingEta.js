const FRESH_SESSION_ESTIMATE_SECONDS = 28;
const REVIEW_SESSION_ESTIMATE_SECONDS = 18;
const PROGRESS_FLOOR_PERCENT = 10;
const PROGRESS_CEILING_PERCENT = 96;

const buildStepStatus = (index, activeIndex) => {
    if (index < activeIndex) return 'complete';
    if (index === activeIndex) return 'active';
    return 'upcoming';
};

export const getConceptSessionLoadingState = ({
    elapsedMs = 0,
    focusedReview = false,
} = {}) => {
    const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
    const estimateSeconds = focusedReview
        ? REVIEW_SESSION_ESTIMATE_SECONDS
        : FRESH_SESSION_ESTIMATE_SECONDS;
    const elapsedSeconds = safeElapsedMs / 1000;
    const remainingSeconds = Math.max(0, Math.ceil(estimateSeconds - elapsedSeconds));
    const progressRatio = Math.min(1, elapsedSeconds / estimateSeconds);
    const progressPercent = Math.min(
        PROGRESS_CEILING_PERCENT,
        Math.max(
            PROGRESS_FLOOR_PERCENT,
            Math.round(
                PROGRESS_FLOOR_PERCENT
                + progressRatio * (PROGRESS_CEILING_PERCENT - PROGRESS_FLOOR_PERCENT)
            ),
        ),
    );

    let activeStepIndex = 0;
    let stageLabel = focusedReview ? 'Revisiting weak concepts' : 'Grounding your source';
    let detailLabel = focusedReview
        ? 'Pulling your weakest concept keys so the next set stays focused.'
        : 'Pulling the strongest evidence before we build your practice set.';

    if (elapsedSeconds >= estimateSeconds * 0.33) {
        activeStepIndex = 1;
        stageLabel = 'Drafting concept checks';
        detailLabel = focusedReview
            ? 'Refreshing the best prompts for your review queue.'
            : 'Mixing recall, matching, and misconception prompts for this topic.';
    }

    if (elapsedSeconds >= estimateSeconds * 0.7) {
        activeStepIndex = 2;
        stageLabel = 'Assembling your session';
        detailLabel = focusedReview
            ? 'Balancing the final review set before we open it.'
            : 'Balancing the final five items and preparing your practice session.';
    }

    let etaLabel = remainingSeconds > 1 ? `About ${remainingSeconds}s left` : 'Almost there';
    if (elapsedSeconds > estimateSeconds + 8) {
        etaLabel = 'Taking longer than usual, still generating';
    }

    return {
        estimateSeconds,
        progressPercent,
        etaLabel,
        stageLabel,
        detailLabel,
        helperLabel: focusedReview
            ? 'Focused review sessions are usually ready in 10-20 seconds.'
            : 'Fresh concept sessions are usually ready in 20-30 seconds.',
        steps: [
            {
                label: focusedReview ? 'Find weak concepts' : 'Ground evidence',
                status: buildStepStatus(0, activeStepIndex),
            },
            {
                label: focusedReview ? 'Refresh prompts' : 'Draft prompts',
                status: buildStepStatus(1, activeStepIndex),
            },
            {
                label: 'Build session',
                status: buildStepStatus(2, activeStepIndex),
            },
        ],
    };
};
