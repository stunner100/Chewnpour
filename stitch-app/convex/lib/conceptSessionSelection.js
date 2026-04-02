import {
    buildConceptExerciseKey,
    CONCEPT_EXERCISE_TYPE_CLOZE,
    CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH,
    CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK,
    deriveConceptKey,
    getConceptExerciseCorrectAnswers,
    normalizeConceptDifficulty,
    normalizeConceptExerciseType,
    normalizeConceptTextKey,
} from "./conceptExerciseGeneration.js";

const EXERCISE_TYPE_PRIORITY = [
    CONCEPT_EXERCISE_TYPE_CLOZE,
    CONCEPT_EXERCISE_TYPE_DEFINITION_MATCH,
    CONCEPT_EXERCISE_TYPE_MISCONCEPTION_CHECK,
];

const DIFFICULTY_PRIORITY = ["easy", "medium", "hard"];

const buildFallbackKey = (exercise, index) => {
    const questionText = String(exercise?.questionText || "").trim();
    if (questionText) {
        return `fallback:${questionText.toLowerCase()}`;
    }
    return `fallback:index:${index}`;
};

const normalizeOptionsForSession = (options) => {
    const items = Array.isArray(options) ? options : [];
    const seen = new Set();
    const normalized = [];

    items.forEach((option, index) => {
        const text = String(option?.text || option || "").replace(/\s+/g, " ").trim();
        const key = normalizeConceptTextKey(text);
        if (!text || !key || seen.has(key)) return;
        seen.add(key);
        normalized.push({
            id: String(option?.id || `option-${index + 1}`),
            text,
        });
    });

    return normalized;
};

const decorateExercise = (exercise, index) => {
    if (!exercise || typeof exercise !== "object") return null;

    const exerciseType = normalizeConceptExerciseType(exercise.exerciseType);
    const correctAnswers = getConceptExerciseCorrectAnswers(exercise);
    const options = normalizeOptionsForSession(exercise.options);
    const explicitCorrectOptionId = String(exercise?.correctOptionId || "").trim();
    const correctOptionId = exerciseType === CONCEPT_EXERCISE_TYPE_CLOZE
        ? undefined
        : explicitCorrectOptionId
            || options.find((option) => normalizeConceptTextKey(option.text) === correctAnswers[0])?.id
            || undefined;
    const conceptKey = deriveConceptKey(
        exercise?.conceptKey,
        correctAnswers[0],
        exercise?.questionText,
    );
    const exerciseKey =
        buildConceptExerciseKey(
            {
                ...exercise,
                exerciseType,
                conceptKey,
                options,
                correctOptionId,
                answers: exerciseType === CONCEPT_EXERCISE_TYPE_CLOZE
                    ? Array.isArray(exercise?.answers) ? exercise.answers : []
                    : correctAnswers,
            },
            { includeTemplate: false }
        )
        || buildFallbackKey(exercise, index);

    return {
        ...exercise,
        exerciseType,
        conceptKey,
        difficulty: normalizeConceptDifficulty(exercise?.difficulty),
        explanation: String(exercise?.explanation || "").replace(/\s+/g, " ").trim(),
        options,
        correctOptionId,
        active: exercise?.active !== false,
        exerciseKey,
        answers: exerciseType === CONCEPT_EXERCISE_TYPE_CLOZE
            ? Array.isArray(exercise?.answers) ? exercise.answers : []
            : correctAnswers,
    };
};

export const dedupeConceptExercises = (exercises = []) => {
    const items = Array.isArray(exercises) ? exercises : [];
    const deduped = [];
    const seenKeys = new Set();

    items.forEach((exercise, index) => {
        const decorated = decorateExercise(exercise, index);
        if (!decorated) return;
        if (seenKeys.has(decorated.exerciseKey)) return;
        seenKeys.add(decorated.exerciseKey);
        deduped.push(decorated);
    });

    return deduped;
};

export const summarizeConceptExerciseBank = (exercises = []) => {
    const activeExercises = dedupeConceptExercises(exercises).filter((exercise) => exercise.active !== false);
    const exerciseTypes = new Set();
    const conceptKeys = new Set();

    activeExercises.forEach((exercise) => {
        exerciseTypes.add(exercise.exerciseType || CONCEPT_EXERCISE_TYPE_CLOZE);
        if (exercise.conceptKey) {
            conceptKeys.add(exercise.conceptKey);
        }
    });

    return {
        activeCount: activeExercises.length,
        exerciseTypeCount: exerciseTypes.size,
        conceptKeyCount: conceptKeys.size,
        exerciseTypes: Array.from(exerciseTypes),
        conceptKeys: Array.from(conceptKeys),
    };
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
                        exerciseType: item?.exerciseType,
                        conceptKey: item?.conceptKey,
                        questionText: item?.questionText,
                        answers: item?.correctAnswers,
                        template: item?.template,
                        options: item?.options,
                        correctOptionId: item?.correctOptionId,
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

const buildSelectionState = (selected = []) => {
    const typeCounts = new Map();
    const conceptCounts = new Map();
    const difficultyCounts = new Map();

    selected.forEach((exercise) => {
        const exerciseType = exercise.exerciseType || CONCEPT_EXERCISE_TYPE_CLOZE;
        typeCounts.set(exerciseType, (typeCounts.get(exerciseType) || 0) + 1);
        if (exercise.conceptKey) {
            conceptCounts.set(exercise.conceptKey, (conceptCounts.get(exercise.conceptKey) || 0) + 1);
        }
        const difficulty = normalizeConceptDifficulty(exercise.difficulty);
        difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1);
    });

    return {
        typeCounts,
        conceptCounts,
        difficultyCounts,
    };
};

const getPriorityIndex = (value, list) => {
    const index = list.indexOf(value);
    return index === -1 ? list.length : index;
};

const scoreConceptExercise = (exercise, selectionState, attemptedKeys) => {
    const exerciseType = exercise.exerciseType || CONCEPT_EXERCISE_TYPE_CLOZE;
    const conceptKey = exercise.conceptKey || deriveConceptKey(exercise.questionText);
    const difficulty = normalizeConceptDifficulty(exercise.difficulty);
    const typeCount = selectionState.typeCounts.get(exerciseType) || 0;
    const conceptCount = selectionState.conceptCounts.get(conceptKey) || 0;
    const difficultyCount = selectionState.difficultyCounts.get(difficulty) || 0;
    const unseenBoost = attemptedKeys.has(exercise.exerciseKey) ? 0 : 1_000;
    const activeBoost = exercise.active === false ? -500 : 80;
    const typeBoost = typeCount === 0 ? 240 : Math.max(0, 90 - (typeCount * 40));
    const conceptBoost = conceptCount === 0 ? 180 : Math.max(0, 60 - (conceptCount * 30));
    const difficultyBoost = difficultyCount === 0 ? 35 : Math.max(0, 12 - (difficultyCount * 6));
    const typeOrderBoost = EXERCISE_TYPE_PRIORITY.length - getPriorityIndex(exerciseType, EXERCISE_TYPE_PRIORITY);
    const difficultyOrderBoost = DIFFICULTY_PRIORITY.length - getPriorityIndex(difficulty, DIFFICULTY_PRIORITY);
    const qualityBoost = Math.round((Number(exercise.qualityScore || 0) + Number(exercise.groundingScore || 0)) * 20);
    const freshnessBoost = Number(exercise.createdAt || 0) / 1e12;

    return unseenBoost
        + activeBoost
        + typeBoost
        + conceptBoost
        + difficultyBoost
        + (typeOrderBoost * 6)
        + (difficultyOrderBoost * 3)
        + qualityBoost
        + freshnessBoost;
};

export const buildConceptSessionItems = ({
    bankExercises = [],
    attempts = [],
    sessionSize = 5,
} = {}) => {
    const normalizedSize = Math.max(1, Math.floor(Number(sessionSize) || 1));
    const dedupedExercises = dedupeConceptExercises(bankExercises).filter((exercise) => exercise.active !== false);
    const attemptedKeys = new Set(extractAttemptedConceptExerciseKeys(attempts));
    const selected = [];
    const usedExerciseKeys = new Set();

    while (selected.length < normalizedSize) {
        const selectionState = buildSelectionState(selected);
        const remaining = dedupedExercises
            .filter((exercise) => !usedExerciseKeys.has(exercise.exerciseKey))
            .map((exercise, index) => ({
                exercise,
                index,
                score: scoreConceptExercise(exercise, selectionState, attemptedKeys),
            }))
            .sort((left, right) => {
                if (right.score !== left.score) return right.score - left.score;
                return left.index - right.index;
            });

        if (remaining.length === 0) break;

        const winner = remaining[0].exercise;
        usedExerciseKeys.add(winner.exerciseKey);
        selected.push(winner);
    }

    return selected;
};
