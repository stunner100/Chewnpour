import {
    areMcqQuestionsNearDuplicate,
    areQuestionPromptsNearDuplicate,
    buildMcqUniquenessSignature,
    buildQuestionPromptSignature,
    normalizeQuestionPromptKey,
} from "./mcqUniqueness.js";

const DIFFICULTY_DISTRIBUTION = { easy: 0.3, medium: 0.5, hard: 0.2 };

const pickRandomSubset = (items, size) => {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied.slice(0, Math.max(0, size));
};

const pickDifficultyBalancedSubset = (items, size) => {
    if (items.length <= size) return [...items];

    const buckets = { easy: [], medium: [], hard: [] };
    for (const item of items) {
        const difficulty = String(item?.difficulty || "medium").toLowerCase();
        (buckets[difficulty] || buckets.medium).push(item);
    }

    const easyTarget = Math.floor(size * DIFFICULTY_DISTRIBUTION.easy);
    const hardTarget = Math.floor(size * DIFFICULTY_DISTRIBUTION.hard);
    const mediumTarget = size - easyTarget - hardTarget;

    const selected = [
        ...pickRandomSubset(buckets.easy, easyTarget),
        ...pickRandomSubset(buckets.medium, mediumTarget),
        ...pickRandomSubset(buckets.hard, hardTarget),
    ];

    if (selected.length < size) {
        const selectedSet = new Set(selected);
        const remaining = items.filter((item) => !selectedSet.has(item));
        selected.push(...pickRandomSubset(remaining, size - selected.length));
    }

    return selected.slice(0, size);
};

export const dedupeQuestionsByPrompt = (questions) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenPromptKeys = new Set();
    const seenFingerprints = new Set();
    const acceptedSignatures = [];
    const acceptedMcqSignatures = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        const signature = buildQuestionPromptSignature(question.questionText);
        const normalizedPrompt = signature.normalized || normalizeQuestionPromptKey(question.questionText);
        const fallbackKey = String(question._id || "");
        const dedupeKey = normalizedPrompt || fallbackKey;
        if (!dedupeKey) continue;
        if (seenPromptKeys.has(dedupeKey)) continue;
        if (signature.fingerprint && seenFingerprints.has(signature.fingerprint)) continue;
        if (
            signature.normalized
            && acceptedSignatures.some((prior) => areQuestionPromptsNearDuplicate(signature, prior))
        ) {
            continue;
        }
        if (
            String(question?.questionType || "") !== "essay"
            && acceptedMcqSignatures.some((prior) =>
                areMcqQuestionsNearDuplicate(buildMcqUniquenessSignature(question), prior)
            )
        ) {
            continue;
        }
        seenPromptKeys.add(dedupeKey);
        if (signature.fingerprint) {
            seenFingerprints.add(signature.fingerprint);
        }
        if (signature.normalized) {
            acceptedSignatures.push(signature);
        }
        if (String(question?.questionType || "") !== "essay") {
            acceptedMcqSignatures.push(buildMcqUniquenessSignature(question));
        }
        deduped.push(question);
    }

    return deduped;
};

const buildSeenQuestionIdsFromCompletedAttempts = (recentAttempts, examFormat) => {
    const attempts = Array.isArray(recentAttempts) ? recentAttempts : [];
    const normalizedFormat = String(examFormat || "").trim().toLowerCase();

    // Filter to only same-format completed attempts so MCQ history doesn't
    // pollute the essay seen-set (and vice versa).
    const completedAttempts = attempts.filter((attempt) => {
        const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
        if (answers.length === 0) return false;
        if (normalizedFormat) {
            const attemptFormat = String(attempt?.examFormat || "").trim().toLowerCase();
            if (attemptFormat && attemptFormat !== normalizedFormat) return false;
        }
        return true;
    });

    // Track question IDs ordered by recency (most recent attempt first) so we
    // can prioritise least-recently-seen questions when the bank is exhausted.
    const seenQuestionIds = new Set();
    const questionLastSeenOrder = new Map(); // questionId -> recency rank (lower = more recent)
    let rank = 0;
    for (const attempt of completedAttempts) {
        const questionIds = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
        for (const questionId of questionIds) {
            const key = String(questionId);
            seenQuestionIds.add(key);
            if (!questionLastSeenOrder.has(key)) {
                questionLastSeenOrder.set(key, rank);
            }
        }
        rank += 1;
    }

    return {
        seenQuestionIds,
        questionLastSeenOrder,
        completedAttemptCount: completedAttempts.length,
    };
};

const pickExamSubset = (questions, subsetSize, isEssay) => {
    const safeSubsetSize = Math.max(0, Number(subsetSize || 0));
    if (questions.length <= safeSubsetSize) return [...questions];
    return isEssay
        ? pickRandomSubset(questions, safeSubsetSize)
        : pickDifficultyBalancedSubset(questions, safeSubsetSize);
};

export const selectQuestionsForAttempt = ({
    questions,
    recentAttempts,
    subsetSize,
    isEssay,
    examFormat,
}) => {
    const dedupedQuestions = dedupeQuestionsByPrompt(questions);
    const effectiveFormat = examFormat || (isEssay ? "essay" : "mcq");
    const { seenQuestionIds, questionLastSeenOrder, completedAttemptCount } =
        buildSeenQuestionIdsFromCompletedAttempts(recentAttempts, effectiveFormat);
    const unseenQuestions = dedupedQuestions.filter(
        (question) => !seenQuestionIds.has(String(question?._id))
    );

    const targetSize = Math.max(0, Number(subsetSize || 0));

    // First attempt — no history, serve from full pool.
    if (completedAttemptCount === 0) {
        const selectedQuestions = pickExamSubset(dedupedQuestions, targetSize, Boolean(isEssay));
        return {
            selectedQuestions,
            dedupedCount: dedupedQuestions.length,
            unseenCount: unseenQuestions.length,
            completedAttemptCount,
            requiresFreshGeneration: false,
        };
    }

    // Retake — prefer unseen questions.
    if (unseenQuestions.length >= targetSize) {
        // Enough unseen questions to fill the exam entirely with fresh ones.
        const selectedQuestions = pickExamSubset(unseenQuestions, targetSize, Boolean(isEssay));
        return {
            selectedQuestions,
            dedupedCount: dedupedQuestions.length,
            unseenCount: unseenQuestions.length,
            completedAttemptCount,
            requiresFreshGeneration: false,
        };
    }

    // Not enough unseen questions. Rather than blocking with "preparing...",
    // fill with unseen first, then pad with least-recently-seen questions so
    // the user always gets an exam. Also trigger fresh generation in the background.
    if (unseenQuestions.length > 0 || dedupedQuestions.length > 0) {
        const selected = [...unseenQuestions];
        const remainingNeeded = targetSize - selected.length;

        if (remainingNeeded > 0) {
            // Sort seen questions by staleness — highest rank = seen longest ago.
            const seenQuestions = dedupedQuestions
                .filter((q) => seenQuestionIds.has(String(q?._id)))
                .sort((a, b) => {
                    const rankA = questionLastSeenOrder.get(String(a?._id)) ?? Infinity;
                    const rankB = questionLastSeenOrder.get(String(b?._id)) ?? Infinity;
                    return rankB - rankA; // highest rank (oldest) first
                });
            selected.push(...seenQuestions.slice(0, remainingNeeded));
        }

        // Shuffle the combined set so unseen and recycled questions are interleaved.
        const selectedQuestions = pickExamSubset(selected, targetSize, Boolean(isEssay));
        return {
            selectedQuestions,
            dedupedCount: dedupedQuestions.length,
            unseenCount: unseenQuestions.length,
            completedAttemptCount,
            // Signal that the bank needs expansion, but don't block the exam.
            requiresFreshGeneration: unseenQuestions.length === 0,
        };
    }

    // Truly empty pool — no questions at all.
    return {
        selectedQuestions: [],
        dedupedCount: 0,
        unseenCount: 0,
        completedAttemptCount,
        requiresFreshGeneration: true,
    };
};
