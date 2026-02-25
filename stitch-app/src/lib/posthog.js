const posthogKey = String(import.meta.env.VITE_POSTHOG_KEY || '').trim();
const posthogHost = String(import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com').trim();
const posthogUiHost = String(import.meta.env.VITE_POSTHOG_UI_HOST || '').trim();
const posthogDebug = String(import.meta.env.VITE_POSTHOG_DEBUG || '')
    .trim()
    .toLowerCase() === 'true';
const posthogAllowExternalDeps = String(import.meta.env.VITE_POSTHOG_ALLOW_EXTERNAL_DEPS || '')
    .trim()
    .toLowerCase() === 'true';
const MAX_PENDING_ACTIONS = 64;

let initialized = false;
let enabled = false;
let queueingAllowed = true;
let pendingActions = [];
let posthogClient = null;
let posthogModulePromise = null;

const sanitizeProperties = (properties = {}) => {
    const payload = {};
    for (const [key, value] of Object.entries(properties)) {
        if (value === undefined || value === null) continue;
        if (value instanceof Error) {
            payload[String(key)] = value.message || String(value);
            continue;
        }
        const valueType = typeof value;
        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            payload[String(key)] = value;
            continue;
        }
        try {
            payload[String(key)] = JSON.parse(JSON.stringify(value));
        } catch {
            payload[String(key)] = String(value);
        }
    }
    return payload;
};

const withPostHog = (action) => {
    if (!posthogKey || typeof action !== 'function') return;

    if (enabled && posthogClient) {
        action(posthogClient);
        return;
    }

    if (!queueingAllowed) return;
    if (pendingActions.length >= MAX_PENDING_ACTIONS) {
        pendingActions.shift();
    }
    pendingActions.push(action);
};

const flushPendingActions = () => {
    if (!enabled || !posthogClient || pendingActions.length === 0) return;

    const queued = pendingActions;
    pendingActions = [];

    for (const action of queued) {
        try {
            action(posthogClient);
        } catch {
            // Ignore telemetry callback failures.
        }
    }
};

const loadPostHogClient = async () => {
    if (posthogClient) return posthogClient;

    if (!posthogModulePromise) {
        posthogModulePromise = import('posthog-js')
            .then((mod) => {
                posthogClient = mod.default || mod;
                return posthogClient;
            })
            .catch(() => null);
    }

    return posthogModulePromise;
};

export const isPostHogConfigured = () => Boolean(posthogKey);

export const getPostHogClient = () => {
    if (!posthogKey) return null;
    return posthogClient;
};

export const initPostHog = () => {
    if (initialized) return enabled;
    initialized = true;

    if (!posthogKey) {
        queueingAllowed = false;
        pendingActions = [];
        return false;
    }

    void loadPostHogClient()
        .then((client) => {
            if (!client) {
                queueingAllowed = false;
                pendingActions = [];
                enabled = false;
                return;
            }

            client.init(posthogKey, {
                api_host: posthogHost,
                ui_host: posthogUiHost || undefined,
                capture_pageview: false,
                capture_pageleave: false,
                autocapture: false,
                capture_dead_clicks: false,
                capture_heatmaps: false,
                disable_session_recording: true,
                disable_surveys: true,
                disable_surveys_automatic_display: true,
                disable_product_tours: true,
                disable_conversations: true,
                disable_web_experiments: true,
                disable_external_dependency_loading: !posthogAllowExternalDeps,
                loaded: (loadedClient) => {
                    if (posthogDebug || !import.meta.env.PROD) {
                        loadedClient.debug();
                    }
                },
            });

            enabled = true;
            queueingAllowed = false;
            flushPendingActions();
        })
        .catch(() => {
            queueingAllowed = false;
            pendingActions = [];
            enabled = false;
        });

    return true;
};

export const isPostHogEnabled = () => enabled;

export const setPostHogUser = (user) => {
    if (!user?.id) return;
    withPostHog((client) => {
        client.identify(String(user.id), sanitizeProperties({
            email: user.email ? String(user.email) : undefined,
            name: user.username ? String(user.username) : undefined,
        }));
    });
};

export const resetPostHogUser = () => {
    withPostHog((client) => {
        client.reset();
    });
};

export const capturePostHogEvent = (eventName, properties = {}) => {
    if (!eventName) return;
    withPostHog((client) => {
        client.capture(String(eventName), sanitizeProperties(properties));
    });
};

export const capturePostHogPageView = ({ pathname, search, hash, title } = {}) => {
    capturePostHogEvent('$pageview', {
        pathname: pathname ? String(pathname) : undefined,
        search: search ? String(search) : '',
        hash: hash ? String(hash) : '',
        title: title ? String(title) : undefined,
    });
};
