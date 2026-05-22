import { authBaseUrl, getSession } from './auth-client';
import {
    getConvexErrorCode,
    isConvexAuthenticationError,
    isLikelyPostDisconnectAuthError,
    isTransientTransportError,
    resolveConvexActionError,
} from './convexClientErrors';

export const EXAM_DURATION_SECONDS = 45 * 60;
export const MIN_ESSAY_SUBMIT_CHAR_COUNT = 20;
export const START_EXAM_ATTEMPT_TIMEOUT_MS = 240_000;
export const EXAM_LOADING_STALL_TIMEOUT_MS = 270_000;

export const getExamAuthNotReadyMessage = (sessionRefreshed = false) =>
    sessionRefreshed
        ? 'Your session has been refreshed. Tap Retry to start the quiz.'
        : 'Your session is still syncing. Please wait a few seconds and tap Retry.';

export const getExamSessionExpiredMessage = () =>
    'Your session has expired. Please go back and sign in again.';

export const getExamTransientStartRetryMessage = () =>
    'Connection dropped while starting the quiz. Check your internet and tap Retry.';

export const getExamTransientSubmitRetryMessage = () =>
    'Connection dropped while submitting your quiz. Please retry once your connection is stable.';

export const refreshAuthSessionQuietly = async () => {
    try {
        const result = await getSession();
        const hasUser = Boolean(result?.data?.user?.id);
        return { refreshed: hasUser, expired: !hasUser };
    } catch {
        return { refreshed: false, expired: true };
    }
};

const waitForDuration = (durationMs) =>
    new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });

const readCachedConvexBrowserToken = () => {
    if (typeof window === 'undefined') return '';
    try {
        const raw = window.localStorage.getItem('better-auth_cookie');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        const cachedToken = parsed?.['better-auth.convex_jwt'];
        const token = typeof cachedToken?.value === 'string' ? cachedToken.value.trim() : '';
        if (!token) return '';
        const expiresAt = Date.parse(String(cachedToken?.expires || ''));
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            return '';
        }
        return token;
    } catch {
        return '';
    }
};

export const fetchConvexBrowserToken = async () => {
    const cachedToken = readCachedConvexBrowserToken();
    if (cachedToken) {
        return cachedToken;
    }

    const requestToken = async (attempt = 0) => {
        try {
            await getSession().catch(() => null);
            const refreshedCachedToken = readCachedConvexBrowserToken();
            if (refreshedCachedToken) {
                return refreshedCachedToken;
            }
            const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch Convex auth token (${response.status})`);
            }
            const payload = await response.json().catch(() => null);
            const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
            if (!token) {
                throw new Error('Session is still syncing.');
            }
            return token;
        } catch (error) {
            if (attempt >= 5) {
                throw error instanceof Error
                    ? error
                    : new Error('Session is still syncing.');
            }
            await waitForDuration(500 * (attempt + 1));
            return requestToken(attempt + 1);
        }
    };

    return requestToken();
};

export const withTimeout = (promise, timeoutMs, timeoutMessage) => {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    });
};

const isUserCorrectableEssaySubmitError = (message) => {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('restart the quiz') ||
        normalized.includes('essay mode') ||
        normalized.includes('could not grade your essay right now') ||
        normalized.includes('duplicate questions') ||
        normalized.includes('at least one question') ||
        normalized.includes('answer all essay questions')
    );
};

export const isRecoverableExamSubmitError = ({ error, message }) => {
    if (isUserCorrectableEssaySubmitError(message)) return true;
    if (isConvexAuthenticationError(error)) return true;
    if (isTransientTransportError(error, message)) return true;
    return false;
};

export const resolveExamStartError = async (error) => {
    const message = resolveConvexActionError(error, 'Unable to start the quiz. Please try again.');
    const authError = isConvexAuthenticationError(error);
    const transientTransportError = isTransientTransportError(error, message);
    const timedOut = /timed out/i.test(message);
    let nextStartExamError = 'Unable to start the quiz. Please try again.';

    if (authError) {
        const { refreshed, expired } = await refreshAuthSessionQuietly();
        if (expired) {
            nextStartExamError = getExamSessionExpiredMessage();
        } else {
            nextStartExamError = getExamAuthNotReadyMessage(refreshed);
        }
    } else if (transientTransportError) {
        nextStartExamError = getExamTransientStartRetryMessage();
    } else if (timedOut) {
        nextStartExamError = 'Quiz setup is taking longer than expected. Tap Retry.';
    } else if (isLikelyPostDisconnectAuthError(error)) {
        const { refreshed, expired } = await refreshAuthSessionQuietly();
        if (expired) {
            nextStartExamError = getExamSessionExpiredMessage();
        } else if (refreshed) {
            nextStartExamError = getExamAuthNotReadyMessage(true);
        } else {
            nextStartExamError = 'Something went wrong. Please wait a moment and tap Retry.';
        }
    }

    return {
        message,
        nextStartExamError,
        errorCode: getConvexErrorCode(error),
        authError,
        transientTransportError,
        timedOut,
        likelyPostDisconnect: isLikelyPostDisconnectAuthError(error),
        recoverableError: timedOut || authError || transientTransportError || isLikelyPostDisconnectAuthError(error),
    };
};

export const resolveExamSubmitError = async (error, fallbackMessage) => {
    const message = resolveConvexActionError(error, fallbackMessage);
    const authError = isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error);
    const transientTransportError = isTransientTransportError(error, message);
    let submitError = message;

    if (authError) {
        const { refreshed, expired } = await refreshAuthSessionQuietly();
        submitError = expired
            ? getExamSessionExpiredMessage()
            : getExamAuthNotReadyMessage(refreshed);
    } else if (transientTransportError) {
        submitError = getExamTransientSubmitRetryMessage();
    }

    return {
        message,
        submitError,
        authError,
        transientTransportError,
        recoverableError: authError || transientTransportError || isRecoverableExamSubmitError({ error, message }),
    };
};

export const countAnsweredQuestions = (questions, selectedAnswers, examFormat) => {
    if (examFormat === 'essay') {
        return questions.filter((question) => {
            const value = selectedAnswers[question._id];
            return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
        }).length;
    }
    return questions.filter((question) => Boolean(selectedAnswers[question._id])).length;
};

export const isQuestionAnswered = (question, selectedAnswers, examFormat) => {
    if (examFormat === 'essay') {
        return String(selectedAnswers[question._id] ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
    }
    return Boolean(selectedAnswers[question._id]);
};
