import {
    areMcqQuestionsNearDuplicate,
    areQuestionPromptsNearDuplicate,
    buildMcqUniquenessSignature,
    buildQuestionPromptSignature,
    normalizeQuestionPromptKey,
} from "./mcqUniqueness.js";
import {
    normalizeAssessmentBlueprint,
    normalizeBloomLevel,
    normalizeOutcomeKey,
} from "./assessmentBlueprint.js";
import { resolveAssessmentGenerationPolicy } from "./assessmentPolicy.js";
import {
    getObjectiveSubtypeTargets,
    normalizeExamFormat,
    normalizeQuestionType,
    OBJECTIVE_EXAM_FORMAT,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
} from "./objectiveExam.js";
import {
    compareQuestionsByPremiumQuality,
    summarizeQuestionSetQuality,
} from "./premiumQuality.js";

const DIFFICULTY_DISTRIBUTION = { easy: 0.1, medium: 0.3, hard: 0.6 };

const sortQuestionsByPremiumQuality = (items) =>
    [...(Array.isArray(items) ? items : [])]
        .sort((left, right) => compareQuestionsByPremiumQuality(left, right));

const pickRandomSubset = (items, size) => {
    return sortQuestionsByPremiumQuality(items).slice(0, Math.max(0, size));
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
        ...pickRandomSubset(sortQuestionsByPremiumQuality(buckets.easy), easyTarget),
        ...pickRandomSubset(sortQuestionsByPremiumQuality(buckets.medium), mediumTarget),
        ...pickRandomSubset(sortQuestionsByPremiumQuality(buckets.hard), hardTarget),
    ];

    if (selected.length < size) {
        const selectedSet = new Set(selected);
        const remainingByDifficulty = {
            medium: sortQuestionsByPremiumQuality(
                buckets.medium.filter((item) => !selectedSet.has(item))
            ),
            hard: sortQuestionsByPremiumQuality(
                buckets.hard.filter((item) => !selectedSet.has(item))
            ),
            easy: sortQuestionsByPremiumQuality(
                buckets.easy.filter((item) => !selectedSet.has(item))
            ),
        };
        for (const difficulty of ["medium", "hard", "easy"]) {
            if (selected.length >= size) break;
            selected.push(
                ...pickRandomSubset(
                    remainingByDifficulty[difficulty],
                    size - selected.length
                )
            );
        }
    }

    return selected.slice(0, size);
};

export const dedupeQuestionsByPrompt = (questions) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenPromptKeys = new Set();
    const seenFingerprints = new Set();
    const acceptedMcqSignatures = [];
    const acceptedObjectivePromptSignatures = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        const normalizedQuestionType = normalizeQuestionType(question?.questionType);
        const signature = buildQuestionPromptSignature(question.questionText);
        const normalizedPrompt = signature.normalized || normalizeQuestionPromptKey(question.questionText);
        const fallbackKey = String(question._id || "");
        const dedupeKey = normalizedPrompt || fallbackKey;
        if (!dedupeKey) continue;
        if (seenPromptKeys.has(dedupeKey)) continue;
        if (signature.fingerprint && seenFingerprints.has(signature.fingerprint)) continue;

        if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
            if (
                acceptedMcqSignatures.some((prior) =>
                    areMcqQuestionsNearDuplicate(buildMcqUniquenessSignature(question), prior)
                )
            ) {
                continue;
            }
        } else if (normalizedQuestionType !== "essay") {
            if (
                signature.normalized
                && acceptedObjectivePromptSignatures.some((prior) =>
                    areQuestionPromptsNearDuplicate(signature, prior)
                )
            ) {
                continue;
            }
        }

        seenPromptKeys.add(dedupeKey);
        if (signature.fingerprint) {
            seenFingerprints.add(signature.fingerprint);
        }
        if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
            acceptedMcqSignatures.push(buildMcqUniquenessSignature(question));
        } else if (normalizedQuestionType !== "essay" && signature.normalized) {
            acceptedObjectivePromptSignatures.push(signature);
        }
        deduped.push(question);
    }

    return deduped;
};

const buildSeenQuestionIdsFromCompletedAttempts = (recentAttempts, examFormat) => {
    const attempts = Array.isArray(recentAttempts) ? recentAttempts : [];
    const normalizedFormat = normalizeExamFormat(examFormat);

    const completedAttempts = attempts.filter((attempt) => {
        const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
        if (answers.length === 0) return false;
        if (normalizedFormat) {
            const attemptFormat = normalizeExamFormat(attempt?.examFormat);
            if (attemptFormat && attemptFormat !== normalizedFormat) return false;
        }
        return true;
    });

    const seenQuestionIds = new Set();
    const questionLastSeenOrder = new Map();
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

const pickObjectiveSubsetByMix = (questions, size) => {
    if (questions.length <= size) return [...questions];

    const buckets = {
        [QUESTION_TYPE_MULTIPLE_CHOICE]: [],
        [QUESTION_TYPE_TRUE_FALSE]: [],
        [QUESTION_TYPE_FILL_BLANK]: [],
    };
    for (const question of questions) {
        const questionType = normalizeQuestionType(question?.questionType);
        if (!buckets[questionType]) continue;
        buckets[questionType].push(question);
    }

    const targets = getObjectiveSubtypeTargets(size);
    const selected = [
        ...pickDifficultyBalancedSubset(buckets[QUESTION_TYPE_MULTIPLE_CHOICE], targets[QUESTION_TYPE_MULTIPLE_CHOICE]),
        ...pickDifficultyBalancedSubset(buckets[QUESTION_TYPE_TRUE_FALSE], targets[QUESTION_TYPE_TRUE_FALSE]),
        ...pickDifficultyBalancedSubset(buckets[QUESTION_TYPE_FILL_BLANK], targets[QUESTION_TYPE_FILL_BLANK]),
    ];

    if (selected.length < size) {
        const selectedSet = new Set(selected);
        const remaining = questions.filter((item) => !selectedSet.has(item));
        selected.push(...pickRandomSubset(remaining, size - selected.length));
    }

    return selected.slice(0, size);
};

const pickExamSubset = (questions, subsetSize, isEssay, examFormat) => {
    const safeSubsetSize = Math.max(0, Number(subsetSize || 0));
    if (questions.length <= safeSubsetSize) return [...questions];
    if (!isEssay && normalizeExamFormat(examFormat) === OBJECTIVE_EXAM_FORMAT) {
        return pickObjectiveSubsetByMix(questions, safeSubsetSize);
    }
    return isEssay
        ? pickRandomSubset(questions, safeSubsetSize)
        : pickDifficultyBalancedSubset(questions, safeSubsetSize);
};

const resolveQuestionId = (question, fallbackIndex = 0) =>
    String(question?._id || `question:${fallbackIndex}`);

const matchesCoverageTarget = (question, target) => {
    const outcomeKey = normalizeOutcomeKey(question?.outcomeKey);
    const bloomLevel = normalizeBloomLevel(question?.bloomLevel || "");
    if (!outcomeKey || !bloomLevel) {
        return false;
    }
    return outcomeKey === target.outcomeKey && bloomLevel === target.bloomLevel;
};

const buildCoverageAwareSubset = ({
    questions,
    subsetSize,
    isEssay,
    examFormat,
    coveragePolicy,
    preserveOrder = false,
}) => {
    const orderedQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
    const safeSubsetSize = Math.max(0, Number(subsetSize || 0));
    if (safeSubsetSize === 0 || orderedQuestions.length === 0) {
        return [];
    }

    const targetDefinitions = Array.isArray(coveragePolicy?.coverageTargets)
        ? coveragePolicy.coverageTargets
        : [];
    if (targetDefinitions.length === 0) {
        return preserveOrder
            ? orderedQuestions.slice(0, safeSubsetSize)
            : pickExamSubset(orderedQuestions, safeSubsetSize, Boolean(isEssay), examFormat);
    }

    const selectedQuestions = [];
    const selectedQuestionIds = new Set();
    const questionOrder = new Map(
        orderedQuestions.map((question, index) => [resolveQuestionId(question, index), index])
    );

    const appendQuestions = (items) => {
        for (const question of items) {
            const key = resolveQuestionId(question, selectedQuestions.length);
            if (selectedQuestionIds.has(key)) continue;
            selectedQuestionIds.add(key);
            selectedQuestions.push(question);
        }
    };

    for (const target of targetDefinitions) {
        if (!target?.desiredCount) continue;
        const matchingQuestions = orderedQuestions.filter((question) => {
            const key = resolveQuestionId(question);
            if (selectedQuestionIds.has(key)) return false;
            return matchesCoverageTarget(question, target);
        });
        const chosenMatches = preserveOrder
            ? matchingQuestions.slice(0, target.desiredCount)
            : pickExamSubset(matchingQuestions, target.desiredCount, Boolean(isEssay), examFormat);
        appendQuestions(chosenMatches);
    }

    const remainingNeeded = safeSubsetSize - selectedQuestions.length;
    if (remainingNeeded > 0) {
        const remainingQuestions = orderedQuestions.filter((question, index) => {
            const key = resolveQuestionId(question, index);
            return !selectedQuestionIds.has(key);
        });
        const fillerQuestions = preserveOrder
            ? remainingQuestions.slice(0, remainingNeeded)
            : pickExamSubset(remainingQuestions, remainingNeeded, Boolean(isEssay), examFormat);
        appendQuestions(fillerQuestions);
    }

    if (preserveOrder) {
        return selectedQuestions
            .slice(0, safeSubsetSize)
            .sort(
                (left, right) =>
                    (questionOrder.get(resolveQuestionId(left)) ?? Infinity)
                    - (questionOrder.get(resolveQuestionId(right)) ?? Infinity)
            );
    }

    return selectedQuestions.slice(0, safeSubsetSize);
};

const evaluateSelectionCoverage = ({
    blueprint,
    examFormat,
    questions,
    targetCount,
}) => {
    if (!blueprint) {
        return {
            ready: false,
            reasonCode: "ASSESSMENT_BLUEPRINT_REQUIRED",
        };
    }

    return resolveAssessmentGenerationPolicy({
        blueprint,
        examFormat,
        questions,
        targetCount,
    });
};

const buildSelectionResult = ({
    selectedQuestions,
    dedupedQuestions,
    unseenQuestions,
    completedAttemptCount,
    seenQuestionIds,
    coverageEvaluation,
    requiresGeneration,
    unavailableReason,
}) => {
    const safeSelectedQuestions = Array.isArray(selectedQuestions) ? selectedQuestions : [];
    const recycledCount = safeSelectedQuestions.filter((question) =>
        seenQuestionIds.has(String(question?._id))
    ).length;
    const setQuality = summarizeQuestionSetQuality(safeSelectedQuestions);
    return {
        selectedQuestions: safeSelectedQuestions,
        dedupedCount: dedupedQuestions.length,
        unseenCount: unseenQuestions.length,
        completedAttemptCount,
        coverageSatisfied: coverageEvaluation?.ready === true,
        freshnessSatisfied: recycledCount === 0,
        recycledCount,
        requiresGeneration: Boolean(requiresGeneration),
        unavailableReason: unavailableReason || undefined,
        qualityTier: setQuality.qualityTier,
        premiumTargetMet: setQuality.premiumTargetMet,
        qualityWarnings: setQuality.qualityWarnings,
        qualitySignals: setQuality.qualitySignals,
    };
};

export const selectQuestionsForAttempt = ({
    questions,
    recentAttempts,
    subsetSize,
    isEssay,
    examFormat,
    assessmentBlueprint,
    bankTargetCount,
}) => {
    const dedupedQuestions = sortQuestionsByPremiumQuality(dedupeQuestionsByPrompt(questions));
    const effectiveFormat = normalizeExamFormat(examFormat || (isEssay ? "essay" : OBJECTIVE_EXAM_FORMAT));
    const { seenQuestionIds, questionLastSeenOrder, completedAttemptCount } =
        buildSeenQuestionIdsFromCompletedAttempts(recentAttempts, effectiveFormat);
    const unseenQuestions = dedupedQuestions.filter(
        (question) => !seenQuestionIds.has(String(question?._id))
    );
    const targetSize = Math.max(0, Number(subsetSize || 0));
    const normalizedBlueprint = normalizeAssessmentBlueprint(assessmentBlueprint);

    if (targetSize === 0) {
        return buildSelectionResult({
            selectedQuestions: [],
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: { ready: true },
            requiresGeneration: false,
        });
    }

    if (!normalizedBlueprint) {
        return buildSelectionResult({
            selectedQuestions: [],
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: null,
            requiresGeneration: true,
        });
    }

    const bankCapacityTarget = Math.max(targetSize, Math.max(0, Number(bankTargetCount || 0)));
    const bankExhausted = dedupedQuestions.length >= bankCapacityTarget;
    const coverageTargetPolicy = evaluateSelectionCoverage({
        blueprint: normalizedBlueprint,
        examFormat: effectiveFormat,
        questions: [],
        targetCount: targetSize,
    });

    if (coverageTargetPolicy?.unavailable) {
        return buildSelectionResult({
            selectedQuestions: [],
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: coverageTargetPolicy,
            requiresGeneration: true,
        });
    }

    const evaluateCandidatePool = (candidateQuestions, { preserveOrder = false } = {}) => {
        const selectedQuestions = buildCoverageAwareSubset({
            questions: candidateQuestions,
            subsetSize: targetSize,
            isEssay: Boolean(isEssay),
            examFormat: effectiveFormat,
            coveragePolicy: coverageTargetPolicy,
            preserveOrder,
        });
        const coverageEvaluation = evaluateSelectionCoverage({
            blueprint: normalizedBlueprint,
            examFormat: effectiveFormat,
            questions: selectedQuestions,
            targetCount: targetSize,
        });
        return {
            selectedQuestions,
            coverageEvaluation,
        };
    };

    if (completedAttemptCount === 0) {
        const initialSelection = evaluateCandidatePool(dedupedQuestions);
        const selectionReady =
            initialSelection.selectedQuestions.length >= targetSize
            && initialSelection.coverageEvaluation?.ready === true;
        return buildSelectionResult({
            selectedQuestions: initialSelection.selectedQuestions,
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: initialSelection.coverageEvaluation,
            requiresGeneration: !selectionReady && !bankExhausted,
            unavailableReason: selectionReady
                ? undefined
                : bankExhausted
                    ? (
                        initialSelection.selectedQuestions.length < targetSize
                            ? "INSUFFICIENT_READY_QUESTIONS"
                            : initialSelection.coverageEvaluation?.reasonCode || "MISSING_OUTCOME_COVERAGE"
                    )
                    : undefined,
        });
    }

    const unseenSelection = evaluateCandidatePool(unseenQuestions);
    const unseenSelectionReady =
        unseenSelection.selectedQuestions.length >= targetSize
        && unseenSelection.coverageEvaluation?.ready === true;
    if (unseenSelectionReady) {
        return buildSelectionResult({
            selectedQuestions: unseenSelection.selectedQuestions,
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: unseenSelection.coverageEvaluation,
            requiresGeneration: false,
        });
    }

    if (!bankExhausted) {
        return buildSelectionResult({
            selectedQuestions: unseenSelection.selectedQuestions,
            dedupedQuestions,
            unseenQuestions,
            completedAttemptCount,
            seenQuestionIds,
            coverageEvaluation: unseenSelection.coverageEvaluation,
            requiresGeneration: true,
        });
    }

    const seenQuestionsByStaleness = dedupedQuestions
        .filter((question) => seenQuestionIds.has(String(question?._id)))
        .sort((left, right) => {
            const leftRank = questionLastSeenOrder.get(String(left?._id)) ?? Infinity;
            const rightRank = questionLastSeenOrder.get(String(right?._id)) ?? Infinity;
            if (leftRank !== rightRank) {
                return rightRank - leftRank;
            }
            return compareQuestionsByPremiumQuality(left, right);
        });
    const exhaustedBankSelection = evaluateCandidatePool(
        [...unseenQuestions, ...seenQuestionsByStaleness],
        { preserveOrder: true }
    );
    const exhaustedBankReady =
        exhaustedBankSelection.selectedQuestions.length >= targetSize
        && exhaustedBankSelection.coverageEvaluation?.ready === true;
    const exhaustedBankCanRecycle = exhaustedBankSelection.selectedQuestions.length > 0;

    return buildSelectionResult({
        selectedQuestions: exhaustedBankSelection.selectedQuestions,
        dedupedQuestions,
        unseenQuestions,
        completedAttemptCount,
        seenQuestionIds,
        coverageEvaluation: exhaustedBankSelection.coverageEvaluation,
        requiresGeneration: false,
        unavailableReason: exhaustedBankReady || exhaustedBankCanRecycle
            ? undefined
            : (
                exhaustedBankSelection.selectedQuestions.length < targetSize
                    ? "INSUFFICIENT_READY_QUESTIONS"
                    : exhaustedBankSelection.coverageEvaluation?.reasonCode || "MISSING_OUTCOME_COVERAGE"
            ),
    });
};
