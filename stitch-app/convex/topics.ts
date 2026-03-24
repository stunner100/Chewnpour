import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
    assertAuthorizedUser,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import {
    filterQuestionsForActiveAssessment,
    getAssessmentQuestionMetadataIssues,
    ASSESSMENT_BLUEPRINT_VERSION,
} from "./lib/assessmentBlueprint.js";
import {
    countObjectiveQuestionBreakdown,
    createEmptyObjectiveBreakdown,
    getObjectiveSubtypeTargets,
    isEssayQuestionType,
    isObjectiveQuestionType,
    normalizeQuestionType,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    resolveEssayTargetCount,
    resolveObjectiveTargetCount,
} from "./lib/objectiveExam.js";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";
import { areMcqQuestionsNearDuplicate, buildMcqUniquenessSignature } from "./lib/mcqUniqueness";
import {
    areQuestionPromptsNearDuplicate,
    buildQuestionPromptSignature,
    normalizeQuestionPromptKey,
} from "./lib/questionPromptSimilarity";

const DEFAULT_TOPIC_ILLUSTRATION_URL =
    String(process.env.TOPIC_PLACEHOLDER_ILLUSTRATION_URL || "/topic-placeholder.svg").trim()
    || "/topic-placeholder.svg";

const resolveDefaultTopicIllustrationUrl = () => {
    if (
        DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("http://")
        || DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("https://")
        || DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("data:")
    ) {
        return DEFAULT_TOPIC_ILLUSTRATION_URL;
    }
    return DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("/")
        ? DEFAULT_TOPIC_ILLUSTRATION_URL
        : `/${DEFAULT_TOPIC_ILLUSTRATION_URL}`;
};

const EXAM_READY_MIN_OBJECTIVE_COUNT = 10;
const EXAM_READY_MIN_ESSAY_COUNT = 2;

const resolveTopicObjectiveTargetCount = (value: any) =>
    resolveObjectiveTargetCount(value ?? EXAM_READY_MIN_OBJECTIVE_COUNT);

const resolveTopicEssayTargetCount = (value: any) =>
    resolveEssayTargetCount(value ?? EXAM_READY_MIN_ESSAY_COUNT);

const computeTopicExamReadinessFromQuestions = (
    topic: any,
    questions: any[],
    options?: { objectiveTargetCount?: number; essayTargetCount?: number },
) => {
    const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
    const usableObjectiveQuestions = activeQuestions.filter(
        (question) => isObjectiveQuestionType(question?.questionType) && isUsableExamQuestion(question)
    );
    const usableObjectiveBreakdown = countObjectiveQuestionBreakdown(
        usableObjectiveQuestions,
        () => true
    );
    const usableObjectiveCount = usableObjectiveQuestions.length;
    const usableEssayCount = activeQuestions.filter(
        (question) =>
            isEssayQuestionType(question?.questionType)
            && isUsableExamQuestion(question, { allowEssay: true })
    ).length;
    const objectiveTargetCount = resolveTopicObjectiveTargetCount(
        options?.objectiveTargetCount ?? topic?.objectiveTargetCount
    );
    const essayTargetCount = resolveTopicEssayTargetCount(options?.essayTargetCount);
    const subtypeTargets = getObjectiveSubtypeTargets(objectiveTargetCount);
    const objectiveReady = topic?.assessmentBlueprint?.version === ASSESSMENT_BLUEPRINT_VERSION
        ? usableObjectiveCount >= objectiveTargetCount
            && Object.entries(subtypeTargets).every(
                ([questionType, targetCount]) =>
                    Number(usableObjectiveBreakdown[questionType] || 0) >= Number(targetCount || 0)
            )
        : usableObjectiveCount >= objectiveTargetCount;
    const examReady =
        objectiveReady
        && usableEssayCount >= essayTargetCount;

    return {
        objectiveTargetCount,
        essayTargetCount,
        usableObjectiveCount,
        usableObjectiveBreakdown,
        usableEssayCount,
        examReady,
    };
};

const dedupeTopicQuestions = (questions: any[]) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenMcqSignatures: any[] = [];
    const seenObjectivePromptSignatures: any[] = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        if (isEssayQuestionType(question?.questionType)) {
            deduped.push(question);
            continue;
        }

        const normalizedQuestionType = normalizeQuestionType(question?.questionType);
        if (normalizedQuestionType !== QUESTION_TYPE_MULTIPLE_CHOICE) {
            const signature = buildQuestionPromptSignature(question?.questionText || "");
            if (!signature?.normalized) continue;
            if (seenObjectivePromptSignatures.some((prior) => areQuestionPromptsNearDuplicate(signature, prior))) {
                continue;
            }
            seenObjectivePromptSignatures.push(signature);
            deduped.push({
                ...question,
                questionType: normalizedQuestionType,
            });
            continue;
        }

        const signature = buildMcqUniquenessSignature(question);
        if (seenMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(signature, prior))) {
            continue;
        }

        seenMcqSignatures.push(signature);
        deduped.push(question);
    }

    return deduped;
};

const getTopicWithQuestionsPayload = async (ctx: any, topicId: any) => {
    const safeGetDocument = async (id: any) => {
        if (!id) return null;
        try {
            return await ctx.db.get(id);
        } catch {
            return null;
        }
    };

    const topic = await safeGetDocument(topicId);
    if (!topic) return null;
    const course = await safeGetDocument(topic.courseId);
    if (!course) return null;

    let freshIllustrationUrl: string | undefined =
        topic.illustrationUrl || resolveDefaultTopicIllustrationUrl();
    if (topic.illustrationStorageId) {
        const resolvedStorageUrl =
            (await resolveIllustrationUrl({
                illustrationStorageId: topic.illustrationStorageId,
                getUrl: (storageId) => ctx.storage.getUrl(storageId),
            })) || undefined;
        if (resolvedStorageUrl) {
            freshIllustrationUrl = resolvedStorageUrl;
        }
    }

    let questions: any[] = [];
    try {
        questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q: any) => q.eq("topicId", topicId))
            .collect();
    } catch {
        questions = [];
    }
    const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
    const dedupedQuestions = dedupeTopicQuestions(activeQuestions);
    const safeQuestions = dedupedQuestions
        .filter((question: any) =>
            isUsableExamQuestion(question, {
                allowEssay: String(question?.questionType || "") === "essay",
            })
        )
        .map((question: any) => sanitizeExamQuestionForClient(question));
    const computedReadiness = computeTopicExamReadinessFromQuestions(topic, dedupedQuestions, {
        objectiveTargetCount: topic?.objectiveTargetCount,
        essayTargetCount: topic?.essayTargetCount,
    });

    return {
        topic: {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            objectiveTargetCount: computedReadiness.objectiveTargetCount,
            essayTargetCount: computedReadiness.essayTargetCount,
            usableObjectiveCount: computedReadiness.usableObjectiveCount,
            usableObjectiveBreakdown: computedReadiness.usableObjectiveBreakdown,
            usableEssayCount: computedReadiness.usableEssayCount,
            examReady: computedReadiness.examReady,
            questions: safeQuestions,
        },
        ownerUserId: course.userId,
    };
};

// Get all topics for a course
export const getTopicsByCourse = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .order("asc")
            .collect();

        const topicsWithIllustrations = await Promise.all(
            topics.map(async (topic) => {
                let freshIllustrationUrl: string | undefined =
                    topic.illustrationUrl || resolveDefaultTopicIllustrationUrl();

                if (topic.illustrationStorageId) {
                    const resolvedStorageUrl = await resolveIllustrationUrl({
                        illustrationStorageId: topic.illustrationStorageId,
                        getUrl: (storageId) => ctx.storage.getUrl(storageId),
                    });
                    if (resolvedStorageUrl) {
                        freshIllustrationUrl = resolvedStorageUrl;
                    }
                }

                return {
                    ...topic,
                    // Convex storage URLs are signed and can expire; refresh on each read.
                    illustrationUrl: freshIllustrationUrl,
                };
            })
        );

        return topicsWithIllustrations;
    },
});

// Get single topic with its questions
export const getTopicWithQuestions = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const payload = await getTopicWithQuestionsPayload(ctx, args.topicId);
        if (!payload) return null;

        try {
            assertAuthorizedUser({
                authUserId,
                resourceOwnerUserId: payload.ownerUserId,
            });
        } catch {
            return null;
        }

        return payload.topic;
    },
});

export const getTopicWithQuestionsInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const payload = await getTopicWithQuestionsPayload(ctx, args.topicId);
        if (!payload) return null;
        const rawQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const activeQuestions = dedupeTopicQuestions(filterQuestionsForActiveAssessment({
            topic: payload.topic,
            questions: rawQuestions,
        }));
        const computedReadiness = computeTopicExamReadinessFromQuestions(payload.topic, activeQuestions, {
            objectiveTargetCount: payload.topic?.objectiveTargetCount,
            essayTargetCount: payload.topic?.essayTargetCount,
        });
        return {
            ...payload.topic,
            objectiveTargetCount: computedReadiness.objectiveTargetCount,
            essayTargetCount: computedReadiness.essayTargetCount,
            usableObjectiveCount: computedReadiness.usableObjectiveCount,
            usableObjectiveBreakdown: computedReadiness.usableObjectiveBreakdown,
            usableEssayCount: computedReadiness.usableEssayCount,
            examReady: computedReadiness.examReady,
            questions: activeQuestions,
        };
    },
});

// Get topic owner user id (for server-side authorization checks)
export const getTopicOwnerUserIdInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;
        const course = await ctx.db.get(topic.courseId);
        if (!course) return null;
        return {
            topicId: topic._id,
            courseId: topic.courseId,
            userId: course.userId,
        };
    },
});

// Get questions for a topic (for exam mode)
export const getQuestionsByTopic = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        // Shuffle questions for randomized exams
        return dedupeTopicQuestions(filterQuestionsForActiveAssessment({
            topic,
            questions,
        }))
            .filter((question) =>
                isUsableExamQuestion(question, {
                    allowEssay: String(question?.questionType || "") === "essay",
                })
            )
            .map((question) => sanitizeExamQuestionForClient(question))
            .sort(() => Math.random() - 0.5);
    },
});

export const getRawQuestionsByTopicInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
    },
});

// Create a new topic
export const createTopic = mutation({
    args: {
        courseId: v.id("courses"),
        sourceUploadId: v.optional(v.id("uploads")),
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()),
        sourceChunkIds: v.optional(v.array(v.number())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingVersion: v.optional(v.string()),
        illustrationStorageId: v.optional(v.id("_storage")),
        illustrationUrl: v.optional(v.string()),
        orderIndex: v.number(),
        isLocked: v.boolean(),
    },
    handler: async (ctx, args) => {
        const topicId = await ctx.db.insert("topics", {
            courseId: args.courseId,
            sourceUploadId: args.sourceUploadId,
            title: args.title,
            description: args.description,
            content: args.content,
            sourceChunkIds: args.sourceChunkIds,
            sourcePassageIds: args.sourcePassageIds,
            groundingVersion: args.groundingVersion,
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl || resolveDefaultTopicIllustrationUrl(),
            examReady: false,
            objectiveTargetCount: EXAM_READY_MIN_OBJECTIVE_COUNT,
            essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
            usableObjectiveCount: 0,
            usableObjectiveBreakdown: createEmptyObjectiveBreakdown(),
            usableEssayCount: 0,
            examReadyUpdatedAt: Date.now(),
            orderIndex: args.orderIndex,
            isLocked: args.isLocked,
        });

        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "topic",
            entityId: topicId,
        }).catch(() => undefined);

        return topicId;
    },
});

export const refreshTopicExamReadinessInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        objectiveTargetCount: v.optional(v.number()),
        essayTargetCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                topicId: args.topicId,
                exists: false,
                examReady: false,
                objectiveTargetCount: EXAM_READY_MIN_OBJECTIVE_COUNT,
                essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
                usableObjectiveCount: 0,
                usableObjectiveBreakdown: createEmptyObjectiveBreakdown(),
                usableEssayCount: 0,
            };
        }

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, questions, {
            objectiveTargetCount: args.objectiveTargetCount ?? topic.objectiveTargetCount,
            essayTargetCount: args.essayTargetCount ?? topic.essayTargetCount,
        });

        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            objectiveTargetCount: readiness.objectiveTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableObjectiveCount: readiness.usableObjectiveCount,
            usableObjectiveBreakdown: readiness.usableObjectiveBreakdown,
            usableEssayCount: readiness.usableEssayCount,
            examReadyUpdatedAt: Date.now(),
        });

        return {
            topicId: args.topicId,
            exists: true,
            ...readiness,
        };
    },
});

export const saveAssessmentBlueprintInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        assessmentBlueprint: v.any(),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        await ctx.db.patch(args.topicId, {
            assessmentBlueprint: args.assessmentBlueprint,
            examReady: false,
            examReadyUpdatedAt: Date.now(),
        });

        return {
            topicId: args.topicId,
            version: String(args.assessmentBlueprint?.version || ASSESSMENT_BLUEPRINT_VERSION),
        };
    },
});

// Generation lock TTLs — kept close to actual generation time budgets so
// stale locks don't block new requests for too long.
const OBJECTIVE_GENERATION_LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes (objective budget is ~180s)
const ESSAY_GENERATION_LOCK_TTL_MS = 60 * 1000;         // 60 seconds (essay budget is ~30s)

/**
 * Attempt to acquire a generation lock for the given topic + format.
 * Returns { acquired: true } if the lock was set, or { acquired: false }
 * if another generation is already in progress (lock not yet expired).
 */
export const acquireGenerationLockInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        format: v.string(), // 'objective' | 'essay'
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                acquired: false,
                now: Date.now(),
                lockWaitMs: 0,
                lockedUntil: 0,
                ttlMs: 0,
            };
        }

        const now = Date.now();
        const normalizedFormat = String(args.format || "").trim().toLowerCase();
        const lockField = normalizedFormat === "essay"
            ? "essayGenerationLockedUntil"
            : "objectiveGenerationLockedUntil";
        const currentLock = Number((topic as any)[lockField] || 0);
        const ttlMs = normalizedFormat === "essay"
            ? ESSAY_GENERATION_LOCK_TTL_MS
            : OBJECTIVE_GENERATION_LOCK_TTL_MS;

        if (currentLock > now) {
            // Lock is still held and not expired
            return {
                acquired: false,
                now,
                lockWaitMs: currentLock - now,
                lockedUntil: currentLock,
                ttlMs,
            };
        }

        const lockedUntil = now + ttlMs;
        await ctx.db.patch(args.topicId, {
            [lockField]: lockedUntil,
        });

        return {
            acquired: true,
            now,
            lockWaitMs: 0,
            lockedUntil,
            ttlMs,
        };
    },
});

/**
 * Release a generation lock after generation completes (or fails).
 */
export const releaseGenerationLockInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        format: v.string(), // 'objective' | 'essay'
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return;

        const normalizedFormat = String(args.format || "").trim().toLowerCase();
        const lockField = normalizedFormat === "essay"
            ? "essayGenerationLockedUntil"
            : "objectiveGenerationLockedUntil";

        await ctx.db.patch(args.topicId, {
            [lockField]: 0,
        });
    },
});

export const updateTopicIllustration = mutation({
    args: {
        topicId: v.id("topics"),
        illustrationStorageId: v.optional(v.id("_storage")),
        illustrationUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        await ctx.db.patch(args.topicId, {
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl,
        });

        return { success: true };
    },
});


// Unlock a topic
export const unlockTopic = mutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.topicId, {
            isLocked: false,
        });
    },
});

// Create a question for a topic
export const createQuestionInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        questionText: v.string(),
        questionType: v.string(),
        options: v.optional(v.any()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.optional(v.string()),
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()),
        factualityStatus: v.optional(v.string()),
        generationVersion: v.optional(v.string()),
        learningObjective: v.optional(v.string()),
        bloomLevel: v.optional(v.string()),
        outcomeKey: v.optional(v.string()),
        authenticContext: v.optional(v.string()),
        templateParts: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        acceptedAnswers: v.optional(v.array(v.string())),
        fillBlankMode: v.optional(v.string()),
        rubricPoints: v.optional(v.array(v.string())),
        qualityFlags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        if (String(args.generationVersion || "").trim() === ASSESSMENT_BLUEPRINT_VERSION) {
            const metadataIssues = getAssessmentQuestionMetadataIssues({
                question: args,
                questionType: args.questionType,
            });
            if (metadataIssues.length > 0) {
                throw new Error(`Assessment metadata invalid: ${metadataIssues.join(", ")}`);
            }
        }

        const normalizedQuestionType = normalizeQuestionType(args.questionType);
        if (!isEssayQuestionType(normalizedQuestionType)) {
            const existingQuestions = await ctx.db
                .query("questions")
                .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
                .collect();
            const duplicateExists = normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE
                ? (() => {
                    const candidateSignature = buildMcqUniquenessSignature({
                        questionText: args.questionText,
                        options: args.options,
                        correctAnswer: args.correctAnswer,
                        citations: args.citations,
                    });
                    return existingQuestions
                        .filter((question: any) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_MULTIPLE_CHOICE)
                        .some((question: any) =>
                            areMcqQuestionsNearDuplicate(candidateSignature, buildMcqUniquenessSignature(question))
                        );
                })()
                : (() => {
                    const candidateSignature = buildQuestionPromptSignature(args.questionText);
                    return existingQuestions
                        .filter((question: any) => isObjectiveQuestionType(question?.questionType))
                        .some((question: any) =>
                            areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                        );
                })();
            if (duplicateExists) {
                return null;
            }
        }

        const questionId = await ctx.db.insert("questions", {
            topicId: args.topicId,
            questionText: args.questionText,
            questionType: normalizedQuestionType,
            options: args.options,
            correctAnswer: args.correctAnswer,
            explanation: args.explanation,
            difficulty: args.difficulty,
            citations: args.citations,
            sourcePassageIds: args.sourcePassageIds,
            groundingScore: args.groundingScore,
            factualityStatus: args.factualityStatus,
            generationVersion: args.generationVersion,
            learningObjective: args.learningObjective,
            bloomLevel: args.bloomLevel,
            outcomeKey: args.outcomeKey,
            authenticContext: args.authenticContext,
            templateParts: args.templateParts,
            tokens: args.tokens,
            acceptedAnswers: args.acceptedAnswers,
            fillBlankMode: args.fillBlankMode,
            rubricPoints: args.rubricPoints,
            qualityFlags: args.qualityFlags,
        });

        return questionId;
    },
});

// Delete all questions for a topic (used for regeneration)
export const deleteQuestionsByTopicInternal = internalMutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        for (const question of questions) {
            await ctx.db.delete(question._id);
        }

        await ctx.db.patch(args.topicId, {
            examReady: false,
            usableObjectiveCount: 0,
            usableObjectiveBreakdown: createEmptyObjectiveBreakdown(),
            usableEssayCount: 0,
            examReadyUpdatedAt: Date.now(),
        });

        return { deleted: questions.length };
    },
});

export const deleteObjectiveQuestionsByTopicInternal = internalMutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                deleted: 0,
                remainingEssayCount: 0,
                examReady: false,
            };
        }
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        let deleted = 0;
        const remainingQuestions = [];
        for (const question of questions) {
            if (isEssayQuestionType(question?.questionType)) {
                remainingQuestions.push(question);
                continue;
            }
            await ctx.db.delete(question._id);
            deleted += 1;
        }

        const readiness = computeTopicExamReadinessFromQuestions(topic, remainingQuestions, {
            objectiveTargetCount: topic.objectiveTargetCount,
            essayTargetCount: topic.essayTargetCount,
        });
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            objectiveTargetCount: readiness.objectiveTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableObjectiveCount: readiness.usableObjectiveCount,
            usableObjectiveBreakdown: readiness.usableObjectiveBreakdown,
            usableEssayCount: readiness.usableEssayCount,
            examReadyUpdatedAt: Date.now(),
        });

        return {
            deleted,
            remainingEssayCount: readiness.usableEssayCount,
            examReady: readiness.examReady,
        };
    },
});


// Batch create questions (for AI-generated content)
export const batchCreateQuestionsInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        questions: v.array(
            v.object({
                questionText: v.string(),
                questionType: v.string(),
                options: v.optional(v.any()),
                correctAnswer: v.string(),
                explanation: v.optional(v.string()),
                citations: v.optional(v.array(v.any())),
                sourcePassageIds: v.optional(v.array(v.string())),
                groundingScore: v.optional(v.number()),
                factualityStatus: v.optional(v.string()),
                generationVersion: v.optional(v.string()),
                learningObjective: v.optional(v.string()),
                bloomLevel: v.optional(v.string()),
                outcomeKey: v.optional(v.string()),
                authenticContext: v.optional(v.string()),
                templateParts: v.optional(v.array(v.string())),
                tokens: v.optional(v.array(v.string())),
                acceptedAnswers: v.optional(v.array(v.string())),
                fillBlankMode: v.optional(v.string()),
                rubricPoints: v.optional(v.array(v.string())),
                qualityFlags: v.optional(v.array(v.string())),
            })
        ),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }
        const questionIds = [];
        const existingQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const acceptedMcqSignatures = existingQuestions
            .filter((question: any) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_MULTIPLE_CHOICE)
            .map((question: any) => buildMcqUniquenessSignature(question));
        const acceptedObjectivePromptSignatures = existingQuestions
            .filter((question: any) =>
                isObjectiveQuestionType(question?.questionType)
                && normalizeQuestionType(question?.questionType) !== QUESTION_TYPE_MULTIPLE_CHOICE
            )
            .map((question: any) => buildQuestionPromptSignature(question?.questionText || ""));
        for (const q of args.questions) {
            if (String(q.generationVersion || "").trim() === ASSESSMENT_BLUEPRINT_VERSION) {
                const metadataIssues = getAssessmentQuestionMetadataIssues({
                    question: q,
                    questionType: q.questionType,
                });
                if (metadataIssues.length > 0) {
                    continue;
                }
            }
            const normalizedQuestionType = normalizeQuestionType(q.questionType);
            if (!isEssayQuestionType(normalizedQuestionType)) {
                if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
                    const candidateSignature = buildMcqUniquenessSignature(q);
                    if (acceptedMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(candidateSignature, prior))) {
                        continue;
                    }
                    acceptedMcqSignatures.push(candidateSignature);
                } else {
                    const candidateSignature = buildQuestionPromptSignature(q.questionText || "");
                    if (acceptedObjectivePromptSignatures.some((prior) => areQuestionPromptsNearDuplicate(candidateSignature, prior))) {
                        continue;
                    }
                    acceptedObjectivePromptSignatures.push(candidateSignature);
                }
            }
            const id = await ctx.db.insert("questions", {
                topicId: args.topicId,
                ...q,
                questionType: normalizedQuestionType,
            });
            questionIds.push(id);
        }

        const topicQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, topicQuestions, {
            objectiveTargetCount: topic.objectiveTargetCount,
            essayTargetCount: topic.essayTargetCount,
        });
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            objectiveTargetCount: readiness.objectiveTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableObjectiveCount: readiness.usableObjectiveCount,
            usableObjectiveBreakdown: readiness.usableObjectiveBreakdown,
            usableEssayCount: readiness.usableEssayCount,
            examReadyUpdatedAt: Date.now(),
        });

        return questionIds;
    },
});
