const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const cancelBody = async (response) => {
    try {
        await response.body?.cancel?.();
    } catch {
        // Ignore cancel failures on already-closed streams.
    }
};

export const followPostRedirects = async (url, init, { maxHops = 5 } = {}) => {
    let currentUrl = String(url);
    for (let hop = 0; hop <= maxHops; hop += 1) {
        const response = await fetch(currentUrl, {
            ...init,
            redirect: "manual",
        });
        if (!REDIRECT_STATUSES.has(response.status)) {
            return response;
        }

        const location = response.headers.get("location");
        await cancelBody(response);
        if (!location) {
            throw new Error(`HTTP ${response.status} redirect missing Location`);
        }
        currentUrl = new URL(location, currentUrl).toString();
    }
    throw new Error(`Too many redirects after ${maxHops} hops`);
};
