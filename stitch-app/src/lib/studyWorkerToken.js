const TOKEN_SKEW_MS = 30_000;

const cache = new Map();

const cacheKey = ({ topicId, persona }) =>
    `${String(topicId || '')}::${String(persona || 'coach')}`;

export const getStudyWorkerToken = async ({ topicId, persona }) => {
    const key = cacheKey({ topicId, persona });
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now() + TOKEN_SKEW_MS) {
        return cached.token;
    }

    const response = await fetch(
        `/api/topics/${encodeURIComponent(topicId)}/study-worker-token`,
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ persona }),
        },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || 'Could not start the study worker.');
    }
    if (!payload?.token) {
        throw new Error('Could not start the study worker.');
    }

    cache.set(key, {
        token: payload.token,
        expiresAt: Number(payload.expiresAt || Date.now() + 15 * 60 * 1000),
    });
    return payload.token;
};

export const clearStudyWorkerToken = ({ topicId, persona } = {}) => {
    if (!topicId) {
        cache.clear();
        return;
    }
    cache.delete(cacheKey({ topicId, persona }));
};

export const getEveHost = () => {
    const host = String(import.meta.env.VITE_EVE_HOST || '').trim().replace(/\/$/, '');
    return host || undefined;
};
