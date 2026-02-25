import { ConvexError } from "convex/values";

export const resolveAuthUserId = (identity) => {
    if (!identity || typeof identity !== "object") return "";
    const candidates = [
        identity.subject,
        identity.userId,
        identity.id,
        identity.tokenIdentifier,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
};

export const assertAuthorizedUser = ({
    authUserId,
    requestedUserId,
    resourceOwnerUserId,
}) => {
    const normalizedAuthUserId = typeof authUserId === "string" ? authUserId.trim() : "";
    const normalizedRequestedUserId =
        typeof requestedUserId === "string"
            ? requestedUserId.trim()
            : requestedUserId
                ? String(requestedUserId).trim()
                : "";
    const normalizedResourceOwnerUserId =
        typeof resourceOwnerUserId === "string"
            ? resourceOwnerUserId.trim()
            : resourceOwnerUserId
                ? String(resourceOwnerUserId).trim()
                : "";

    if (!normalizedAuthUserId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "Not authenticated. Please sign in and try again.",
        });
    }
    if (normalizedRequestedUserId && normalizedRequestedUserId !== normalizedAuthUserId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "You do not have permission to access this exam data.",
        });
    }
    if (normalizedResourceOwnerUserId && normalizedResourceOwnerUserId !== normalizedAuthUserId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "You do not have permission to access this exam attempt.",
        });
    }
    return normalizedAuthUserId;
};

const CORRECTNESS_HINT_FIELDS = new Set([
    "correctAnswer",
    "isCorrect",
    "correct",
    "isAnswer",
    "is_true",
]);

const stripCorrectnessHints = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => stripCorrectnessHints(item));
    }
    if (!value || typeof value !== "object") {
        return value;
    }

    const sanitized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
        if (CORRECTNESS_HINT_FIELDS.has(key)) continue;
        sanitized[key] = stripCorrectnessHints(nestedValue);
    }
    return sanitized;
};

const DISALLOWED_EXAM_OPTION_PATTERNS = [
    /^none of the above$/i,
    /^all of the above$/i,
    /^cannot be determined from the question$/i,
    /^not enough information$/i,
    /^insufficient information$/i,
    /^unknown$/i,
    /^n\/a$/i,
    /^[a-d]$/i,
    /^option\s*[a-d]?$/i,
];

const normalizeOptionText = (value) => {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim();
};

const normalizeOptionKey = (value) => {
    return normalizeOptionText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
};

const coerceOptionsForValidation = (rawOptions) => {
    if (!rawOptions) return [];

    let options = rawOptions;
    if (typeof options === "string") {
        const trimmed = options.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                options = JSON.parse(trimmed);
            } catch {
                options = [trimmed];
            }
        } else {
            options = [trimmed];
        }
    }

    if (options && !Array.isArray(options) && typeof options === "object") {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else if (Array.isArray(options.choices)) {
            options = options.choices;
        } else {
            options = [options];
        }
    }

    if (!Array.isArray(options)) {
        options = [options];
    }

    const normalized = [];
    for (const option of options) {
        if (typeof option === "string") {
            const match = option.match(/^\s*([A-D])[).\-:\s]+(.+)$/i);
            normalized.push({
                label: match?.[1]?.toUpperCase(),
                text: normalizeOptionText(match ? match[2] : option),
            });
            continue;
        }
        if (!option || typeof option !== "object") continue;
        const text = normalizeOptionText(
            option.text ?? option.value ?? option.answer ?? option.choiceText ?? option.label
        );
        if (!text) continue;
        normalized.push({
            label: option.label ? String(option.label).trim().toUpperCase() : undefined,
            text,
        });
    }

    return normalized.filter((option) => option.text);
};

const isDisallowedExamOptionText = (value) => {
    const key = normalizeOptionKey(value);
    if (!key) return true;
    return DISALLOWED_EXAM_OPTION_PATTERNS.some((pattern) => pattern.test(key));
};

export const hasUsableExamOptions = (rawOptions) => {
    const options = coerceOptionsForValidation(rawOptions);
    if (options.length < 4) return false;
    const firstFour = options.slice(0, 4);
    const keys = firstFour.map((option) => normalizeOptionKey(option.text));
    if (keys.some((key) => !key)) return false;
    if (new Set(keys).size < 4) return false;
    return firstFour.every((option) => !isDisallowedExamOptionText(option.text));
};

export const isUsableExamQuestion = (question, { allowEssay = false } = {}) => {
    if (!question || typeof question !== "object") return false;
    const normalizedQuestionText = String(question.questionText || "").replace(/\s+/g, " ").trim();
    if (normalizedQuestionText.length < 12) return false;
    if (allowEssay && question.questionType === "essay") {
        return String(question.correctAnswer || "").trim().length > 0;
    }
    return hasUsableExamOptions(question.options);
};

export const sanitizeExamQuestionForClient = (question) => {
    if (!question || typeof question !== "object") return question;
    if (question.questionType === "essay") {
        const { correctAnswer: _CORRECT_ANSWER, explanation: _EXPLANATION, ...safeQuestion } = question;
        return safeQuestion;
    }
    const { correctAnswer: _CORRECT_ANSWER, options, ...safeQuestion } = question;
    return {
        ...safeQuestion,
        options: stripCorrectnessHints(options),
    };
};

export const ensureUniqueAnswerQuestionIds = (answers) => {
    const seen = new Set();
    for (const answer of answers || []) {
        const questionId = String(answer?.questionId || "").trim();
        if (!questionId) continue;
        if (seen.has(questionId)) {
            throw new Error("Submitted answers cannot include duplicate questions.");
        }
        seen.add(questionId);
    }
};

export const computeExamPercentage = ({ score, totalQuestions, fallbackTotal = 0 }) => {
    const safeScore = Number.isFinite(score) ? Number(score) : 0;
    const safeTotal = Number.isFinite(totalQuestions) ? Number(totalQuestions) : 0;
    const safeFallback = Number.isFinite(fallbackTotal) ? Number(fallbackTotal) : 0;
    const denominator = safeTotal > 0 ? safeTotal : safeFallback > 0 ? safeFallback : 1;
    return Math.round((safeScore / denominator) * 100);
};
