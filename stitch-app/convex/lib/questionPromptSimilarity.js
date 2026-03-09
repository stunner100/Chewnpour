const PROMPT_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "best",
    "by",
    "can",
    "correct",
    "describe",
    "does",
    "each",
    "for",
    "from",
    "following",
    "how",
    "in",
    "is",
    "least",
    "main",
    "most",
    "of",
    "on",
    "or",
    "question",
    "select",
    "statement",
    "that",
    "the",
    "this",
    "to",
    "true",
    "what",
    "when",
    "which",
    "why",
    "with",
]);

export const normalizeQuestionPromptKey = (value) => {
    return String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const extractPromptTokens = (normalizedPrompt) => {
    if (!normalizedPrompt) return [];
    const unique = new Set();
    for (const rawToken of normalizedPrompt.split(" ")) {
        const token = rawToken.trim();
        if (!token) continue;
        if (token.length <= 2) continue;
        if (PROMPT_STOP_WORDS.has(token)) continue;
        unique.add(token);
    }
    return Array.from(unique);
};

export const buildQuestionPromptSignature = (value) => {
    const normalized = normalizeQuestionPromptKey(value);
    const tokens = extractPromptTokens(normalized);
    const fingerprint = tokens.length > 0
        ? [...tokens].sort().slice(0, 12).join(" ")
        : "";
    return {
        normalized,
        tokens,
        fingerprint,
    };
};

const toSignature = (value) => {
    if (value && typeof value === "object" && Array.isArray(value.tokens)) {
        const normalized = normalizeQuestionPromptKey(value.normalized || "");
        const tokens = Array.from(new Set(
            value.tokens
                .map((token) => String(token || "").trim().toLowerCase())
                .filter(Boolean)
        ));
        const fingerprint = String(value.fingerprint || "").trim().toLowerCase()
            || (tokens.length > 0 ? [...tokens].sort().slice(0, 12).join(" ") : "");
        return { normalized, tokens, fingerprint };
    }
    return buildQuestionPromptSignature(value);
};

export const areQuestionPromptsNearDuplicate = (leftValue, rightValue) => {
    const left = toSignature(leftValue);
    const right = toSignature(rightValue);
    if (!left.normalized || !right.normalized) return false;
    if (left.normalized === right.normalized) return true;

    if (left.fingerprint && right.fingerprint && left.fingerprint === right.fingerprint) {
        return true;
    }

    if (left.tokens.length === 0 || right.tokens.length === 0) {
        return false;
    }

    const leftSet = new Set(left.tokens);
    let shared = 0;
    for (const token of right.tokens) {
        if (leftSet.has(token)) shared += 1;
    }

    if (shared === 0) return false;

    const smallerTokenCount = Math.max(1, Math.min(left.tokens.length, right.tokens.length));
    const unionCount = Math.max(1, new Set([...left.tokens, ...right.tokens]).size);
    const overlap = shared / smallerTokenCount;
    const jaccard = shared / unionCount;
    const containment =
        left.normalized.includes(right.normalized)
        || right.normalized.includes(left.normalized);

    if (containment && shared >= 3 && overlap >= 0.7) {
        return true;
    }

    return shared >= 4 && overlap >= 0.82 && jaccard >= 0.68;
};
