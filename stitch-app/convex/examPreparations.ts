import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
    assertAuthorizedUser,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import {
    ASSESSMENT_BLUEPRINT_VERSION,
    filterQuestionsForActiveAssessment,
} from "./lib/assessmentBlueprint.js";
import {
    isExamSnapshotCompatible,
    resolveExamAssessmentVersion,
    resolveExamSnapshotTimestamp,
    resolveTopicQuestionSetVersion,
} from "./lib/examVersioning.js";
import { resolveAssessmentCapacity } from "./lib/questionBankConfig.js";

const resolveRequestedExamFormat = (value: unknown) =>
    String(value || "").trim().toLowerCase() === "essay" ? "essay" : "mcq";

const resolvePreparationCapacity = ({
    topic,
    examFormat,
    topicTargetCount,
    usableQuestionCount,
}: {
    topic?: any;
    examFormat: string;
    topicTargetCount?: number;
    usableQuestionCount?: number;
}) =>
    resolveAssessmentCapacity({
        examFormat,
        topic,
        topicTargetCount,
        usableQuestionCount,
    });

const buildPreparationMessage = ({
    examFormat,
    status,
    reasonCode,
    qualityTier,
    fallback,
}: {
    examFormat: string;
    status: string;
    reasonCode?: string;
    qualityTier?: string;
    fallback?: string;
}) => {
    const isEssay = examFormat === "essay";
    const normalizedStatus = String(status || "").trim().toLowerCase();
    const normalizedReason = String(reasonCode || "").trim().toUpperCase();
    const normalizedQualityTier = String(qualityTier || "").trim().toLowerCase();

    if (normalizedStatus === "ready") {
        if (normalizedQualityTier === "premium") {
            return isEssay
                ? "Your premium essay exam is ready."
                : "Your premium objective exam is ready.";
        }
        return isEssay
            ? "Your best available essay exam is ready."
            : "Your best available objective exam is ready.";
    }

    if (normalizedStatus === "preparing" || normalizedStatus === "queued") {
        return isEssay
            ? "Preparing your essay exam."
            : "Preparing your objective exam.";
    }

    if (normalizedStatus === "unavailable") {
        if (normalizedReason === "INSUFFICIENT_EVIDENCE") {
            return isEssay
                ? "We couldn't generate grounded essay questions from this topic yet."
                : "We couldn't generate grounded objective questions from this topic yet.";
        }
        if (normalizedReason === "MISSING_OUTCOME_COVERAGE") {
            return isEssay
                ? "We couldn't generate a usable essay exam from this topic yet."
                : "We couldn't generate a usable objective exam from this topic yet.";
        }
        return isEssay
            ? "We couldn't generate a usable essay exam from this topic."
            : "We couldn't generate a usable objective exam from this topic.";
    }

    if (normalizedStatus === "failed") {
        return fallback
            || (
                isEssay
                    ? "We hit a temporary issue while preparing your essay exam. Please retry."
                    : "We hit a temporary issue while preparing your objective exam. Please retry."
            );
    }

    return fallback
        || (
            isEssay
                ? "Preparing your essay exam."
                : "Preparing your objective exam."
        );
};

const loadPreparationWithAttemptSnapshot = async (ctx: any, preparationId: any) => {
    const preparation = await ctx.db.get(preparationId);
    if (!preparation) {
        return null;
    }

    let attempt = null;
    let questions: any[] = [];
    if (preparation.attemptId) {
        attempt = await ctx.db.get(preparation.attemptId);
        const questionIds = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
        const loadedQuestions = await Promise.all(questionIds.map((questionId: any) => ctx.db.get(questionId)));
        questions = loadedQuestions
            .filter(Boolean)
            .map((question) => sanitizeExamQuestionForClient(question));
    }

    return {
        preparation,
        attempt,
        questions,
    };
};

const resolvePreparationCompatibility = ({
    preparation,
    topic,
}: {
    preparation: any;
    topic: any;
}) => isExamSnapshotCompatible({
    snapshotQuestionSetVersion: preparation?.questionSetVersion,
    snapshotAssessmentVersion: preparation?.assessmentVersion,
    topic,
    requestedAssessmentVersion: preparation?.assessmentVersion,
    snapshotAt: resolveExamSnapshotTimestamp(preparation),
});

const loadAttemptQuestionsForReuse = async ({
    ctx,
    attempt,
    topic,
    examFormat,
}: {
    ctx: any;
    attempt: any;
    topic: any;
    examFormat: string;
}) => {
    const questionIds = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
    if (questionIds.length === 0) {
        return [];
    }

    const loadedQuestions = await Promise.all(
        questionIds.map((questionId: any) => ctx.db.get(questionId))
    );
    const orderedQuestions = [];
    for (let index = 0; index < questionIds.length; index += 1) {
        const question = loadedQuestions[index];
        if (!question) {
            return [];
        }
        if (String(question._id || "") !== String(questionIds[index] || "")) {
            return [];
        }
        if (String(question.topicId || "") !== String(topic?._id || "")) {
            return [];
        }
        orderedQuestions.push(question);
    }

    const isEssay = examFormat === "essay";
    const activeQuestions = filterQuestionsForActiveAssessment({
        topic,
        questions: orderedQuestions,
    }).filter((question) => {
        const matchesRequestedFormat = isEssay
            ? question.questionType === "essay"
            : question.questionType !== "essay";
        if (!matchesRequestedFormat) return false;
        return isUsableExamQuestion(question, { allowEssay: isEssay });
    });

    return activeQuestions.length === orderedQuestions.length
        ? activeQuestions
        : [];
};

const createExamAttemptSnapshot = async ({
    ctx,
    sourceAttempt,
    userId,
    topicId,
    examFormat,
    questionIds,
    totalQuestions,
    questionSetVersion,
    assessmentVersion,
}: {
    ctx: any;
    sourceAttempt: any;
    userId: string;
    topicId: any;
    examFormat: string;
    questionIds: any[];
    totalQuestions: number;
    questionSetVersion: number;
    assessmentVersion: string;
}) => {
    return await ctx.db.insert("examAttempts", {
        userId,
        topicId,
        examFormat,
        questionSetVersion,
        assessmentVersion,
        score: 0,
        totalQuestions,
        timeTakenSeconds: 0,
        questionIds,
        answers: [],
        startedAt: Date.now(),
        qualityTier: sourceAttempt?.qualityTier,
        premiumTargetMet: sourceAttempt?.premiumTargetMet,
        qualityWarnings: sourceAttempt?.qualityWarnings,
        qualitySignals: sourceAttempt?.qualitySignals,
    });
};

const inspectExistingPreparation = async ({
    ctx,
    preparation,
    effectiveUserId,
    topicId,
    examFormat,
    requestedAssessmentVersion,
    topic,
}: {
    ctx: any;
    preparation: any;
    effectiveUserId: string;
    topicId: any;
    examFormat: string;
    requestedAssessmentVersion: string;
    topic: any;
}) => {
    const preparationCompatible = isExamSnapshotCompatible({
        snapshotQuestionSetVersion: preparation?.questionSetVersion,
        snapshotAssessmentVersion: preparation?.assessmentVersion,
        topic,
        requestedAssessmentVersion,
        snapshotAt: resolveExamSnapshotTimestamp(preparation),
    });

    if (!preparationCompatible) {
        return null;
    }

    if (preparation.status === "queued" || preparation.status === "preparing") {
        return {
            launchMode: "continue_preparation",
            preparation,
            status: preparation.status,
            stage: preparation.stage,
            attempt: null,
            reusableQuestions: [],
        };
    }

    if (preparation.status === "ready" && preparation.attemptId) {
        const attempt = await ctx.db.get(preparation.attemptId);
        const reusableQuestions = await loadAttemptQuestionsForReuse({
            ctx,
            attempt,
            topic,
            examFormat,
        });
        if (reusableQuestions.length === 0) {
            return null;
        }

        const existingAnswers = Array.isArray(attempt?.answers) ? attempt.answers : [];
        const matchesFormat =
            resolveRequestedExamFormat(attempt?.examFormat) === examFormat;
        const attemptCompatible = isExamSnapshotCompatible({
            snapshotQuestionSetVersion: attempt?.questionSetVersion,
            snapshotAssessmentVersion: attempt?.assessmentVersion,
            topic,
            requestedAssessmentVersion,
            snapshotAt: resolveExamSnapshotTimestamp(attempt),
        });

        if (
            !attempt
            || attempt.userId !== effectiveUserId
            || attempt.topicId !== topicId
            || !matchesFormat
            || !attemptCompatible
        ) {
            return null;
        }

        const hasClaimedAttempt = Boolean(attempt?.claimedAt && typeof attempt.claimedAt === "number");
        const hasExistingAnswers = existingAnswers.length > 0;
        const launchMode = !hasExistingAnswers && !hasClaimedAttempt
            ? "resume_saved_attempt"
            : "open_saved_exam_set";

        return {
            launchMode,
            preparation,
            status: "ready",
            stage: preparation.stage,
            attempt,
            reusableQuestions,
        };
    }

    if (preparation.status === "failed" || preparation.status === "unavailable") {
        return {
            launchMode: "retry_existing_preparation",
            preparation,
            status: preparation.status,
            stage: preparation.stage,
            attempt: null,
            reusableQuestions: [],
        };
    }

    return null;
};

export const getPreparationInternal = internalQuery({
    args: {
        preparationId: v.id("examPreparations"),
    },
    handler: async (ctx, args) => {
        return await loadPreparationWithAttemptSnapshot(ctx, args.preparationId);
    },
});

export const createOrReusePreparationInternal = internalMutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
        examFormat: v.string(),
        assessmentVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const effectiveUserId = String(args.userId || "").trim();
        const examFormat = resolveRequestedExamFormat(args.examFormat);
        const requestedAssessmentVersion = resolveExamAssessmentVersion(args.assessmentVersion);
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }
        const questionSetVersion = resolveTopicQuestionSetVersion(topic);

        const course = topic.courseId ? await ctx.db.get(topic.courseId) : null;
        if (course && course.userId !== effectiveUserId) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Not authorized to access this topic.",
            });
        }

        const existingPreparations = await ctx.db
            .query("examPreparations")
            .withIndex("by_userId_topicId_examFormat", (q) =>
                q.eq("userId", effectiveUserId).eq("topicId", args.topicId).eq("examFormat", examFormat)
            )
            .order("desc")
            .take(10);

        for (const preparation of existingPreparations) {
            const existingLaunch = await inspectExistingPreparation({
                ctx,
                preparation,
                effectiveUserId,
                topicId: args.topicId,
                examFormat,
                requestedAssessmentVersion,
                topic,
            });
            if (!existingLaunch) {
                continue;
            }

            if (existingLaunch.launchMode === "continue_preparation") {
                return {
                    created: false,
                    preparationId: preparation._id,
                    status: preparation.status,
                    stage: preparation.stage,
                    launchMode: existingLaunch.launchMode,
                };
            }

            if (existingLaunch.launchMode === "resume_saved_attempt") {
                return {
                    created: false,
                    preparationId: preparation._id,
                    status: preparation.status,
                    stage: preparation.stage,
                    launchMode: existingLaunch.launchMode,
                    attemptId: existingLaunch.attempt?._id || preparation.attemptId,
                };
            }

            if (existingLaunch.launchMode === "open_saved_exam_set") {
                const clonedAttemptId = await createExamAttemptSnapshot({
                    ctx,
                    sourceAttempt: existingLaunch.attempt,
                    userId: effectiveUserId,
                    topicId: args.topicId,
                    examFormat,
                    questionIds: existingLaunch.reusableQuestions.map((question: any) => question._id),
                    totalQuestions: existingLaunch.reusableQuestions.length,
                    questionSetVersion,
                    assessmentVersion: requestedAssessmentVersion,
                });

                await ctx.db.patch(preparation._id, {
                    attemptId: clonedAttemptId,
                    questionSetVersion,
                    assessmentVersion: requestedAssessmentVersion,
                    status: "ready",
                    stage: "completed",
                    reasonCode: undefined,
                    errorSummary: undefined,
                    finishedAt: Date.now(),
                    message: buildPreparationMessage({
                        examFormat,
                        status: "ready",
                        qualityTier: existingLaunch.attempt?.qualityTier,
                    }),
                });

                return {
                    created: false,
                    preparationId: preparation._id,
                    status: "ready",
                    stage: "completed",
                    launchMode: existingLaunch.launchMode,
                    attemptId: clonedAttemptId,
                };
            }

            if (existingLaunch.launchMode === "retry_existing_preparation") {
                return {
                    created: false,
                    preparationId: preparation._id,
                    status: preparation.status,
                    stage: preparation.stage,
                    launchMode: existingLaunch.launchMode,
                };
            }
        }

        const capacity = resolvePreparationCapacity({
            topic,
            examFormat,
            topicTargetCount: examFormat === "essay" ? topic.essayTargetCount : topic.mcqTargetCount,
            usableQuestionCount: examFormat === "essay" ? topic.usableEssayCount : topic.usableMcqCount,
        });
        const preparationId = await ctx.db.insert("examPreparations", {
            userId: effectiveUserId,
            topicId: args.topicId,
            examFormat,
            assessmentVersion: requestedAssessmentVersion,
            questionSetVersion,
            status: "queued",
            stage: "queued",
            attemptTargetCount: capacity.attemptTargetCount,
            bankTargetCount: capacity.bankTargetCount,
            usableCount: 0,
            generatedCount: 0,
            message: buildPreparationMessage({ examFormat, status: "queued" }),
            startedAt: Date.now(),
        });

        return {
            created: true,
            preparationId,
            status: "queued",
            stage: "queued",
            launchMode: "new_preparation",
        };
    },
});

export const markPreparationStageInternal = internalMutation({
    args: {
        preparationId: v.id("examPreparations"),
        status: v.optional(v.string()),
        stage: v.optional(v.string()),
        usableCount: v.optional(v.number()),
        generatedCount: v.optional(v.number()),
        attemptTargetCount: v.optional(v.number()),
        bankTargetCount: v.optional(v.number()),
        reasonCode: v.optional(v.string()),
        errorSummary: v.optional(v.string()),
        message: v.optional(v.string()),
        attemptId: v.optional(v.id("examAttempts")),
        qualityTier: v.optional(v.string()),
        premiumTargetMet: v.optional(v.boolean()),
        qualityWarnings: v.optional(v.array(v.string())),
        qualitySignals: v.optional(v.any()),
        finishedAt: v.optional(v.number()),
        questionSetVersion: v.optional(v.number()),
        assessmentVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const preparation = await ctx.db.get(args.preparationId);
        if (!preparation) {
            return null;
        }

        const nextStatus = String(args.status || preparation.status || "").trim() || preparation.status;
        const nextReasonCode = args.reasonCode === undefined ? preparation.reasonCode : args.reasonCode;
        const nextMessage = args.message === undefined
            ? buildPreparationMessage({
                examFormat: preparation.examFormat,
                status: nextStatus,
                reasonCode: nextReasonCode,
                qualityTier: args.qualityTier === undefined ? preparation.qualityTier : args.qualityTier,
                fallback: preparation.message,
            })
            : args.message;

        const patch: Record<string, unknown> = {
            status: nextStatus,
            stage: args.stage === undefined ? preparation.stage : args.stage,
            usableCount: args.usableCount === undefined ? preparation.usableCount : args.usableCount,
            generatedCount: args.generatedCount === undefined ? preparation.generatedCount : args.generatedCount,
            attemptTargetCount: args.attemptTargetCount === undefined ? preparation.attemptTargetCount : args.attemptTargetCount,
            bankTargetCount: args.bankTargetCount === undefined ? preparation.bankTargetCount : args.bankTargetCount,
            reasonCode: nextReasonCode,
            errorSummary: args.errorSummary === undefined ? preparation.errorSummary : args.errorSummary,
            message: nextMessage,
            attemptId: args.attemptId === undefined ? preparation.attemptId : args.attemptId,
            qualityTier: args.qualityTier === undefined ? preparation.qualityTier : args.qualityTier,
            premiumTargetMet: args.premiumTargetMet === undefined ? preparation.premiumTargetMet : args.premiumTargetMet,
            qualityWarnings: args.qualityWarnings === undefined ? preparation.qualityWarnings : args.qualityWarnings,
            qualitySignals: args.qualitySignals === undefined ? preparation.qualitySignals : args.qualitySignals,
            finishedAt: args.finishedAt === undefined ? preparation.finishedAt : args.finishedAt,
            questionSetVersion: args.questionSetVersion === undefined ? preparation.questionSetVersion : args.questionSetVersion,
            assessmentVersion: args.assessmentVersion === undefined ? preparation.assessmentVersion : args.assessmentVersion,
        };

        await ctx.db.patch(args.preparationId, patch);
        return {
            _id: args.preparationId,
            ...preparation,
            ...patch,
        };
    },
});

const classifyPreparationOutcome = ({
    examFormat,
    generationResult,
    finalAttempt,
}: {
    examFormat: string;
    generationResult: any;
    finalAttempt: any;
}) => {
    const normalizedReason = String(generationResult?.reason || finalAttempt?.reasonCode || "").trim().toUpperCase();
    if (normalizedReason === "INSUFFICIENT_EVIDENCE" || generationResult?.abstained === true) {
        return {
            status: "unavailable",
            reasonCode: "INSUFFICIENT_EVIDENCE",
            message: buildPreparationMessage({
                examFormat,
                status: "unavailable",
                reasonCode: "INSUFFICIENT_EVIDENCE",
            }),
        };
    }

    if (generationResult?.timedOut === true) {
        return {
            status: "failed",
            reasonCode: "TIME_BUDGET_REACHED",
            message: buildPreparationMessage({
                examFormat,
                status: "failed",
            }),
        };
    }

    return {
        status: "unavailable",
        reasonCode: normalizedReason || "INSUFFICIENT_READY_QUESTIONS",
        message: buildPreparationMessage({
            examFormat,
            status: "unavailable",
            reasonCode: normalizedReason || "INSUFFICIENT_READY_QUESTIONS",
        }),
    };
};

export const runExamPreparationInternal = internalAction({
    args: {
        preparationId: v.id("examPreparations"),
    },
    handler: async (ctx, args) => {
        const preparationSnapshot = await ctx.runQuery(internal.examPreparations.getPreparationInternal, {
            preparationId: args.preparationId,
        });
        const preparation = preparationSnapshot?.preparation;
        if (!preparation) {
            return null;
        }
        if (preparation.status !== "queued" && preparation.status !== "preparing") {
            return preparation;
        }

        const examFormat = resolveRequestedExamFormat(preparation.examFormat);
        const topicSnapshot = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
            topicId: preparation.topicId,
        });
        if (!topicSnapshot) {
            await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                preparationId: args.preparationId,
                status: "failed",
                stage: "failed",
                reasonCode: "TOPIC_NOT_FOUND",
                errorSummary: "Topic not found while preparing exam.",
                message: buildPreparationMessage({
                    examFormat,
                    status: "failed",
                }),
                finishedAt: Date.now(),
            });
            return null;
        }

        const latestQuestionSetVersion = resolveTopicQuestionSetVersion(topicSnapshot);
        const latestAssessmentVersion = resolveExamAssessmentVersion(
            topicSnapshot?.assessmentBlueprint?.version || preparation.assessmentVersion || ASSESSMENT_BLUEPRINT_VERSION
        );

        if (!isExamSnapshotCompatible({
            snapshotQuestionSetVersion: preparation.questionSetVersion,
            snapshotAssessmentVersion: preparation.assessmentVersion,
            topic: topicSnapshot,
            requestedAssessmentVersion: preparation.assessmentVersion,
            snapshotAt: resolveExamSnapshotTimestamp(preparation),
        })) {
            if (!preparation.attemptId && (preparation.status === "queued" || preparation.status === "preparing")) {
                await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                    preparationId: args.preparationId,
                    status: "queued",
                    stage: "queued",
                    reasonCode: undefined,
                    errorSummary: undefined,
                    message: buildPreparationMessage({
                        examFormat,
                        status: "queued",
                    }),
                    finishedAt: undefined,
                    questionSetVersion: latestQuestionSetVersion,
                    assessmentVersion: latestAssessmentVersion,
                });
            } else {
                await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                    preparationId: args.preparationId,
                    status: "failed",
                    stage: "failed",
                    reasonCode: "STALE_PREPARATION",
                    errorSummary: "Exam preparation became stale after the topic changed.",
                    message: "This exam set is outdated because the topic changed. Start the exam again.",
                    finishedAt: Date.now(),
                    questionSetVersion: latestQuestionSetVersion,
                    assessmentVersion: latestAssessmentVersion,
                });
                return null;
            }
        }

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: "preparing",
            stage: "checking_previous_attempt",
        });

        const initialAttempt = await ctx.runMutation(internal.exams.ensurePreparedExamAttemptInternal, {
            userId: preparation.userId,
            topicId: preparation.topicId,
            examFormat,
        });

        if (initialAttempt?.status === "ready") {
            await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                preparationId: args.preparationId,
                status: "ready",
                stage: "completed",
                usableCount: Number(initialAttempt.totalQuestions || 0),
                generatedCount: Number(initialAttempt.totalQuestions || 0),
                attemptTargetCount: Number(initialAttempt.attemptTargetCount || initialAttempt.totalQuestions || preparation.attemptTargetCount || 0),
                bankTargetCount: Number(initialAttempt.bankTargetCount || preparation.bankTargetCount || 0),
                attemptId: initialAttempt.attemptId,
                finishedAt: Date.now(),
                message: buildPreparationMessage({
                    examFormat,
                    status: "ready",
                    qualityTier: initialAttempt.qualityTier,
                }),
                qualityTier: initialAttempt.qualityTier,
                premiumTargetMet: initialAttempt.premiumTargetMet,
                qualityWarnings: initialAttempt.qualityWarnings,
                qualitySignals: initialAttempt.qualitySignals,
            });
            return initialAttempt;
        }

        if (initialAttempt?.status === "unavailable") {
            await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                preparationId: args.preparationId,
                status: "unavailable",
                stage: "unavailable",
                usableCount: Number(initialAttempt?.usableQuestionCount || 0),
                generatedCount: 0,
                attemptTargetCount: Number(initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0),
                bankTargetCount: Number(initialAttempt?.bankTargetCount || preparation.bankTargetCount || 0),
                reasonCode: String(initialAttempt?.reasonCode || "").trim() || "INSUFFICIENT_READY_QUESTIONS",
                message: buildPreparationMessage({
                    examFormat,
                    status: "unavailable",
                    reasonCode: initialAttempt?.reasonCode,
                    qualityTier: initialAttempt?.qualityTier,
                }),
                qualityTier: initialAttempt?.qualityTier,
                premiumTargetMet: initialAttempt?.premiumTargetMet,
                qualityWarnings: initialAttempt?.qualityWarnings,
                qualitySignals: initialAttempt?.qualitySignals,
                finishedAt: Date.now(),
            });
            return initialAttempt;
        }

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: "preparing",
            stage: "building_assessment_plan",
            usableCount: Number(initialAttempt?.usableQuestionCount || 0),
            attemptTargetCount: Number(initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0),
            bankTargetCount: Number(initialAttempt?.bankTargetCount || preparation.bankTargetCount || 0),
        });

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: "preparing",
            stage: "generating_candidates",
            usableCount: Number(initialAttempt?.usableQuestionCount || 0),
            attemptTargetCount: Number(initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0),
            bankTargetCount: Number(initialAttempt?.bankTargetCount || preparation.bankTargetCount || 0),
        });

        let generationResult: any;
        try {
            generationResult = examFormat === "essay"
                ? await ctx.runAction(internal.ai.generateEssayQuestionsForTopicOnDemandInternal, {
                    topicId: preparation.topicId,
                    count: Number(initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0) || undefined,
                })
                : await ctx.runAction(internal.ai.generateQuestionsForTopicOnDemandInternal, {
                    topicId: preparation.topicId,
                });
        } catch (error) {
            await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                preparationId: args.preparationId,
                status: "failed",
                stage: "failed",
                reasonCode: "GENERATION_FAILED",
                errorSummary: error instanceof Error ? error.message : String(error),
                message: buildPreparationMessage({
                    examFormat,
                    status: "failed",
                }),
                finishedAt: Date.now(),
            });
            return null;
        }

        const generationCapacity = resolvePreparationCapacity({
            examFormat,
            topicTargetCount: generationResult?.targetCount,
            usableQuestionCount: generationResult?.count,
        });

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: "preparing",
            stage: "reviewing_quality",
            usableCount: Number(generationResult?.count || initialAttempt?.usableQuestionCount || 0),
            generatedCount: Number(generationResult?.count || 0),
            attemptTargetCount: Number(generationCapacity.attemptTargetCount || initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0),
            bankTargetCount: Number(generationCapacity.bankTargetCount || initialAttempt?.bankTargetCount || preparation.bankTargetCount || 0),
            qualityTier: generationResult?.qualityTier,
            premiumTargetMet: generationResult?.premiumTargetMet,
            qualityWarnings: generationResult?.qualityWarnings,
            qualitySignals: generationResult?.qualitySignals,
        });

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: "preparing",
            stage: "finalizing_attempt",
            usableCount: Number(generationResult?.count || initialAttempt?.usableQuestionCount || 0),
            generatedCount: Number(generationResult?.count || 0),
            attemptTargetCount: Number(generationCapacity.attemptTargetCount || initialAttempt?.attemptTargetCount || preparation.attemptTargetCount || 0),
            bankTargetCount: Number(generationCapacity.bankTargetCount || initialAttempt?.bankTargetCount || preparation.bankTargetCount || 0),
            qualityTier: generationResult?.qualityTier,
            premiumTargetMet: generationResult?.premiumTargetMet,
            qualityWarnings: generationResult?.qualityWarnings,
            qualitySignals: generationResult?.qualitySignals,
        });

        const finalAttempt = await ctx.runMutation(internal.exams.ensurePreparedExamAttemptInternal, {
            userId: preparation.userId,
            topicId: preparation.topicId,
            examFormat,
            allowPartialReady: true,
        });

        if (finalAttempt?.status === "ready") {
            await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
                preparationId: args.preparationId,
                status: "ready",
                stage: "completed",
                usableCount: Number(finalAttempt.totalQuestions || generationResult?.count || 0),
                generatedCount: Number(generationResult?.count || finalAttempt.totalQuestions || 0),
                attemptTargetCount: Number(finalAttempt.attemptTargetCount || generationCapacity.attemptTargetCount || preparation.attemptTargetCount || 0),
                bankTargetCount: Number(finalAttempt.bankTargetCount || generationCapacity.bankTargetCount || preparation.bankTargetCount || 0),
                attemptId: finalAttempt.attemptId,
                finishedAt: Date.now(),
                message: buildPreparationMessage({
                    examFormat,
                    status: "ready",
                    qualityTier: finalAttempt.qualityTier,
                }),
                qualityTier: finalAttempt.qualityTier,
                premiumTargetMet: finalAttempt.premiumTargetMet,
                qualityWarnings: finalAttempt.qualityWarnings,
                qualitySignals: finalAttempt.qualitySignals,
                questionSetVersion: Number(finalAttempt.questionSetVersion || latestQuestionSetVersion || 0) || latestQuestionSetVersion,
                assessmentVersion: resolveExamAssessmentVersion(finalAttempt.assessmentVersion || latestAssessmentVersion),
            });
            return finalAttempt;
        }

        const terminalOutcome = classifyPreparationOutcome({
            examFormat,
            generationResult,
            finalAttempt,
        });

        await ctx.runMutation(internal.examPreparations.markPreparationStageInternal, {
            preparationId: args.preparationId,
            status: terminalOutcome.status,
            stage: terminalOutcome.status,
            usableCount: Number(finalAttempt?.usableQuestionCount || generationResult?.count || 0),
            generatedCount: Number(generationResult?.count || 0),
            attemptTargetCount: Number(finalAttempt?.attemptTargetCount || generationCapacity.attemptTargetCount || preparation.attemptTargetCount || 0),
            bankTargetCount: Number(finalAttempt?.bankTargetCount || generationCapacity.bankTargetCount || preparation.bankTargetCount || 0),
            reasonCode: terminalOutcome.reasonCode,
            errorSummary: generationResult?.timedOut === true ? "Question generation timed out before the exam was ready." : undefined,
            message: terminalOutcome.message,
            qualityTier: finalAttempt?.qualityTier || generationResult?.qualityTier,
            premiumTargetMet: finalAttempt?.premiumTargetMet ?? generationResult?.premiumTargetMet,
            qualityWarnings: finalAttempt?.qualityWarnings || generationResult?.qualityWarnings,
            qualitySignals: finalAttempt?.qualitySignals || generationResult?.qualitySignals,
            finishedAt: Date.now(),
            questionSetVersion: Number(finalAttempt?.questionSetVersion || latestQuestionSetVersion || 0) || latestQuestionSetVersion,
            assessmentVersion: resolveExamAssessmentVersion(finalAttempt?.assessmentVersion || latestAssessmentVersion),
        });

        return terminalOutcome;
    },
});

export const startExamPreparation = action({
    args: {
        userId: v.optional(v.string()),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const effectiveUserId = assertAuthorizedUser({
            authUserId,
            requestedUserId: args.userId,
        });
        const examFormat = resolveRequestedExamFormat(args.examFormat);

        const result = await ctx.runMutation(internal.examPreparations.createOrReusePreparationInternal, {
            userId: effectiveUserId,
            topicId: args.topicId,
            examFormat,
            assessmentVersion: ASSESSMENT_BLUEPRINT_VERSION,
        });

        if (result?.created) {
            await ctx.scheduler.runAfter(0, internal.examPreparations.runExamPreparationInternal, {
                preparationId: result.preparationId,
            });
        }

        const response = {
            preparationId: result.preparationId,
            status: result.status,
            stage: result.stage,
            launchMode: result.launchMode || (result.created ? "new_preparation" : "continue_preparation"),
        };

        if (result?.status !== "ready" || !result?.preparationId) {
            return response;
        }

        const snapshot = await ctx.runQuery(internal.examPreparations.getPreparationInternal, {
            preparationId: result.preparationId,
        });
        const questions = Array.isArray(snapshot?.questions) ? snapshot.questions : [];
        const attemptId = snapshot?.attempt?._id || result?.attemptId || null;
        const attemptStartedAt = Number(snapshot?.attempt?.startedAt || snapshot?.attempt?._creationTime || 0) || null;

        return {
            ...response,
            attemptId,
            totalQuestions: Number(snapshot?.attempt?.totalQuestions || questions.length || 0),
            questions,
            attemptStartedAt,
            qualityTier: snapshot?.preparation?.qualityTier || snapshot?.attempt?.qualityTier || null,
            premiumTargetMet: snapshot?.preparation?.premiumTargetMet ?? snapshot?.attempt?.premiumTargetMet ?? false,
            qualityWarnings: snapshot?.preparation?.qualityWarnings || snapshot?.attempt?.qualityWarnings || [],
            qualitySignals: snapshot?.preparation?.qualitySignals || snapshot?.attempt?.qualitySignals || null,
        };
    },
});

export const getExamLaunchState = query({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) {
            return null;
        }

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return null;
        }

        const course = topic.courseId ? await ctx.db.get(topic.courseId) : null;
        if (course) {
            assertAuthorizedUser({
                authUserId,
                resourceOwnerUserId: course.userId,
            });
        }

        const assessmentVersion = resolveExamAssessmentVersion(
            topic?.assessmentBlueprint?.version || ASSESSMENT_BLUEPRINT_VERSION
        );
        const formats = ["mcq", "essay"];
        const launchStateEntries = await Promise.all(
            formats.map(async (examFormat) => {
                const existingPreparations = await ctx.db
                    .query("examPreparations")
                    .withIndex("by_userId_topicId_examFormat", (q) =>
                        q.eq("userId", authUserId).eq("topicId", args.topicId).eq("examFormat", examFormat)
                    )
                    .order("desc")
                    .take(10);

                for (const preparation of existingPreparations) {
                    const existingLaunch = await inspectExistingPreparation({
                        ctx,
                        preparation,
                        effectiveUserId: authUserId,
                        topicId: args.topicId,
                        examFormat,
                        requestedAssessmentVersion: assessmentVersion,
                        topic,
                    });
                    if (!existingLaunch) {
                        continue;
                    }

                    return [
                        examFormat,
                        {
                            launchMode: existingLaunch.launchMode,
                            status: existingLaunch.status,
                            stage: existingLaunch.stage,
                            totalQuestions: Number(
                                existingLaunch.attempt?.totalQuestions
                                || existingLaunch.reusableQuestions?.length
                                || 0
                            ),
                            qualityTier: preparation.qualityTier || existingLaunch.attempt?.qualityTier || null,
                            message: preparation.message || null,
                            updatedAt: Number(preparation.finishedAt || preparation.startedAt || preparation._creationTime || 0) || null,
                        },
                    ];
                }

                return [
                    examFormat,
                    {
                        launchMode: "new_preparation",
                        status: "idle",
                        stage: "queued",
                        totalQuestions: 0,
                        qualityTier: null,
                        message: null,
                        updatedAt: null,
                    },
                ];
            })
        );

        return Object.fromEntries(launchStateEntries);
    },
});

export const getExamPreparation = query({
    args: {
        preparationId: v.id("examPreparations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const snapshot = await loadPreparationWithAttemptSnapshot(ctx, args.preparationId);
        if (!snapshot?.preparation) {
            return null;
        }

        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: snapshot.preparation.userId,
        });

        const topic = await ctx.db.get(snapshot.preparation.topicId);
        const preparationCompatible = topic
            ? resolvePreparationCompatibility({
                preparation: snapshot.preparation,
                topic,
            })
            : false;

        if (!preparationCompatible) {
            return {
                preparationId: snapshot.preparation._id,
                topicId: snapshot.preparation.topicId,
                examFormat: snapshot.preparation.examFormat,
                assessmentVersion: snapshot.preparation.assessmentVersion,
                status: "failed",
                stage: "failed",
                attemptTargetCount: snapshot.preparation.attemptTargetCount,
                bankTargetCount: snapshot.preparation.bankTargetCount,
                usableCount: 0,
                generatedCount: 0,
                reasonCode: "STALE_PREPARATION",
                errorSummary: "This saved exam set no longer matches the current topic content.",
                message: "This saved exam set is outdated because the topic changed. Start the exam again.",
                canRetry: true,
                startedAt: snapshot.preparation.startedAt,
                finishedAt: snapshot.preparation.finishedAt,
                attemptId: null,
                qualityTier: null,
                premiumTargetMet: false,
                qualityWarnings: [],
                qualitySignals: null,
                totalQuestions: 0,
                questions: [],
                attemptStartedAt: null,
            };
        }

        return {
            preparationId: snapshot.preparation._id,
            topicId: snapshot.preparation.topicId,
            examFormat: snapshot.preparation.examFormat,
            assessmentVersion: snapshot.preparation.assessmentVersion,
            status: snapshot.preparation.status,
            stage: snapshot.preparation.stage,
            attemptTargetCount: snapshot.preparation.attemptTargetCount,
            bankTargetCount: snapshot.preparation.bankTargetCount,
            usableCount: snapshot.preparation.usableCount,
            generatedCount: snapshot.preparation.generatedCount,
            reasonCode: snapshot.preparation.reasonCode,
            errorSummary: snapshot.preparation.errorSummary,
            message: snapshot.preparation.message || buildPreparationMessage({
                examFormat: snapshot.preparation.examFormat,
                status: snapshot.preparation.status,
                reasonCode: snapshot.preparation.reasonCode,
                qualityTier: snapshot.preparation.qualityTier,
            }),
            canRetry: snapshot.preparation.status === "failed",
            startedAt: snapshot.preparation.startedAt,
            finishedAt: snapshot.preparation.finishedAt,
            attemptId: snapshot.attempt?._id || snapshot.preparation.attemptId || null,
            qualityTier: snapshot.preparation.qualityTier || snapshot.attempt?.qualityTier || null,
            premiumTargetMet: snapshot.preparation.premiumTargetMet ?? snapshot.attempt?.premiumTargetMet ?? false,
            qualityWarnings: snapshot.preparation.qualityWarnings || snapshot.attempt?.qualityWarnings || [],
            qualitySignals: snapshot.preparation.qualitySignals || snapshot.attempt?.qualitySignals || null,
            totalQuestions: Number(snapshot.attempt?.totalQuestions || snapshot.questions.length || 0),
            questions: snapshot.questions,
            attemptStartedAt: Number(snapshot.attempt?.startedAt || snapshot.attempt?._creationTime || 0) || null,
        };
    },
});

export const retryExamPreparation = mutation({
    args: {
        preparationId: v.id("examPreparations"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const preparation = await ctx.db.get(args.preparationId);
        if (!preparation) {
            throw new ConvexError({
                code: "PREPARATION_NOT_FOUND",
                message: "Exam preparation not found.",
            });
        }

        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: preparation.userId,
        });

        const topic = await ctx.db.get(preparation.topicId);
        if (!topic) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }
        const questionSetVersion = resolveTopicQuestionSetVersion(topic);
        const assessmentVersion = resolveExamAssessmentVersion(
            topic?.assessmentBlueprint?.version || preparation.assessmentVersion || ASSESSMENT_BLUEPRINT_VERSION
        );
        const preparationCompatible = resolvePreparationCompatibility({
            preparation,
            topic,
        });

        if (preparation.status !== "failed" && preparationCompatible) {
            return {
                success: false,
                scheduled: false,
                preparationId: args.preparationId,
                status: preparation.status,
            };
        }

        await ctx.db.patch(args.preparationId, {
            status: "queued",
            stage: "queued",
            reasonCode: undefined,
            errorSummary: undefined,
            message: buildPreparationMessage({
                examFormat: preparation.examFormat,
                status: "queued",
            }),
            attemptId: undefined,
            questionSetVersion,
            assessmentVersion,
            qualityTier: undefined,
            premiumTargetMet: undefined,
            qualityWarnings: undefined,
            qualitySignals: undefined,
            startedAt: Date.now(),
            finishedAt: undefined,
        });

        await ctx.scheduler.runAfter(0, internal.examPreparations.runExamPreparationInternal, {
            preparationId: args.preparationId,
        });

        return {
            success: true,
            scheduled: true,
            preparationId: args.preparationId,
            status: "queued",
        };
    },
});
