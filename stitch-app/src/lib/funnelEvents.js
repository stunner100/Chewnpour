import { capturePostHogEvent } from './posthog';

// Activation funnel: signup → upload (upload_flow_completed, see
// uploadObservability) → lesson → quiz/exam → spaced review.
export const FUNNEL_EVENTS = {
    signupCompleted: 'signup_completed',
    lessonCompleted: 'lesson_completed',
    quizSubmitted: 'quiz_submitted',
    examSubmitted: 'exam_submitted',
    reviewAnswered: 'review_answered',
    reviewSessionCompleted: 'review_session_completed',
    courseShared: 'course_shared',
    examDateSet: 'exam_date_set',
};

const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;
const signupTrackedKey = (userId) => `cp_signup_tracked_${userId}`;

export const trackFunnelEvent = (eventName, properties = {}) => {
    capturePostHogEvent(eventName, properties);
};

// Covers email and Google sign-up alike: a session for an account created in
// the last few minutes is a new sign-up. The storage flag keeps reloads from
// counting it twice.
export const trackSignupIfNew = (sessionUser, now = Date.now()) => {
    const userId = sessionUser?.id;
    const createdAt = new Date(sessionUser?.createdAt || 0).getTime();
    if (!userId || !Number.isFinite(createdAt) || createdAt <= 0) return false;
    if (now - createdAt > NEW_ACCOUNT_WINDOW_MS) return false;
    try {
        if (window.localStorage.getItem(signupTrackedKey(userId))) return false;
        window.localStorage.setItem(signupTrackedKey(userId), '1');
    } catch {
        // Storage blocked: still record the sign-up once for this page load.
    }
    trackFunnelEvent(FUNNEL_EVENTS.signupCompleted);
    return true;
};
