const GENERIC_HINTS = {
    multiple_choice:
        "Look for the distinguishing detail that separates the supported option from the distractors.",
    ordering: "Trace the sequence described in the lesson before placing the steps.",
    true_false: "Compare the statement against the specific facts in the lesson.",
    default: "Focus on the specific term, number, or relationship in the lesson.",
};

const normalize = (value) =>
    String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const containsPhrase = (haystack, needle) => {
    const hint = normalize(haystack);
    const phrase = normalize(needle);
    if (!hint || !phrase || phrase.length < 4) return false;
    return hint.includes(phrase);
};

const uniqueOptionTerms = (options, correctIndex) => {
    if (!Array.isArray(options) || options.length < 2) return [];
    const correct = normalize(options[correctIndex]);
    if (!correct) return [];
    const distractor = new Set(
        options
            .filter((_, index) => index !== correctIndex)
            .flatMap((option) => normalize(option).split(" "))
            .filter((token) => token.length >= 5),
    );
    return correct
        .split(" ")
        .filter((token) => token.length >= 5 && !distractor.has(token));
};

export const fallbackHintForType = (questionType) =>
    GENERIC_HINTS[questionType] || GENERIC_HINTS.default;

export const hintLeaksAnswer = ({
    hint,
    questionType = "multiple_choice",
    answer,
    options = [],
    correctIndex = 0,
    stepsInOrder = [],
}) => {
    const text = String(hint || "").trim();
    if (!text) return false;
    const normalizedHint = ` ${normalize(text)} `;

    if (questionType === "true_false") {
        const verdict = answer === true || answer === "true" || answer === "True";
        if (verdict && /\b(statement|claim|answer)\s+(is|would be)\s+(true|correct)\b/.test(normalizedHint)) {
            return true;
        }
        if (!verdict && /\b(statement|claim|answer)\s+(is|would be)\s+(false|incorrect|wrong)\b/.test(normalizedHint)) {
            return true;
        }
    }

    if (questionType === "multiple_choice") {
        const correct = Array.isArray(options) ? options[correctIndex] : answer;
        if (containsPhrase(text, correct)) return true;
        const unique = uniqueOptionTerms(options, correctIndex);
        if (unique.some((term) => normalizedHint.includes(` ${term} `))) return true;
    }

    if (questionType === "ordering") {
        const steps = (Array.isArray(stepsInOrder) ? stepsInOrder : []).map((step) =>
            normalize(step),
        );
        if (steps.length >= 2 && steps.every((step) => step && normalize(text).includes(step))) {
            const positions = steps.map((step) => normalize(text).indexOf(step));
            const inOrder = positions.every(
                (position, index) => index === 0 || position > positions[index - 1],
            );
            if (inOrder) return true;
        }
    }

    if (typeof answer === "string" && containsPhrase(text, answer)) return true;
    return false;
};

export const sanitizeGeneratedHint = (input) => {
    const fallback = fallbackHintForType(input?.questionType);
    const hint = String(input?.hint || "").trim();
    if (!hint) return fallback;
    return hintLeaksAnswer(input) ? fallback : hint;
};
