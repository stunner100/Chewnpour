export const GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE = "ElevenLabs voice is unavailable right now.";

const CONVEX_SERVER_ERROR_PATTERN =
    /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*Server Error\s*Called by client/i;

const PERSISTENT_REMOTE_FAILURE_PATTERNS = [
    /payment_required/i,
    /detected_unusual_activity/i,
    /missing api key/i,
    /missing voice id/i,
    /invalid api key/i,
    /voice is not configured/i,
    /unauthorized/i,
    /forbidden/i,
];

export const normalizeRemotePlaybackErrorMessage = (error) => {
    const rawMessage = error instanceof Error ? error.message : String(error || "");
    const normalized = rawMessage.replace(/\s+/g, " ").trim();
    if (!normalized) return "";

    const withoutConvexWrapper = normalized.replace(CONVEX_SERVER_ERROR_PATTERN, "").trim();
    if (!withoutConvexWrapper) return GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE;

    if (CONVEX_SERVER_ERROR_PATTERN.test(normalized) && /^server error$/i.test(withoutConvexWrapper)) {
        return GENERIC_REMOTE_PLAYBACK_ERROR_MESSAGE;
    }

    return withoutConvexWrapper;
};

export const shouldDisableRemotePlaybackForSession = (message) => {
    const normalized = String(message || "").trim();
    if (!normalized) return false;
    return PERSISTENT_REMOTE_FAILURE_PATTERNS.some((pattern) => pattern.test(normalized));
};
