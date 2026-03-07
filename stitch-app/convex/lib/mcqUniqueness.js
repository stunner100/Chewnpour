"use node";

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

export const normalizeQuestionPromptKey = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

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

const comparePromptSignatures = (leftValue, rightValue) => {
    const left = leftValue?.normalized ? leftValue : buildQuestionPromptSignature(leftValue);
    const right = rightValue?.normalized ? rightValue : buildQuestionPromptSignature(rightValue);
    if (!left.normalized || !right.normalized) return false;
    if (left.normalized === right.normalized) return true;

    if (left.fingerprint && right.fingerprint && left.fingerprint === right.fingerprint) {
        return true;
    }

    const leftTokens = Array.isArray(left.tokens) ? left.tokens : [];
    const rightTokens = Array.isArray(right.tokens) ? right.tokens : [];
    if (leftTokens.length === 0 || rightTokens.length === 0) {
        return false;
    }

    const tokenStats = compareTokenSets(leftTokens, rightTokens);
    const containment =
        left.normalized.includes(right.normalized)
        || right.normalized.includes(left.normalized);

    if (containment && tokenStats.shared >= 3 && tokenStats.overlap >= 0.7) {
        return true;
    }

    return tokenStats.shared >= 4 && tokenStats.overlap >= 0.82 && tokenStats.jaccard >= 0.68;
};

export const areQuestionPromptsNearDuplicate = (leftValue, rightValue) =>
    comparePromptSignatures(leftValue, rightValue);

const FACT_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
]);

const normalizeFactText = (value) =>
    normalizeQuestionPromptKey(value)
        .replace(/\bwow\b/g, "week over week")
        .replace(/\byoy\b/g, "year over year")
        .replace(/\bqoq\b/g, "quarter over quarter")
        .replace(/\s+/g, " ")
        .trim();

const extractFactTokens = (normalized) => {
    if (!normalized) return [];
    const unique = new Set();
    for (const rawToken of normalized.split(" ")) {
        const token = rawToken.trim();
        if (!token) continue;
        if (FACT_STOP_WORDS.has(token)) continue;
        if (token.length <= 2 && !/\d/.test(token)) continue;
        unique.add(token);
    }
    return Array.from(unique);
};

const extractNumericTokens = (normalized) => {
    const matches = String(normalized || "").match(/\d+(?:\.\d+)?/g);
    return Array.from(new Set(matches || []));
};

const buildFactSignature = (value) => {
    const normalized = normalizeFactText(value);
    return {
        normalized,
        tokens: extractFactTokens(normalized),
        numerics: extractNumericTokens(normalized),
    };
};

const compareTokenSets = (leftTokens, rightTokens) => {
    const left = Array.isArray(leftTokens) ? leftTokens.filter(Boolean) : [];
    const right = Array.isArray(rightTokens) ? rightTokens.filter(Boolean) : [];
    if (left.length === 0 || right.length === 0) {
        return { shared: 0, overlap: 0, jaccard: 0 };
    }

    const leftSet = new Set(left);
    let shared = 0;
    for (const token of right) {
        if (leftSet.has(token)) shared += 1;
    }

    const smaller = Math.max(1, Math.min(left.length, right.length));
    const union = Math.max(1, new Set([...left, ...right]).size);
    return {
        shared,
        overlap: shared / smaller,
        jaccard: shared / union,
    };
};

const resolveCorrectOptionText = (question) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    const storedCorrect = String(question?.correctAnswer || "").trim().toUpperCase();
    const marked =
        options.find((option) => option?.isCorrect === true)
        || options.find((option) => String(option?.label || "").trim().toUpperCase() === storedCorrect);
    if (marked?.text) {
        return String(marked.text).trim();
    }
    if (question?.correctOptionText) {
        return String(question.correctOptionText).trim();
    }
    if (options.length === 0 && question?.correctAnswer) {
        return String(question.correctAnswer).trim();
    }
    return "";
};

const buildCitationContext = (citation, index) => {
    const passageId = String(citation?.passageId || "").trim();
    const page = Number.isFinite(Number(citation?.page))
        ? Math.max(0, Math.floor(Number(citation.page)))
        : 0;
    const quoteSignature = buildFactSignature(String(citation?.quote || ""));
    const quoteKey = quoteSignature.normalized.slice(0, 220);
    const keyBase = quoteKey || `page:${page}:citation:${index}`;
    const key = passageId
        ? `${passageId}:${keyBase}`
        : `page:${page}:${keyBase}`;
    return {
        key,
        passageId,
        page,
        quoteSignature,
    };
};

const hasSharedKey = (leftValues, rightValues) => {
    if (!Array.isArray(leftValues) || !Array.isArray(rightValues) || leftValues.length === 0 || rightValues.length === 0) {
        return false;
    }
    const leftSet = new Set(leftValues.filter(Boolean));
    for (const value of rightValues) {
        if (leftSet.has(value)) return true;
    }
    return false;
};

const doFactSignaturesMatch = (leftValue, rightValue) => {
    const left = leftValue?.normalized ? leftValue : buildFactSignature(leftValue);
    const right = rightValue?.normalized ? rightValue : buildFactSignature(rightValue);
    if (!left.normalized || !right.normalized) return false;
    if (left.normalized === right.normalized) return true;

    const tokens = compareTokenSets(left.tokens, right.tokens);
    const numericsMatch =
        left.numerics.length > 0
        && right.numerics.length > 0
        && left.numerics.join("|") === right.numerics.join("|");
    const containment =
        left.normalized.includes(right.normalized)
        || right.normalized.includes(left.normalized);

    if (containment && tokens.shared >= 2 && tokens.overlap >= 0.6) {
        return true;
    }
    if (numericsMatch && tokens.shared >= 1 && tokens.overlap >= 0.5) {
        return true;
    }
    return tokens.shared >= 3 && tokens.overlap >= 0.75 && tokens.jaccard >= 0.6;
};

export const buildMcqUniquenessSignature = (question) => {
    if (question?.__mcqUniquenessSignature === true) {
        return question;
    }

    const promptSignature = buildQuestionPromptSignature(question?.questionText || "");
    const answerText = resolveCorrectOptionText(question);
    const answerSignature = buildFactSignature(answerText);
    const citations = (Array.isArray(question?.citations) ? question.citations : [])
        .filter(Boolean)
        .map((citation, index) => buildCitationContext(citation, index));
    const citationKeys = citations.map((citation) => citation.key);
    const citationAnswerKeys = answerSignature.normalized
        ? citationKeys.map((citationKey) => `${citationKey}|${answerSignature.normalized}`)
        : [];
    const primaryCitation = citations[0] || null;

    return {
        __mcqUniquenessSignature: true,
        promptSignature,
        answerSignature,
        citationKeys,
        citationAnswerKeys,
        primaryCitationKey: primaryCitation?.key || "",
        primaryPassageId: primaryCitation?.passageId || "",
    };
};

export const areMcqQuestionsNearDuplicate = (leftValue, rightValue) => {
    const left = buildMcqUniquenessSignature(leftValue);
    const right = buildMcqUniquenessSignature(rightValue);

    if (areQuestionPromptsNearDuplicate(left.promptSignature, right.promptSignature)) {
        return true;
    }

    if (hasSharedKey(left.citationAnswerKeys, right.citationAnswerKeys)) {
        return true;
    }

    const answersMatch = doFactSignaturesMatch(left.answerSignature, right.answerSignature);
    const sharedCitationContext =
        hasSharedKey(left.citationKeys, right.citationKeys)
        || (
            left.primaryPassageId
            && right.primaryPassageId
            && left.primaryPassageId === right.primaryPassageId
            && (
                left.primaryCitationKey === right.primaryCitationKey
                || doFactSignaturesMatch(
                    left.primaryCitationKey.split(":").slice(1).join(" "),
                    right.primaryCitationKey.split(":").slice(1).join(" "),
                )
            )
        );

    if (answersMatch && sharedCitationContext) {
        return true;
    }

    if (
        answersMatch
        && left.primaryPassageId
        && left.primaryPassageId === right.primaryPassageId
    ) {
        const promptTokens = compareTokenSets(
            left.promptSignature?.tokens || [],
            right.promptSignature?.tokens || [],
        );
        if (promptTokens.shared >= 2 || promptTokens.overlap >= 0.5) {
            return true;
        }
    }

    return false;
};
