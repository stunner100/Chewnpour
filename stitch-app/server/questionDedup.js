const STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "is",
    "are",
    "was",
    "were",
    "this",
    "that",
    "which",
    "what",
    "how",
    "from",
    "according",
]);

export const tokenizePrompt = (value) => {
    const tokens = String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9]+/g);
    if (!tokens) return [];
    return tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
};

export const jaccardSimilarity = (left, right) => {
    const a = new Set(tokenizePrompt(left));
    const b = new Set(tokenizePrompt(right));
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const token of a) {
        if (b.has(token)) intersection += 1;
    }
    return intersection / (a.size + b.size - intersection);
};

export const isNearDuplicatePrompt = (left, right, threshold = 0.5) =>
    jaccardSimilarity(left, right) >= threshold;

export const isPromptNearTitle = (prompt, title, threshold = 0.72) => {
    const titleTokens = tokenizePrompt(title);
    if (titleTokens.length < 3) return false;
    return jaccardSimilarity(prompt, title) >= threshold;
};

export const hasDuplicateOptions = (options) => {
    const seen = new Set();
    for (const option of Array.isArray(options) ? options : []) {
        const key = String(option || "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        if (!key) continue;
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
};

export const isValidMcq = (question, { title = "" } = {}) => {
    if (question?.questionType && question.questionType !== "multiple_choice") {
        return false;
    }
    const prompt = String(question?.prompt || "").trim();
    const options = Array.isArray(question?.options) ? question.options : [];
    const correctIndex = Number(question?.correctIndex);
    if (!prompt || prompt.length < 12) return false;
    if (options.length < 2) return false;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        return false;
    }
    if (hasDuplicateOptions(options)) return false;
    if (title && isPromptNearTitle(prompt, title)) return false;
    return true;
};

export const dedupeQuestionList = (questions, { title = "", threshold = 0.5 } = {}) => {
    const kept = [];
    for (const question of Array.isArray(questions) ? questions : []) {
        if (!isValidMcq(question, { title })) continue;
        const duplicate = kept.some((existing) =>
            isNearDuplicatePrompt(existing.prompt, question.prompt, threshold),
        );
        if (duplicate) continue;
        kept.push({
            ...question,
            sortOrder: kept.length,
        });
    }
    return kept;
};

export const dedupeCourseTopics = (topics, { threshold = 0.5 } = {}) => {
    const seen = [];
    return (Array.isArray(topics) ? topics : []).map((topic) => {
        const title = String(topic?.title || "");
        const incoming = Array.isArray(topic?.questions) ? topic.questions : [];
        const ordering = incoming.find((question) => question?.questionType === "ordering") || null;
        const questions = [];
        for (const question of incoming) {
            if (question?.questionType === "ordering") continue;
            if (!isValidMcq(question, { title })) continue;
            const duplicateInTopic = questions.some((existing) =>
                isNearDuplicatePrompt(existing.prompt, question.prompt, threshold),
            );
            const duplicateInCourse = seen.some((existing) =>
                isNearDuplicatePrompt(existing.prompt, question.prompt, threshold),
            );
            if (duplicateInTopic || duplicateInCourse) continue;
            const next = { ...question, questionType: "multiple_choice", sortOrder: questions.length };
            questions.push(next);
            seen.push(next);
        }
        if (ordering) {
            questions.push({ ...ordering, sortOrder: questions.length });
        }
        return {
            ...topic,
            questions,
            orderingCheck: ordering || topic?.orderingCheck || null,
        };
    });
};
