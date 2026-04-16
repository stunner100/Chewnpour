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

export const shouldFallbackToBedrockText = ({ errorMessage, bedrockAvailable }) => {
    return Boolean(bedrockAvailable) && isOpenAiProviderFailure(errorMessage);
};

export const shouldFallbackToInceptionText = ({ errorMessage, inceptionApiKey }) => {
    return Boolean(String(inceptionApiKey || "").trim())
        && (isOpenAiProviderFailure(errorMessage) || isBedrockProviderFailure(errorMessage));
};

export const isMiniMaxProviderFailure = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return [
        "minimax api error",
        "minimax request timed out",
        "authorized_error",
        "rate_limit",
        "rate limit",
        "incorrect api key",
        "invalid api key",
        "unauthorized",
        "invalid authentication",
        "failed to fetch",
        "network",
        "aborted",
        "server_error",
        "internal server error",
        "fetch failed",
    ].some((token) => normalized.includes(token));
};

export const shouldFallbackToMiniMaxText = ({ errorMessage, minimaxApiKey }) => {
    return Boolean(String(minimaxApiKey || "").trim())
        && (
            isOpenAiProviderFailure(errorMessage)
            || isBedrockProviderFailure(errorMessage)
            || isInceptionProviderFailure(errorMessage)
        );
};

export const isBedrockProviderFailure = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return [
        "bedrock api error",
        "bedrock request timed out",
        "throttling",
        "too many requests",
        "rate_limit",
        "rate limit",
        "incorrect api key",
        "invalid api key",
        "unauthorized",
        "invalid authentication",
        "access denied",
        "forbidden",
        "failed to fetch",
        "network",
        "aborted",
        "server_error",
        "internal server error",
    ].some((token) => normalized.includes(token));
};

export const isInceptionProviderFailure = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return [
        "inception api error",
        "inception request timed out",
        "inception request failed after retries",
        "rate_limit",
        "rate limit",
        "incorrect api key",
        "invalid api key",
        "unauthorized",
        "invalid authentication",
        "network",
        "failed to fetch",
        "aborted",
        "server_error",
        "internal server error",
    ].some((token) => normalized.includes(token));
};

export const shouldFallbackToOpenAiText = ({ errorMessage, openAiAvailable }) => {
    return Boolean(openAiAvailable)
        && (isInceptionProviderFailure(errorMessage) || isMiniMaxProviderFailure(errorMessage));
};
