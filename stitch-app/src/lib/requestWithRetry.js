// JSON requests that survive a flaky phone connection. Network failures and
// gateway/timeout statuses are retried with a short backoff; anything else
// (validation errors, auth, server bugs) fails straight away.

const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

export const OFFLINE_MESSAGE = 'Could not reach ChewnPour. Check your connection and try again.';

const wait = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

export const isRetryableRequestError = (error) => Boolean(error?.retryable);

export const requestJsonWithRetry = async (
    url,
    init = {},
    { attempts = 3, baseDelayMs = 800, fallbackMessage = 'Request failed', sleep = wait } = {},
) => {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let response;
        try {
            response = await fetch(url, init);
        } catch {
            lastError = Object.assign(new Error(OFFLINE_MESSAGE), { retryable: true });
        }
        if (response) {
            const payload = await response.json().catch(() => ({}));
            if (response.ok) return payload;
            lastError = Object.assign(new Error(payload.error || fallbackMessage), {
                status: response.status,
                retryable: RETRYABLE_STATUSES.has(response.status),
            });
            if (!lastError.retryable) throw lastError;
        }
        if (attempt < attempts) await sleep(baseDelayMs * attempt);
    }
    throw lastError;
};
