const CHUNK_RECOVERY_TS_KEY_PREFIX = '__chunk_recovery_reload_ts:';
const CHUNK_RECOVERY_WINDOW_MS = 30_000;
const CONVEX_SERVER_ERROR_SIGNATURE_PATTERN =
    /\[convex\s+[aqm]\([^)]+\)\]\s*\[request id:[^\]]+\]\s*server error(?:\s*called by client)?/i;
const STALE_CONVEX_CALL_SIGNATURES = [
    /concepts:getUserConceptAttempts/i,
    /subscriptions:getUploadQuotaStatus/i,
    /subscriptions:getPublicTopUpPricing/i,
    /subscriptions:getVoiceGenerationQuotaStatus/i,
    /topics:getTopicWithQuestions/i,
];
const STALE_TOPIC_ROUTE_CALL_SIGNATURES = [
    /topics:getTopicWithQuestions/i,
    /topics:getUserTopicProgress/i,
    /topics:getTopicSourcePassages/i,
    /topicNotes:getNote/i,
    /topicChat:getMessages/i,
    /tutor:getTopicTutorSupport/i,
    /videos:listTopicVideos/i,
    /podcasts:listTopicPodcasts/i,
    /concepts:getConceptMasteryForTopic/i,
];
const STALE_TOPIC_ROUTE_VALIDATION_PATTERN =
    /ArgumentValidationError|validator\s+`?v\.id\("topics"\)`?|does not match the table name in validator/i;
const STALE_TOPIC_ROUTE_FOUND_ID_PATTERN =
    /Found ID\s+"?[a-z0-9]{32}"?\s+from table\s+`[^`]+`/i;
const STALE_TOPIC_ROUTE_PATH_PATTERN =
    /^\/dashboard\/(?:exam|topic|concept-intro|concept)(?:\/|$)/i;
const STALE_EXAM_ROUTE_REFERENCE_PATTERNS = [
    /referenceerror:\s*routedfinalassessmenttopic\s+is\s+not\s+defined/i,
];

const getErrorMessage = (errorLike) => {
    if (!errorLike) return '';
    if (typeof errorLike === 'string') return errorLike;
    if (typeof errorLike.message === 'string') return errorLike.message;
    if (typeof errorLike.error?.message === 'string') return errorLike.error.message;
    return String(errorLike);
};

const normalizeMessage = (errorLike) =>
    getErrorMessage(errorLike)
        .replace(/\s+/g, ' ')
        .trim();

export const isChunkLoadError = (errorLike) => {
    const message = normalizeMessage(errorLike).toLowerCase();
    return (
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('importing a module script failed') ||
        message.includes('chunkloaderror') ||
        message.includes('loading chunk') ||
        message.includes('_result.default') ||
        message.includes("reading 'default'") ||
        message.includes('expected the result of a dynamic import() call')
    );
};

export const isStaleConvexClientError = (errorLike) => {
    const message = normalizeMessage(errorLike);
    if (!message) return false;
    if (!CONVEX_SERVER_ERROR_SIGNATURE_PATTERN.test(message)) return false;
    return STALE_CONVEX_CALL_SIGNATURES.some((pattern) => pattern.test(message));
};

export const isStaleTopicRouteLookupError = (errorLike) => {
    const message = normalizeMessage(errorLike);
    if (!message) return false;
    if (!STALE_TOPIC_ROUTE_VALIDATION_PATTERN.test(message)) return false;
    if (STALE_TOPIC_ROUTE_CALL_SIGNATURES.some((pattern) => pattern.test(message))) {
        return true;
    }
    return STALE_TOPIC_ROUTE_FOUND_ID_PATTERN.test(message);
};

export const isStaleTopicRoutePathname = (pathname) =>
    STALE_TOPIC_ROUTE_PATH_PATTERN.test(String(pathname || ''));

export const isStaleExamRouteReferenceError = (errorLike) => {
    const message = normalizeMessage(errorLike);
    if (!message) return false;
    return STALE_EXAM_ROUTE_REFERENCE_PATTERNS.some((pattern) => pattern.test(message));
};

const toScopeKey = (scope) => {
    const normalizedScope = String(scope || 'global').trim().toLowerCase();
    const safeScope = normalizedScope.replace(/[^a-z0-9:_-]+/g, '_') || 'global';
    return `${CHUNK_RECOVERY_TS_KEY_PREFIX}${safeScope}`;
};

const markRecoveryAttempt = (scope) => {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    const storageKey = toScopeKey(scope);

    try {
        const lastAttemptRaw = window.sessionStorage.getItem(storageKey);
        const lastAttempt = Number(lastAttemptRaw);

        if (Number.isFinite(lastAttempt) && now - lastAttempt < CHUNK_RECOVERY_WINDOW_MS) {
            return false;
        }

        window.sessionStorage.setItem(storageKey, String(now));
        return true;
    } catch {
        // If sessionStorage is unavailable (private mode / blocked storage),
        // proceed with a single in-memory attempt using the current runtime.
        return true;
    }
};

const clearBrowserRuntimeCaches = async () => {
    if (typeof window === 'undefined') return;

    const clearServiceWorkers = async () => {
        if (!('serviceWorker' in navigator)) return;

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.allSettled(registrations.map((registration) => registration.unregister()));
        } catch {
            // Ignore cleanup failures and continue to reload.
        }
    };

    const clearCacheStorage = async () => {
        if (!('caches' in window)) return;

        try {
            const cacheKeys = await window.caches.keys();
            await Promise.allSettled(cacheKeys.map((key) => window.caches.delete(key)));
        } catch {
            // Ignore cleanup failures and continue to reload.
        }
    };

    await Promise.allSettled([clearServiceWorkers(), clearCacheStorage()]);
};

export const canAttemptChunkRecoveryReload = (scope) => markRecoveryAttempt(scope);

export const attemptChunkRecoveryReload = (scope) => {
    if (!canAttemptChunkRecoveryReload(scope)) return false;

    void clearBrowserRuntimeCaches().finally(() => {
        window.location.reload();
    });

    return true;
};

export const redirectForStaleTopicRoute = () => {
    if (typeof window === 'undefined') return false;
    if (!isStaleTopicRoutePathname(window.location.pathname)) return false;
    if (!canAttemptChunkRecoveryReload('stale-topic-route')) return false;
    window.location.replace('/dashboard');
    return true;
};
