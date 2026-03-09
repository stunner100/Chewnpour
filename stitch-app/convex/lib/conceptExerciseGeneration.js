export const normalizeConceptTextKey = (value) => {
    return String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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

export const buildConceptExerciseKey = (exercise, options = {}) => {
    const includeTemplate = options?.includeTemplate !== false;
    const questionKey = normalizeConceptTextKey(exercise?.questionText || "");
    const answers = normalizeAnswers(exercise?.answers);
    const orderedAnswersKey = answers.join("|");
    const sortedAnswersKey = [...answers].sort().join("|");
    const templateKey = includeTemplate ? normalizeTemplateKey(exercise?.template) : "";

    const parts = [questionKey ? `q:${questionKey}` : ""];
    if (templateKey) parts.push(`t:${templateKey}`);
    if (orderedAnswersKey) parts.push(`ao:${orderedAnswersKey}`);
    if (sortedAnswersKey) parts.push(`as:${sortedAnswersKey}`);

    return parts.filter(Boolean).join("::");
};
