import { buildConceptExerciseKey } from "./conceptExerciseGeneration.js";

const buildFallbackKey = (exercise, index) => {
    const questionText = String(exercise?.questionText || "").trim();
    if (questionText) {
        return `fallback:${questionText.toLowerCase()}`;
    }
    return `fallback:index:${index}`;
};

const decorateExercise = (exercise, index) => {
    const exerciseKey =
        buildConceptExerciseKey(exercise, { includeTemplate: false })
        || buildFallbackKey(exercise, index);

    return {
        ...exercise,
        exerciseKey,
    };
};

export const dedupeConceptExercises = (exercises = []) => {
    const items = Array.isArray(exercises) ? exercises : [];
    const deduped = [];
    const seenKeys = new Set();

    items.forEach((exercise, index) => {
        if (!exercise || typeof exercise !== "object") return;
        const decorated = decorateExercise(exercise, index);
        if (seenKeys.has(decorated.exerciseKey)) return;
        seenKeys.add(decorated.exerciseKey);
        deduped.push(decorated);
    });

    return deduped;
};

export const extractAttemptedConceptExerciseKeys = (attempts = []) => {
    const items = Array.isArray(attempts) ? attempts : [];
    const seenKeys = new Set();

    for (const attempt of items) {
        const sessionItems = Array.isArray(attempt?.answers?.items)
            ? attempt.answers.items
            : [];

        for (const item of sessionItems) {
            const sessionKey =
                String(item?.exerciseKey || "").trim()
                || buildConceptExerciseKey(
                    {
                        questionText: item?.questionText,
                        answers: item?.correctAnswers,
                        template: item?.template,
                    },
                    { includeTemplate: false }
                );
            if (sessionKey) {
                seenKeys.add(sessionKey);
            }
        }

        const legacyKey = buildConceptExerciseKey(
            {
                questionText: attempt?.questionText,
                answers: attempt?.answers?.correctAnswers,
            },
            { includeTemplate: false }
        );
        if (legacyKey) {
            seenKeys.add(legacyKey);
        }
    }

    return Array.from(seenKeys);
};

export const buildConceptSessionItems = ({
    bankExercises = [],
    attempts = [],
    sessionSize = 5,
} = {}) => {
    const normalizedSize = Math.max(1, Math.floor(Number(sessionSize) || 1));
    const dedupedExercises = dedupeConceptExercises(bankExercises);
    const attemptedKeys = new Set(extractAttemptedConceptExerciseKeys(attempts));

    const unseen = dedupedExercises.filter((exercise) => !attemptedKeys.has(exercise.exerciseKey));
    const seen = dedupedExercises.filter((exercise) => attemptedKeys.has(exercise.exerciseKey));

    return [...unseen, ...seen].slice(0, normalizedSize);
};
