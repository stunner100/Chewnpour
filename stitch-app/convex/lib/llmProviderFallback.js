export const isOpenAiProviderFailure = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return [
        "openai api error",
        "openai request timed out",
        "insufficient_quota",
        "quota exceeded",
        "rate_limit",
        "rate limit",
        "deploymentnotfound",
        "context_length_exceeded",
        "incorrect api key",
        "invalid api key",
        "unauthorized",
        "invalid authentication",
        "server_error",
        "internal server error",
        "failed to fetch",
        "network",
        "aborted",
    ].some((token) => normalized.includes(token));
};

export const shouldFallbackToInceptionText = ({ errorMessage, inceptionApiKey }) => {
    return Boolean(String(inceptionApiKey || "").trim()) && isOpenAiProviderFailure(errorMessage);
};
