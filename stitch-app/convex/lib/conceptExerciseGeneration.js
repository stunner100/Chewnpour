export const CONCEPT_EXERCISE_TYPE_CLOZE = "cloze";
export const CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH = "definition_match";
export const CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK = "misconception_check";

export const CONCEPT_EXERCISE_TYPES = [
    CONCEPT_EXERCISE_TYPE_CLOZE,
    CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH,
    CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK,
];

export const normalizeConceptTextKey = (value) => {
    return String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

export const normalizeConceptExerciseType = (value) => {
    const normalized = normalizeConceptTextKey(value).replace(/\s+/g, "_");
    if (!normalized) return CONCEPT_EXERCISE_TYPE_CLOZE;
    if (
        normalized === CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH
        || normalized === "match"
        || normalized === "term_match"
        || normalized === "match_term_to_meaning"
    ) {
        return CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH;
    }
    if (
        normalized === CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK
        || normalized === "misconception"
        || normalized === "misconception_fix"
        || normalized === "concept_check"
    ) {
        return CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK;
    }
    return CONCEPT_EXERCISE_TYPE_CLOZE;
};

export const normalizeConceptDifficulty = (value) => {
    const normalized = normalizeConceptTextKey(value);
    if (!normalized) return "medium";
    if (normalized.startsWith("easy")) return "easy";
    if (normalized.startsWith("hard")) return "hard";
    return "medium";
};

export const deriveConceptKey = (...values) => {
    for (const value of values) {
        const normalized = normalizeConceptTextKey(value);
        if (normalized) {
            return normalized.replace(/\s+/g, "_").slice(0, 80);
        }
    }
    return "core_concept";
};

const normalizeTemplateKey = (template) => {
    if (!Array.isArray(template) || template.length === 0) return "";
    return template
        .map((part) => {
            if (part === "__") return "__";
            return normalizeConceptTextKey(part);
        })
        .filter(Boolean)
        .join(" ");
};

const normalizeAnswers = (answers) => {
    if (!Array.isArray(answers) || answers.length === 0) return [];
    return answers
        .map((answer) => normalizeConceptTextKey(answer))
        .filter(Boolean);
};

const normalizeOptions = (options) => {
    const items = Array.isArray(options) ? options : [];
    const seen = new Set();
    const normalized = [];

    items.forEach((option, index) => {
        const text = normalizeConceptTextKey(option?.text || option);
        if (!text || seen.has(text)) return;
        seen.add(text);
        normalized.push({
            id: String(option?.id || `option-${index + 1}`),
            text,
        });
    });

    return normalized;
};

export const getConceptExerciseCorrectAnswers = (exercise) => {
    const exerciseType = normalizeConceptExerciseType(exercise?.exerciseType);
    if (exerciseType === CONCEPT_EXERCISE_TYPE_CLOZE) {
        return normalizeAnswers(exercise?.answers);
    }

    const options = normalizeOptions(exercise?.options);
    const explicitCorrectOptionId = String(exercise?.correctOptionId || "").trim();
    if (explicitCorrectOptionId) {
        const match = options.find((option) => option.id === explicitCorrectOptionId);
        if (match?.text) {
            return [match.text];
        }
    }

    const explicitCorrectText = normalizeConceptTextKey(
        exercise?.correctAnswer
        || exercise?.answer
        || (Array.isArray(exercise?.answers) ? exercise.answers[0] : "")
    );
    if (explicitCorrectText) {
        return [explicitCorrectText];
    }

    return [];
};

export const isConceptChoiceExercise = (exercise) =>
    normalizeConceptExerciseType(exercise?.exerciseType) !== CONCEPT_EXERCISE_TYPE_CLOZE;

export const buildConceptExerciseKey = (exercise, options = {}) => {
    const includeTemplate = options?.includeTemplate !== false;
    const exerciseType = normalizeConceptExerciseType(exercise?.exerciseType);
    const questionKey = normalizeConceptTextKey(exercise?.questionText || "");
    const conceptKey = normalizeConceptTextKey(exercise?.conceptKey || "");
    const answers = getConceptExerciseCorrectAnswers(exercise);
    const orderedAnswersKey = answers.join("|");
    const sortedAnswersKey = [...answers].sort().join("|");
    const hasMeaningfulShape = Boolean(questionKey || conceptKey || orderedAnswersKey);

    const parts = [
        `type:${exerciseType}`,
        questionKey ? `q:${questionKey}` : "",
        conceptKey ? `c:${conceptKey}` : "",
    ];

    if (exerciseType === CONCEPT_EXERCISE_TYPE_CLOZE) {
        const templateKey = includeTemplate ? normalizeTemplateKey(exercise?.template) : "";
        if (templateKey) parts.push(`t:${templateKey}`);
    }

    if (orderedAnswersKey) parts.push(`ao:${orderedAnswersKey}`);
    if (sortedAnswersKey) parts.push(`as:${sortedAnswersKey}`);

    const filteredParts = parts.filter(Boolean);
    if (!hasMeaningfulShape && filteredParts.length <= 1) {
        return "";
    }

    return filteredParts.join("::");
};
