const CONVEX_ERROR_WRAPPER_PATTERN = /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*/i;

const TRANSIENT_TRANSPORT_ERROR_PATTERNS = [
    'load failed',
    'failed to fetch',
    'networkerror',
    'network request failed',
    'connection lost',
    'connection reset',
    'timed out',
    'timeout',
    'fetch failed',
    'inactive server',
];

export const resolveConvexActionError = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!resolved) return fallbackMessage;

    const unwrapped = resolved
        .replace(CONVEX_ERROR_WRAPPER_PATTERN, '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .replace(/^ConvexError:\s*/i, '')
        .replace(/^Server Error\s*/i, '')
        .replace(/Called by client$/i, '')
        .trim();

    return unwrapped || fallbackMessage;
};

/** Alias used by tutor/lesson surfaces. */
export const resolveConvexErrorMessage = resolveConvexActionError;

export const getConvexErrorCode = (error) => {
    if (typeof error?.data?.code === 'string' && error.data.code.trim()) {
        return error.data.code.trim().toUpperCase();
    }

    const rawMessage = String(error?.message || '').trim();
    if (rawMessage.includes('UPLOAD_QUOTA_EXCEEDED')) return 'UPLOAD_QUOTA_EXCEEDED';
    if (rawMessage.includes('AI_MESSAGE_QUOTA_EXCEEDED')) return 'AI_MESSAGE_QUOTA_EXCEEDED';

    const normalizedMessage = resolveConvexActionError(error, '').toLowerCase();
    if (!normalizedMessage) return '';

    if (normalizedMessage.includes('exam_questions_preparing')) return 'EXAM_QUESTIONS_PREPARING';
    if (normalizedMessage.includes('essay_questions_preparing')) return 'ESSAY_QUESTIONS_PREPARING';
    if (
        normalizedMessage.includes('must be signed in')
        || normalizedMessage.includes('not authenticated')
        || normalizedMessage.includes('invalid token')
        || normalizedMessage.includes('session is still syncing')
    ) {
        return 'UNAUTHENTICATED';
    }
    if (normalizedMessage.includes('do not have permission') || normalizedMessage.includes('permission')) {
        return 'UNAUTHORIZED';
    }

    return '';
};

export const isConvexAuthenticationError = (error) => {
    const code = getConvexErrorCode(error);
    if (code === 'UNAUTHENTICATED' || code === 'UNAUTHORIZED') return true;
    const normalizedMessage = resolveConvexActionError(error, '').toLowerCase();
    return (
        normalizedMessage.includes('must be signed in')
        || normalizedMessage.includes('not authenticated')
        || normalizedMessage.includes('invalid token')
        || normalizedMessage.includes('session is still syncing')
        || normalizedMessage.includes('permission')
    );
};

export const isLikelyPostDisconnectAuthError = (error) => {
    const message = String(error?.message || '').trim();
    if (!message) return false;
    if (/^server error$/i.test(message) || /^uncaught convexerror: server error/i.test(message)) {
        const code = getConvexErrorCode(error);
        return !code;
    }
    return false;
};

export const isTransientTransportError = (error, resolvedMessage = '') => {
    const normalizedMessage = `${String(error?.message || '').toLowerCase()} ${String(resolvedMessage || '').toLowerCase()}`;
    return TRANSIENT_TRANSPORT_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
};
