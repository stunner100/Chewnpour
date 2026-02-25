import { isChunkLoadError } from './chunkLoadRecovery';

const sentryDsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim();
const sentryEnvironment = String(
    import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development'
).trim();
const sentryRelease = String(import.meta.env.VITE_SENTRY_RELEASE || '').trim();
const sentryTunnel = String(import.meta.env.VITE_SENTRY_TUNNEL || '').trim();
const KNOWN_NOISE_ERROR_PATTERNS = [
    /SCDynimacBridge/i,
    /SCDynamicBridge/i,
];
const RECOVERABLE_SIGNAL_MESSAGES = new Set([
    'Assignment upload blocked because session auth is not ready.',
    'Essay submission rejected by validation',
    'Exam attempt deferred while question bank prepares',
    'Exam attempt start requires retry',
    'Exam auto-generation paused after retries',
    'Exam auto-generation paused due to auth error',
    'Exam submission requires retry',
    'Question generation watchdog timeout reached',
    'Recoverable OTT verification failure',
    'Upload blocked because session auth is not ready.',
    'Upload flow completed',
    'Upload flow started',
    'Upload processing kickoff retry triggered',
    'Upload processing ready',
    'Upload validation rejected',
]);
const NOISY_UPLOAD_OPERATIONS = new Set([
    'flow_completed',
    'flow_started',
    'flow_warning',
    'processing_ready',
    'validation_rejected',
]);
const NOISY_EXAM_RECOVERABLE_OPERATIONS = new Set([
    'auto_generate_questions',
    'start_exam_attempt',
    'submit_exam_attempt',
    'submit_essay_exam',
]);

const parseSampleRate = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < 0) return 0;
    if (parsed > 1) return 1;
    return parsed;
};

const tracesSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    import.meta.env.PROD ? 0.2 : 1
);
const replaysSessionSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0
);
const replaysOnErrorSampleRate = parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    0
);

let initialized = false;
let enabled = false;
let sentrySdk = null;
let sentrySdkPromise = null;
let pendingCalls = [];

const loadSentrySdk = async () => {
    if (sentrySdk) return sentrySdk;
    if (!sentrySdkPromise) {
        sentrySdkPromise = import('@sentry/react').then((mod) => {
            sentrySdk = mod;
            return mod;
        });
    }
    return sentrySdkPromise;
};

const withSentry = (fn) => {
    if (!sentryDsn || typeof fn !== 'function') return;

    if (enabled && sentrySdk) {
        fn(sentrySdk);
        return;
    }

    pendingCalls.push(fn);
};

const flushPendingCalls = () => {
    if (!enabled || !sentrySdk || pendingCalls.length === 0) return;

    const queued = pendingCalls;
    pendingCalls = [];

    for (const callback of queued) {
        try {
            callback(sentrySdk);
        } catch {
            // Ignore telemetry callback failures.
        }
    }
};

const buildIntegrations = (Sentry) => {
    const integrations = [];

    if (typeof Sentry.browserTracingIntegration === 'function') {
        integrations.push(Sentry.browserTracingIntegration());
    }

    const replayEnabled = replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0;
    if (replayEnabled && typeof Sentry.replayIntegration === 'function') {
        integrations.push(
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            })
        );
    }

    return integrations;
};

const applyScopeContext = (scope, context = {}) => {
    if (!context || typeof context !== 'object') return;
    if (context.level) {
        scope.setLevel(context.level);
    }
    if (context.fingerprint) {
        scope.setFingerprint(Array.isArray(context.fingerprint) ? context.fingerprint : [String(context.fingerprint)]);
    }
    if (context.tags && typeof context.tags === 'object') {
        for (const [key, value] of Object.entries(context.tags)) {
            if (value === undefined || value === null) continue;
            scope.setTag(String(key), String(value));
        }
    }
    if (context.extras && typeof context.extras === 'object') {
        for (const [key, value] of Object.entries(context.extras)) {
            scope.setExtra(String(key), value);
        }
    }
    if (context.contexts && typeof context.contexts === 'object') {
        for (const [key, value] of Object.entries(context.contexts)) {
            if (value === undefined || value === null) continue;
            scope.setContext(String(key), value);
        }
    }
};

const extractCandidateErrorMessages = (event, hint) => {
    const values = [];

    if (typeof event?.message === 'string' && event.message.trim()) {
        values.push(event.message.trim());
    }

    const exceptionValues = Array.isArray(event?.exception?.values) ? event.exception.values : [];
    for (const entry of exceptionValues) {
        if (typeof entry?.value === 'string' && entry.value.trim()) {
            values.push(entry.value.trim());
        }
        if (typeof entry?.type === 'string' && entry.type.trim()) {
            values.push(entry.type.trim());
        }
    }

    const originalError = hint?.originalException;
    if (typeof originalError?.message === 'string' && originalError.message.trim()) {
        values.push(originalError.message.trim());
    } else if (typeof originalError === 'string' && originalError.trim()) {
        values.push(originalError.trim());
    }

    return values;
};

const readEventTag = (event, key) => {
    const tags = event?.tags;
    if (!tags || !key) return '';

    if (Array.isArray(tags)) {
        const match = tags.find((entry) => {
            if (Array.isArray(entry)) return String(entry[0]) === key;
            return String(entry?.key || '') === key;
        });
        if (!match) return '';
        if (Array.isArray(match)) {
            return match[1] === undefined || match[1] === null ? '' : String(match[1]);
        }
        return match?.value === undefined || match?.value === null ? '' : String(match.value);
    }

    if (typeof tags === 'object') {
        const value = tags[key];
        return value === undefined || value === null ? '' : String(value);
    }

    return '';
};

const shouldDropAssetTransportNoiseEvent = (event, messages) => {
    const location = String(event?.location || '').toLowerCase();
    if (!location.includes('/assets/')) return false;
    return messages.some((message) => {
        const normalized = String(message || '').toLowerCase();
        return (
            normalized.includes('typeerror: load failed')
            || normalized.includes('typeerror: failed to fetch')
        );
    });
};

const shouldDropRecoverableSignalEvent = (event) => {
    const level = String(event?.level || '').trim().toLowerCase();
    const message = String(event?.message || '').trim();
    if (message && RECOVERABLE_SIGNAL_MESSAGES.has(message)) {
        return true;
    }

    const area = readEventTag(event, 'area').trim().toLowerCase();
    const operation = readEventTag(event, 'operation').trim().toLowerCase();
    const recoverable = readEventTag(event, 'recoverable').trim().toLowerCase();
    const deferred = readEventTag(event, 'deferred').trim().toLowerCase();
    const authError = readEventTag(event, 'authError').trim().toLowerCase();
    const isTransient = readEventTag(event, 'isTransient').trim().toLowerCase();
    const transientTransport = readEventTag(event, 'transientTransport').trim().toLowerCase();
    const transientTransportError = readEventTag(event, 'transientTransportError').trim().toLowerCase();

    if (transientTransport === 'yes') {
        return true;
    }

    if (area === 'auth' && isTransient === 'yes' && level !== 'error') {
        return true;
    }

    if (area === 'upload' && NOISY_UPLOAD_OPERATIONS.has(operation) && level !== 'error') {
        return true;
    }

    if (
        area === 'exam'
        && NOISY_EXAM_RECOVERABLE_OPERATIONS.has(operation)
        && (
            recoverable === 'yes'
            || deferred === 'yes'
            || authError === 'yes'
            || transientTransportError === 'yes'
            || level === 'warning'
        )
    ) {
        return true;
    }

    return false;
};

const shouldDropKnownNoiseEvent = (event, hint) => {
    if (shouldDropRecoverableSignalEvent(event)) return true;

    const messages = extractCandidateErrorMessages(event, hint);
    if (messages.length === 0) return false;

    if (messages.some((message) => isChunkLoadError(message))) {
        return true;
    }

    if (shouldDropAssetTransportNoiseEvent(event, messages)) {
        return true;
    }

    return messages.some((message) =>
        KNOWN_NOISE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
    );
};

export const initSentry = () => {
    if (initialized) return enabled;
    initialized = true;

    if (!sentryDsn) {
        pendingCalls = [];
        return false;
    }

    void loadSentrySdk()
        .then((Sentry) => {
            Sentry.init({
                dsn: sentryDsn,
                environment: sentryEnvironment,
                release: sentryRelease || undefined,
                tunnel: sentryTunnel || undefined,
                integrations: buildIntegrations(Sentry),
                ignoreErrors: KNOWN_NOISE_ERROR_PATTERNS,
                tracesSampleRate,
                replaysSessionSampleRate,
                replaysOnErrorSampleRate,
                transportOptions: {
                    fetchOptions: {
                        keepalive: true,
                    },
                },
                normalizeDepth: 8,
                sendDefaultPii: false,
                beforeSend(event, hint) {
                    // Drop known third-party/browser-injected bridge errors outside app control.
                    if (shouldDropKnownNoiseEvent(event, hint)) {
                        return null;
                    }
                    return event;
                },
            });

            enabled = true;
            flushPendingCalls();
        })
        .catch(() => {
            pendingCalls = [];
        });

    return true;
};

export const isSentryEnabled = () => enabled;

export const setSentryUser = (user) => {
    withSentry((Sentry) => {
        if (!user) {
            Sentry.setUser(null);
            return;
        }

        const sentryUser = {
            id: user.id ? String(user.id) : undefined,
            email: user.email ? String(user.email) : undefined,
            username: user.username ? String(user.username) : undefined,
        };

        Sentry.setUser(sentryUser);
    });
};

export const addSentryBreadcrumb = ({ category = 'app', message, level = 'info', data = {} }) => {
    if (!message) return;
    withSentry((Sentry) => {
        Sentry.addBreadcrumb({
            category,
            message,
            level,
            data,
            timestamp: Date.now() / 1000,
        });
    });
};

export const captureSentryMessage = (message, context = {}) => {
    if (!message) return;
    withSentry((Sentry) => {
        Sentry.withScope((scope) => {
            applyScopeContext(scope, context);
            const level = context.level || 'info';
            Sentry.captureMessage(message, level);
        });
    });
};

export const captureSentryException = (error, context = {}) => {
    if (!error) return;
    withSentry((Sentry) => {
        Sentry.withScope((scope) => {
            applyScopeContext(scope, context);
            Sentry.captureException(error);
        });
    });
};
