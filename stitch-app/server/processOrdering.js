const PROCESS_LANGUAGE =
    /\b(first|then|next|finally|after|before|step|steps|sequence|process|pipeline|workflow|stage|stages|followed by)\b/i;

export const snippetHasProcess = (text) => PROCESS_LANGUAGE.test(String(text || ""));

export const normalizeOrderingQuestion = (raw, { sourceText = "" } = {}) => {
    const prompt = String(raw?.prompt || raw?.question || "").trim().slice(0, 400);
    const steps = (Array.isArray(raw?.stepsInOrder) ? raw.stepsInOrder : [])
        .map((step) => String(step || "").replace(/\s+/g, " ").trim())
        .filter((step) => step.length >= 3)
        .slice(0, 3);
    if (!prompt || steps.length !== 3) return null;
    if (new Set(steps.map((step) => step.toLowerCase())).size !== 3) return null;
    const source = String(sourceText || "").toLowerCase();
    const grounded = source
        ? steps.every((step) => {
              const tokens = step
                  .toLowerCase()
                  .split(/\s+/)
                  .filter((token) => token.length >= 4);
              if (tokens.length === 0) return source.includes(step.toLowerCase());
              return tokens.some((token) => source.includes(token));
          })
        : true;
    if (!grounded) return null;
    return {
        questionType: "ordering",
        prompt,
        options: steps,
        correctIndex: 0,
        stepsInOrder: steps,
        explanation: String(raw?.explanation || "").trim().slice(0, 500),
        hint: String(raw?.hint || "").trim().slice(0, 280),
        payload: { stepsInOrder: steps },
        sortOrder: 99,
    };
};

export const pickTopicOrdering = (rawOrdering, { content = "", questions = [] } = {}) => {
    if (questions.some((question) => question?.questionType === "ordering")) {
        return questions.find((question) => question.questionType === "ordering") || null;
    }
    if (!snippetHasProcess(content) && !rawOrdering) return null;
    return normalizeOrderingQuestion(rawOrdering, { sourceText: content });
};
