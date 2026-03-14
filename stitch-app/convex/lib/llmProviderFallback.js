export const isHardInceptionProviderFailure = (message) => {
    const normalized = String(message || "").toLowerCase();
    if (!normalized) return false;
    return [
        "arrearage",
        "access denied",
        "account is in good standing",
        "overdue-payment",
        "insufficient balance",
        "quota exhausted",
    ].some((token) => normalized.includes(token));
};

export const shouldFallbackToGeminiText = ({ errorMessage, geminiApiKey }) => {
    return Boolean(String(geminiApiKey || "").trim()) && isHardInceptionProviderFailure(errorMessage);
};
