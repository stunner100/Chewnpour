import { ConvexError } from "convex/values";
import {
    isEssayQuestionType,
    normalizeQuestionType,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
} from "./objectiveExam.js";
import {
    normalizeQualityTier,
    QUALITY_TIER_UNAVAILABLE,
} from "./premiumQuality.js";

const OBJECTIVE_MIN_USABLE_RIGOR_SCORE = 0.55;
const OBJECTIVE_MIN_USABLE_QUALITY_SCORE = 0.65;
const OBJECTIVE_MIN_USABLE_CLARITY_SCORE = 0.65;
const OBJECTIVE_MIN_USABLE_DISTRACTOR_SCORE = 0.6;

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

const normalizeTextAnswer = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

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

const hasUsableTrueFalseOptions = (rawOptions) => {
    const options = coerceOptionsForValidation(rawOptions);
    if (options.length !== 2) return false;
    const normalized = options.map((option) => normalizeOptionKey(option.text));
    return normalized.includes("true") && normalized.includes("false");
};

const countTemplateBlanks = (templateParts) =>
    (Array.isArray(templateParts) ? templateParts : []).filter((part) => part === "__").length;

const hasUsableFillBlankQuestion = (question) => {
    const templateParts = Array.isArray(question?.templateParts) ? question.templateParts : [];
    const acceptedAnswers = Array.isArray(question?.acceptedAnswers)
        ? question.acceptedAnswers.map((item) => normalizeTextAnswer(item)).filter(Boolean)
        : [];
    if (countTemplateBlanks(templateParts) !== 1) return false;
    if (acceptedAnswers.length === 0) return false;
    const fillBlankMode = String(question?.fillBlankMode || "").trim().toLowerCase();
    if (fillBlankMode === "token_bank") {
        const tokens = Array.isArray(question?.tokens)
            ? question.tokens.map((item) => normalizeTextAnswer(item)).filter(Boolean)
            : [];
        if (tokens.length < 2) return false;
    }
    return String(question?.questionText || "").replace(/\s+/g, " ").trim().length >= 12;
};

const SEVERE_QUESTION_QUALITY_FLAGS = new Set([
    "malformed_text",
    "outcome_alignment_mismatch",
    "unsupported_math_encoding",
    "corrupted_text",
]);

const MALFORMED_FRACTION_PLACEHOLDER_PATTERN = /(?:^|[\s(=+\-*/])(?:bc|bd|be)(?=$|[\s).,;:=+\-*/])/i;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

const containsMalformedQuestionText = (value) => {
    const normalized = String(value || "");
    if (!normalized.trim()) return false;
    if (CONTROL_CHAR_PATTERN.test(normalized)) return true;
    if (MALFORMED_FRACTION_PLACEHOLDER_PATTERN.test(normalized)) return true;
    return false;
};

const hasSevereQuestionContentIssue = (question) => {
    const textFields = [
        question?.questionText,
        question?.correctAnswer,
        question?.explanation,
        question?.learningObjective,
        question?.authenticContext,
        ...(Array.isArray(question?.options) ? question.options.map((option) => option?.text || option) : []),
        ...(Array.isArray(question?.templateParts) ? question.templateParts : []),
        ...(Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers : []),
        ...(Array.isArray(question?.tokens) ? question.tokens : []),
    ];

    return textFields.some((field) => containsMalformedQuestionText(field));
};

const hasSevereQualityFlag = (question) =>
    (Array.isArray(question?.qualityFlags) ? question.qualityFlags : [])
        .map((flag) => normalizeTextAnswer(flag))
        .some((flag) => SEVERE_QUESTION_QUALITY_FLAGS.has(flag));

const hasMinimumObjectiveQuality = (question) => {
    const rigorScore = Number(question?.rigorScore);
    if (Number.isFinite(rigorScore) && rigorScore < OBJECTIVE_MIN_USABLE_RIGOR_SCORE) {
        return false;
    }

    const qualityScore = Number(question?.qualityScore);
    if (Number.isFinite(qualityScore) && qualityScore < OBJECTIVE_MIN_USABLE_QUALITY_SCORE) {
        return false;
    }

    const clarityScore = Number(question?.clarityScore);
    if (Number.isFinite(clarityScore) && clarityScore < OBJECTIVE_MIN_USABLE_CLARITY_SCORE) {
        return false;
    }

    const distractorScore = Number(question?.distractorScore);
    if (Number.isFinite(distractorScore) && distractorScore < OBJECTIVE_MIN_USABLE_DISTRACTOR_SCORE) {
        return false;
    }

    const qualityTier = normalizeQualityTier(question?.qualityTier);
    if (question?.qualityTier !== undefined && qualityTier === QUALITY_TIER_UNAVAILABLE) {
        return false;
    }

    return true;
};

export const isUsableExamQuestion = (question, { allowEssay = false } = {}) => {
    if (!question || typeof question !== "object") return false;
    const normalizedQuestionText = String(question.questionText || "").replace(/\s+/g, " ").trim();
    if (normalizedQuestionText.length < 12) return false;
    if (hasSevereQuestionContentIssue(question)) return false;
    if (hasSevereQualityFlag(question)) return false;
    const questionType = normalizeQuestionType(question.questionType);
    if (allowEssay && isEssayQuestionType(questionType)) {
        return String(question.correctAnswer || "").trim().length > 0;
    }
    if (!hasMinimumObjectiveQuality(question)) {
        return false;
    }
    if (questionType === QUESTION_TYPE_TRUE_FALSE) {
        return hasUsableTrueFalseOptions(question.options);
    }
    if (questionType === QUESTION_TYPE_FILL_BLANK) {
        return hasUsableFillBlankQuestion(question);
    }
    if (questionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
        return hasUsableExamOptions(question.options);
    }
    return false;
};

export const sanitizeExamQuestionForClient = (question) => {
    if (!question || typeof question !== "object") return question;
    if (isEssayQuestionType(question.questionType)) {
        const {
            correctAnswer: _CORRECT_ANSWER,
            explanation: _EXPLANATION,
            citations: _CITATIONS,
            sourcePassageIds: _SOURCE_PASSAGE_IDS,
            groundingScore: _GROUNDING_SCORE,
            factualityStatus: _FACTUALITY_STATUS,
            generationVersion: _GENERATION_VERSION,
            rubricPoints: _RUBRIC_POINTS,
            qualityFlags: _QUALITY_FLAGS,
            ...safeQuestion
        } = question;
        return safeQuestion;
    }
    const {
        correctAnswer: _CORRECT_ANSWER,
        acceptedAnswers: _ACCEPTED_ANSWERS,
        citations: _CITATIONS,
        sourcePassageIds: _SOURCE_PASSAGE_IDS,
        groundingScore: _GROUNDING_SCORE,
        factualityStatus: _FACTUALITY_STATUS,
        generationVersion: _GENERATION_VERSION,
        rubricPoints: _RUBRIC_POINTS,
        qualityFlags: _QUALITY_FLAGS,
        options,
        ...safeQuestion
    } = question;
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
    const denominator = safeTotal > 0 ? safeTotal : safeFallback > 0 ? safeFallback : 0;
    if (denominator === 0) return 0;
    return Math.min(100, Math.round((safeScore / denominator) * 100));
};
