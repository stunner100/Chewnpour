// Answers picked in a topic quiz, kept on the device until the quiz is
// submitted, so a reload or a dropped connection does not wipe them.

const draftKey = (userId, topicId) => `cp:quiz-draft:${userId}:${topicId}`;

const storage = () => {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
};

export const loadQuizDraft = (userId, topicId, questions = []) => {
    const empty = { answers: {}, questionIndex: 0 };
    if (!userId || !topicId) return empty;
    try {
        const raw = storage()?.getItem(draftKey(userId, topicId));
        const draft = raw ? JSON.parse(raw) : null;
        if (!draft || typeof draft.answers !== 'object') return empty;
        // Keep only answers that still match a question and option.
        const answers = {};
        for (const question of questions) {
            const picked = Number(draft.answers[question.id]);
            const optionCount = Array.isArray(question.options) ? question.options.length : 0;
            if (Number.isInteger(picked) && picked >= 0 && picked < optionCount) {
                answers[question.id] = picked;
            }
        }
        const index = Number(draft.questionIndex);
        const questionIndex = Number.isInteger(index) && index >= 0 && index < questions.length ? index : 0;
        return { answers, questionIndex };
    } catch {
        return empty;
    }
};

export const saveQuizDraft = (userId, topicId, { answers, questionIndex }) => {
    if (!userId || !topicId) return;
    try {
        storage()?.setItem(draftKey(userId, topicId), JSON.stringify({ answers, questionIndex }));
    } catch {
        // Storage full or blocked: the quiz still works, it just won't survive a reload.
    }
};

export const clearQuizDraft = (userId, topicId) => {
    if (!userId || !topicId) return;
    try {
        storage()?.removeItem(draftKey(userId, topicId));
    } catch {
        // Nothing to clear.
    }
};
