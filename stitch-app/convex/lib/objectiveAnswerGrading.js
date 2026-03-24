"use node";

import {
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
    normalizeQuestionType,
} from "./objectiveExam.js";

const normalizeText = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const normalizeOptionLabel = (value) => {
    const normalized = String(value || "").trim().toUpperCase();
    return /^[A-Z]$/.test(normalized) ? normalized : "";
};

const coerceOptions = (rawOptions) => {
    if (!Array.isArray(rawOptions)) return [];
    return rawOptions
        .map((option, index) => {
            if (!option || typeof option !== "object") return null;
            const label = normalizeOptionLabel(option.label || String.fromCharCode(65 + index));
            const text = String(option.text || option.value || "").replace(/\s+/g, " ").trim();
            if (!label || !text) return null;
            return {
                ...option,
                label,
                text,
            };
        })
        .filter(Boolean);
};

const findOptionMatch = (options, submittedAnswer) => {
    const normalizedAnswer = normalizeText(submittedAnswer);
    const normalizedLabel = normalizeOptionLabel(submittedAnswer);
    if (!normalizedAnswer && !normalizedLabel) return null;
    return options.find((option) => {
        const optionLabel = normalizeOptionLabel(option.label);
        const optionText = normalizeText(option.text);
        return (
            (normalizedLabel && optionLabel === normalizedLabel)
            || (normalizedAnswer && optionText === normalizedAnswer)
        );
    }) || null;
};

const getCorrectOption = (question) =>
    coerceOptions(question?.options).find((option) => option?.isCorrect === true) || null;

export const getAcceptedFillBlankAnswers = (question) => {
    const explicitAnswers = Array.isArray(question?.acceptedAnswers)
        ? question.acceptedAnswers
        : [];
    const normalized = explicitAnswers
        .map((answer) => String(answer || "").trim())
        .filter(Boolean);
    if (normalized.length > 0) {
        return normalized;
    }
    const fallbackAnswer = String(question?.correctAnswer || "").trim();
    return fallbackAnswer ? [fallbackAnswer] : [];
};

export const resolveObjectiveCorrectAnswer = (question) => {
    const questionType = normalizeQuestionType(question?.questionType);
    if (questionType === QUESTION_TYPE_FILL_BLANK) {
        return getAcceptedFillBlankAnswers(question)[0] || "";
    }

    const correctOption = getCorrectOption(question);
    if (!correctOption) {
        return String(question?.correctAnswer || "").trim();
    }

    if (questionType === QUESTION_TYPE_TRUE_FALSE) {
        return normalizeOptionLabel(correctOption.label) || String(question?.correctAnswer || "").trim();
    }

    return normalizeOptionLabel(question?.correctAnswer) || normalizeOptionLabel(correctOption.label);
};

export const evaluateDeterministicObjectiveAnswer = ({
    question,
    selectedAnswer,
}) => {
    const questionType = normalizeQuestionType(question?.questionType);
    const trimmedSelectedAnswer = String(selectedAnswer || "").trim();
    const skipped = !trimmedSelectedAnswer;

    if (skipped) {
        return {
            questionType,
            skipped: true,
            isCorrect: false,
            shouldAiGrade: false,
            selectedAnswer: "",
            correctAnswer: resolveObjectiveCorrectAnswer(question),
        };
    }

    if (questionType === QUESTION_TYPE_FILL_BLANK) {
        const acceptedAnswers = getAcceptedFillBlankAnswers(question);
        const normalizedSelected = normalizeText(trimmedSelectedAnswer);
        const matchedAnswer = acceptedAnswers.find(
            (answer) => normalizeText(answer) === normalizedSelected
        );
        const isCorrect = Boolean(matchedAnswer);
        const fillBlankMode = String(question?.fillBlankMode || "").trim().toLowerCase();
        return {
            questionType,
            skipped: false,
            isCorrect,
            shouldAiGrade: !isCorrect && fillBlankMode === "free_text",
            selectedAnswer: trimmedSelectedAnswer,
            correctAnswer: acceptedAnswers[0] || String(question?.correctAnswer || "").trim(),
            matchedAnswer: matchedAnswer || null,
        };
    }

    const options = coerceOptions(question?.options);
    const matchedOption = findOptionMatch(options, trimmedSelectedAnswer);
    const correctOption = getCorrectOption(question);
    const canonicalSelected = matchedOption
        ? normalizeOptionLabel(matchedOption.label)
        : normalizeOptionLabel(trimmedSelectedAnswer) || trimmedSelectedAnswer;
    const canonicalCorrect = resolveObjectiveCorrectAnswer(question);
    const isCorrect = Boolean(
        matchedOption
        && correctOption
        && normalizeOptionLabel(matchedOption.label) === normalizeOptionLabel(correctOption.label)
    );

    return {
        questionType,
        skipped: false,
        isCorrect,
        shouldAiGrade: false,
        selectedAnswer: canonicalSelected,
        correctAnswer: canonicalCorrect,
    };
};
