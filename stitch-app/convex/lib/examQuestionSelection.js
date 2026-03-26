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
            : pickExamSubset(orderedQuestions, safeSubsetSize, Boolean(isEssay));
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
            : pickExamSubset(matchingQuestions, target.desiredCount, Boolean(isEssay));
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
            : pickExamSubset(remainingQuestions, remainingNeeded, Boolean(isEssay));
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
    const dedupedQuestions = dedupeQuestionsByPrompt(questions);
    const effectiveFormat = examFormat || (isEssay ? "essay" : "mcq");
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
            return rightRank - leftRank;
        });
    const exhaustedBankSelection = evaluateCandidatePool(
        [...unseenQuestions, ...seenQuestionsByStaleness],
        { preserveOrder: true }
    );
    const exhaustedBankReady =
        exhaustedBankSelection.selectedQuestions.length >= targetSize
        && exhaustedBankSelection.coverageEvaluation?.ready === true;

    return buildSelectionResult({
        selectedQuestions: exhaustedBankSelection.selectedQuestions,
        dedupedQuestions,
        unseenQuestions,
        completedAttemptCount,
        seenQuestionIds,
        coverageEvaluation: exhaustedBankSelection.coverageEvaluation,
        requiresGeneration: false,
        unavailableReason: exhaustedBankReady
            ? undefined
            : (
                exhaustedBankSelection.selectedQuestions.length < targetSize
                    ? "INSUFFICIENT_READY_QUESTIONS"
                    : exhaustedBankSelection.coverageEvaluation?.reasonCode || "MISSING_OUTCOME_COVERAGE"
            ),
    });
};
