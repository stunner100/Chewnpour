const TRANSIENT_ERROR_PATTERNS = [
    'load failed',
    'failed to fetch',
    'networkerror',
    'network request failed',
    'connection lost',
    'connection reset',
    'timed out',
    'timeout',
    'fetch failed',
];

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const getErrorMessage = (error) =>
    String(error?.message || error || '')
        .replace(/\s+/g, ' ')
        .trim();

export const isTransientUploadTransportError = (error) => {
    const message = getErrorMessage(error).toLowerCase();
    if (!message) return false;
    return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const isRetryableStatusCode = (statusCode) => RETRYABLE_STATUS_CODES.has(Number(statusCode));

const buildBackoffDelayMs = (attempt, baseDelayMs, jitterMs) => {
    const exponential = baseDelayMs * (2 ** Math.max(0, attempt - 1));
    const jitter = Math.round(Math.random() * Math.max(0, jitterMs));
    return Math.max(0, exponential + jitter);
};

export const uploadToStorageWithRetry = async ({
    uploadUrl,
    file,
    contentType,
    maxAttempts = 3,
    baseDelayMs = 500,
    jitterMs = 250,
    onRetry,
}) => {
    if (!uploadUrl) {
        throw new Error('Missing upload URL.');
    }

    let lastError;
    const attemptLimit = Math.max(1, Number(maxAttempts) || 1);

    for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: contentType ? { 'Content-Type': contentType } : undefined,
                body: file,
            });

            if (!response.ok) {
                const statusError = new Error(
                    `Upload storage request failed with status ${response.status}.`
                );
                const retryableStatus = isRetryableStatusCode(response.status);
                if (!retryableStatus || attempt === attemptLimit) {
                    throw statusError;
                }

                lastError = statusError;
            } else {
                const payload = await response.json();
                const storageId = payload?.storageId;
                if (!storageId) {
                    throw new Error('Upload failed to return storage information.');
                }
                return storageId;
            }
        } catch (error) {
            const retryableError = isTransientUploadTransportError(error);
            if (!retryableError || attempt === attemptLimit) {
                throw error;
            }
            lastError = error;
        }

        const delayMs = buildBackoffDelayMs(attempt, baseDelayMs, jitterMs);
        if (typeof onRetry === 'function') {
            onRetry({
                attempt,
                maxAttempts: attemptLimit,
                delayMs,
                error: lastError,
            });
        }
        await sleep(delayMs);
    }

    throw lastError || new Error('Upload failed after retry attempts.');
};

