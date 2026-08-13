import { jaccardSimilarity } from "./questionDedup.js";

const answerText = (question) => {
    if (question?.questionType === "ordering") {
        return (question.stepsInOrder || question.payload?.stepsInOrder || []).join(" ");
    }
    const options = Array.isArray(question?.options) ? question.options : [];
    return String(options[question?.correctIndex] || "");
};

const isGrounded = (question, source) => {
    const haystack = String(source || "").toLowerCase();
    const tokens = String(answerText(question) || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length >= 4);
    if (tokens.length === 0) return haystack.includes(String(answerText(question) || "").toLowerCase());
    return tokens.some((token) => haystack.includes(token));
};

export const scoreCourseCurriculum = (curriculum, { sourceText = "", expectProcess = false } = {}) => {
    const topics = Array.isArray(curriculum?.topics) ? curriculum.topics : [];
    const questions = topics.flatMap((topic) =>
        (Array.isArray(topic.questions) ? topic.questions : []).map((question) => ({
            ...question,
            topicTitle: topic.title,
            topicContent: topic.content,
        })),
    );
    const mcqs = questions.filter((question) => question.questionType !== "ordering");
    const ordering = questions.filter((question) => question.questionType === "ordering");
    let duplicatePairs = 0;
    for (let i = 0; i < mcqs.length; i += 1) {
        for (let j = i + 1; j < mcqs.length; j += 1) {
            if (jaccardSimilarity(mcqs[i].prompt, mcqs[j].prompt) >= 0.5) duplicatePairs += 1;
        }
    }
    const groundedCount = mcqs.filter((question) =>
        isGrounded(question, question.topicContent || sourceText),
    ).length;
    const structureOk =
        topics.length >= 1 &&
        topics.every(
            (topic) =>
                String(topic.title || "").trim() &&
                String(topic.content || "").trim().length >= 40 &&
                Array.isArray(topic.questions),
        );
    const processOk = !expectProcess || ordering.length >= 1;
    return {
        topicCount: topics.length,
        questionCount: mcqs.length,
        orderingCount: ordering.length,
        duplicatePairs,
        groundedCount,
        groundedRatio: mcqs.length ? groundedCount / mcqs.length : 1,
        structureOk,
        processOk,
        expectProcess,
    };
};
