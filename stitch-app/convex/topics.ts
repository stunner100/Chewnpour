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
import { normalizeQuestionType, QUESTION_TYPE_MULTIPLE_CHOICE } from "./lib/objectiveExam.js";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";
import { areMcqQuestionsNearDuplicate, buildMcqUniquenessSignature } from "./lib/mcqUniqueness";
import { areQuestionPromptsNearDuplicate, buildQuestionPromptSignature } from "./lib/questionPromptSimilarity";
import {
    ASSESSMENT_CLASSIFICATION_DOCUMENT,
    ASSESSMENT_CLASSIFICATION_STRONG,
    ASSESSMENT_ROUTE_DOCUMENT_FINAL_EXAM,
    ASSESSMENT_ROUTE_TOPIC_QUIZ,
    TOPIC_KIND_DOCUMENT_FINAL_EXAM,
    TOPIC_KIND_LESSON,
    buildDocumentFinalExamTopic,
    isDocumentFinalExamTopic,
} from "./lib/assessmentRouting.js";

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

const EXAM_READY_MIN_MCQ_COUNT = 10;
const EXAM_READY_MIN_ESSAY_COUNT = 3;

const resolveTopicMcqTargetCount = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return EXAM_READY_MIN_MCQ_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

const resolveTopicEssayTargetCount = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return EXAM_READY_MIN_ESSAY_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

const computeTopicExamReadinessFromQuestions = (
    topic: any,
    questions: any[],
    options?: { mcqTargetCount?: number; essayTargetCount?: number },
) => {
    const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
    const usableMcqCount = activeQuestions.filter(
        (question) =>
            question?.questionType !== "essay"
            && isUsableExamQuestion(question)
    ).length;
    const usableEssayCount = activeQuestions.filter(
        (question) =>
            question?.questionType === "essay"
            && isUsableExamQuestion(question, { allowEssay: true })
    ).length;
    const mcqTargetCount = resolveTopicMcqTargetCount(options?.mcqTargetCount);
    const essayTargetCount = resolveTopicEssayTargetCount(options?.essayTargetCount);
    const examReady =
        usableMcqCount >= mcqTargetCount
        && usableEssayCount >= essayTargetCount;

    return {
        mcqTargetCount,
        essayTargetCount,
        usableMcqCount,
        usableEssayCount,
        examReady,
    };
};

const dedupeTopicQuestions = (questions: any[]) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenMcqSignatures: any[] = [];
    const seenEssaySignatures: any[] = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        if (String(question?.questionType || "") === "essay") {
            const essaySignature = buildQuestionPromptSignature(question?.questionText || "");
            if (
                essaySignature?.normalized
                && seenEssaySignatures.some((prior) =>
                    areQuestionPromptsNearDuplicate(essaySignature, prior)
                )
            ) {
                continue;
            }
            if (essaySignature?.normalized) {
                seenEssaySignatures.push(essaySignature);
            }
            deduped.push(question);
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
        mcqTargetCount: topic?.mcqTargetCount,
        essayTargetCount: topic?.essayTargetCount,
    });

    return {
        topic: {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            mcqTargetCount: computedReadiness.mcqTargetCount,
            essayTargetCount: computedReadiness.essayTargetCount,
            usableMcqCount: computedReadiness.usableMcqCount,
            usableEssayCount: computedReadiness.usableEssayCount,
            examReady: computedReadiness.examReady,
            questions: safeQuestions,
        },
        ownerUserId: course.userId,
    };
};

const resolveTopicIdFromRoute = (ctx: any, routeId: unknown) => {
    const normalizedRouteId = typeof routeId === "string" ? routeId.trim() : "";
    if (!normalizedRouteId) return null;
    try {
        return ctx.db.normalizeId("topics", normalizedRouteId);
    } catch {
        return null;
    }
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
        const lessonTopics = topics.filter((topic) => !isDocumentFinalExamTopic(topic));

        const topicsWithIllustrations = await Promise.all(
            lessonTopics.map(async (topic) => {
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
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return null;

        const payload = await getTopicWithQuestionsPayload(ctx, topicId);
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
            mcqTargetCount: payload.topic?.mcqTargetCount,
            essayTargetCount: payload.topic?.essayTargetCount,
        });
        return {
            ...payload.topic,
            mcqTargetCount: computedReadiness.mcqTargetCount,
            essayTargetCount: computedReadiness.essayTargetCount,
            usableMcqCount: computedReadiness.usableMcqCount,
            usableEssayCount: computedReadiness.usableEssayCount,
            examReady: computedReadiness.examReady,
            questions: activeQuestions,
        };
    },
});

export const getTopicInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.topicId);
    },
});

export const getLessonTopicsByCourseAndUploadInternal = internalQuery({
    args: {
        courseId: v.id("courses"),
        sourceUploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .collect();
        return topics
            .filter((topic) =>
                !isDocumentFinalExamTopic(topic)
                && topic.sourceUploadId === args.sourceUploadId
            )
            .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
    },
});

export const getFinalAssessmentTopicByCourseAndUpload = query({
    args: {
        courseId: v.id("courses"),
        sourceUploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const course = await ctx.db.get(args.courseId);
        if (!course) return null;

        try {
            assertAuthorizedUser({
                authUserId,
                resourceOwnerUserId: course.userId,
            });
        } catch {
            return null;
        }

        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId_topicKind", (q) =>
                q.eq("courseId", args.courseId).eq("topicKind", TOPIC_KIND_DOCUMENT_FINAL_EXAM)
            )
            .collect();

        return topics.find((topic) => topic.sourceUploadId === args.sourceUploadId) || null;
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
            topicKind: TOPIC_KIND_LESSON,
            title: args.title,
            description: args.description,
            content: args.content,
            sourceChunkIds: args.sourceChunkIds,
            sourcePassageIds: args.sourcePassageIds,
            groundingVersion: args.groundingVersion,
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl || resolveDefaultTopicIllustrationUrl(),
            assessmentClassification: ASSESSMENT_CLASSIFICATION_STRONG,
            assessmentRoute: ASSESSMENT_ROUTE_TOPIC_QUIZ,
            assessmentRouteReason: "This topic is being prepared for a standalone quiz.",
            assessmentReadinessScore: 100,
            evidenceVolumeScore: 30,
            evidenceDiversityScore: 20,
            distinctivenessScore: 15,
            questionVarietyScore: 20,
            redundancyRiskScore: 0,
            examReady: false,
            mcqTargetCount: EXAM_READY_MIN_MCQ_COUNT,
            essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
            usableMcqCount: 0,
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

export const updateTopicAssessmentRoutingInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        topicKind: v.optional(v.string()),
        assessmentClassification: v.string(),
        assessmentRoute: v.string(),
        assessmentRouteReason: v.string(),
        assessmentReadinessScore: v.number(),
        evidenceVolumeScore: v.number(),
        evidenceDiversityScore: v.number(),
        distinctivenessScore: v.number(),
        questionVarietyScore: v.number(),
        redundancyRiskScore: v.number(),
        supportedQuestionTypes: v.optional(v.array(v.string())),
        strongestNeighborOverlap: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;

        await ctx.db.patch(args.topicId, {
            topicKind: args.topicKind || topic.topicKind || TOPIC_KIND_LESSON,
            assessmentClassification: args.assessmentClassification,
            assessmentRoute: args.assessmentRoute,
            assessmentRouteReason: args.assessmentRouteReason,
            assessmentReadinessScore: args.assessmentReadinessScore,
            evidenceVolumeScore: args.evidenceVolumeScore,
            evidenceDiversityScore: args.evidenceDiversityScore,
            distinctivenessScore: args.distinctivenessScore,
            questionVarietyScore: args.questionVarietyScore,
            redundancyRiskScore: args.redundancyRiskScore,
            supportedQuestionTypes: args.supportedQuestionTypes,
            strongestNeighborOverlap: args.strongestNeighborOverlap,
        });

        return { topicId: args.topicId };
    },
});

export const upsertDocumentFinalExamTopicInternal = internalMutation({
    args: {
        courseId: v.id("courses"),
        sourceUploadId: v.id("uploads"),
        courseTitle: v.optional(v.string()),
        lessonTopics: v.array(v.object({
            _id: v.id("topics"),
            title: v.string(),
            description: v.optional(v.string()),
            sourcePassageIds: v.optional(v.array(v.string())),
            orderIndex: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        const derived = buildDocumentFinalExamTopic({
            courseTitle: args.courseTitle,
            lessonTopics: args.lessonTopics,
        });

        const existingTopics = await ctx.db
            .query("topics")
            .withIndex("by_courseId_topicKind", (q) =>
                q.eq("courseId", args.courseId).eq("topicKind", TOPIC_KIND_DOCUMENT_FINAL_EXAM)
            )
            .collect();
        const existing = existingTopics.find((topic) => topic.sourceUploadId === args.sourceUploadId) || null;

        const patch = {
            sourceUploadId: args.sourceUploadId,
            topicKind: TOPIC_KIND_DOCUMENT_FINAL_EXAM,
            title: derived.title,
            description: derived.description,
            content: derived.content,
            sourcePassageIds: derived.sourcePassageIds,
            assessmentClassification: ASSESSMENT_CLASSIFICATION_DOCUMENT,
            assessmentRoute: ASSESSMENT_ROUTE_DOCUMENT_FINAL_EXAM,
            assessmentRouteReason: derived.assessmentRouteReason,
            assessmentReadinessScore: derived.assessmentReadinessScore,
            evidenceVolumeScore: derived.evidenceVolumeScore,
            evidenceDiversityScore: derived.evidenceDiversityScore,
            distinctivenessScore: derived.distinctivenessScore,
            questionVarietyScore: derived.questionVarietyScore,
            redundancyRiskScore: derived.redundancyRiskScore,
            examReady: false,
            mcqTargetCount: EXAM_READY_MIN_MCQ_COUNT,
            essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
            usableMcqCount: 0,
            usableEssayCount: 0,
            examReadyUpdatedAt: Date.now(),
            isLocked: false,
        };

        if (existing?._id) {
            await ctx.db.patch(existing._id, patch);
            return existing._id;
        }

        return await ctx.db.insert("topics", {
            courseId: args.courseId,
            orderIndex: 1000000 + args.lessonTopics.length,
            illustrationUrl: resolveDefaultTopicIllustrationUrl(),
            ...patch,
        });
    },
});

export const refreshTopicExamReadinessInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        mcqTargetCount: v.optional(v.number()),
        essayTargetCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                topicId: args.topicId,
                exists: false,
                examReady: false,
                mcqTargetCount: EXAM_READY_MIN_MCQ_COUNT,
                essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
                usableMcqCount: 0,
                usableEssayCount: 0,
            };
        }

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, questions, {
            mcqTargetCount: args.mcqTargetCount ?? topic.mcqTargetCount,
            essayTargetCount: args.essayTargetCount ?? topic.essayTargetCount,
        });

        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            mcqTargetCount: readiness.mcqTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableMcqCount: readiness.usableMcqCount,
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
const MCQ_GENERATION_LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes (MCQ budget is ~180s)
const ESSAY_GENERATION_LOCK_TTL_MS = 60 * 1000;    // 60 seconds (essay budget is ~30s)

/**
 * Attempt to acquire a generation lock for the given topic + format.
 * Returns { acquired: true } if the lock was set, or { acquired: false }
 * if another generation is already in progress (lock not yet expired).
 */
export const acquireGenerationLockInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        format: v.string(), // 'mcq' | 'essay'
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
        const lockField = args.format === "essay"
            ? "essayGenerationLockedUntil"
            : "mcqGenerationLockedUntil";
        const currentLock = Number((topic as any)[lockField] || 0);
        const ttlMs = args.format === "essay"
            ? ESSAY_GENERATION_LOCK_TTL_MS
            : MCQ_GENERATION_LOCK_TTL_MS;

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
            [lockField]: now + ttlMs,
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
        format: v.string(), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return;

        const lockField = args.format === "essay"
            ? "essayGenerationLockedUntil"
            : "mcqGenerationLockedUntil";

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
        rubricPoints: v.optional(v.array(v.string())),
        generationRunId: v.optional(v.string()),
        qualityScore: v.optional(v.number()),
        qualityTier: v.optional(v.string()),
        rigorScore: v.optional(v.number()),
        clarityScore: v.optional(v.number()),
        diversityCluster: v.optional(v.string()),
        distractorScore: v.optional(v.number()),
        freshnessBucket: v.optional(v.string()),
        qualityFlags: v.optional(v.array(v.string())),
        templateParts: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        acceptedAnswers: v.optional(v.array(v.string())),
        fillBlankMode: v.optional(v.string()),
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

        const existingQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const normalizedQuestionType = normalizeQuestionType(args.questionType);
        if (normalizedQuestionType === "essay") {
            const candidateSignature = buildQuestionPromptSignature(args.questionText);
            const duplicateExists = existingQuestions
                .filter((question: any) => String(question?.questionType || "").trim().toLowerCase() === "essay")
                .some((question: any) =>
                    areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                );
            if (duplicateExists) {
                return null;
            }
        } else if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
            const candidateSignature = buildMcqUniquenessSignature({
                questionText: args.questionText,
                options: args.options,
                correctAnswer: args.correctAnswer,
                citations: args.citations,
            });
            const duplicateExists = existingQuestions
                .filter((question: any) => String(question?.questionType || "").trim().toLowerCase() !== "essay")
                .some((question: any) =>
                    areMcqQuestionsNearDuplicate(candidateSignature, buildMcqUniquenessSignature(question))
                );
            if (duplicateExists) {
                return null;
            }
        } else {
            const candidateSignature = buildQuestionPromptSignature(args.questionText);
            const duplicateExists = existingQuestions
                .filter((question: any) => normalizeQuestionType(question?.questionType) === normalizedQuestionType)
                .some((question: any) =>
                    areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                );
            if (duplicateExists) {
                return null;
            }
        }

        const questionId = await ctx.db.insert("questions", {
            topicId: args.topicId,
            questionText: args.questionText,
            questionType: args.questionType,
            options: args.options,
            correctAnswer: args.correctAnswer,
            explanation: args.explanation,
            difficulty: args.difficulty,
            citations: args.citations,
            sourcePassageIds: args.sourcePassageIds,
            groundingScore: args.groundingScore,
            factualityStatus: args.factualityStatus,
            generationVersion: args.generationVersion,
            generationRunId: args.generationRunId,
            learningObjective: args.learningObjective,
            bloomLevel: args.bloomLevel,
            outcomeKey: args.outcomeKey,
            authenticContext: args.authenticContext,
            templateParts: args.templateParts,
            tokens: args.tokens,
            acceptedAnswers: args.acceptedAnswers,
            fillBlankMode: args.fillBlankMode,
            rubricPoints: args.rubricPoints,
            qualityScore: args.qualityScore,
            qualityTier: args.qualityTier,
            rigorScore: args.rigorScore,
            clarityScore: args.clarityScore,
            diversityCluster: args.diversityCluster,
            distractorScore: args.distractorScore,
            freshnessBucket: args.freshnessBucket,
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
            usableMcqCount: 0,
            usableEssayCount: 0,
            examReadyUpdatedAt: Date.now(),
        });

        return { deleted: questions.length };
    },
});

export const deleteMcqQuestionsByTopicInternal = internalMutation({
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
            if (String(question?.questionType || "") === "essay") {
                remainingQuestions.push(question);
                continue;
            }
            await ctx.db.delete(question._id);
            deleted += 1;
        }

        const readiness = computeTopicExamReadinessFromQuestions(topic, remainingQuestions, {
            mcqTargetCount: topic.mcqTargetCount,
            essayTargetCount: topic.essayTargetCount,
        });
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            mcqTargetCount: readiness.mcqTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableMcqCount: readiness.usableMcqCount,
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
                qualityTier: v.optional(v.string()),
                rigorScore: v.optional(v.number()),
                clarityScore: v.optional(v.number()),
                diversityCluster: v.optional(v.string()),
                distractorScore: v.optional(v.number()),
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
            if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
                const candidateSignature = buildMcqUniquenessSignature(q);
                if (acceptedMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(candidateSignature, prior))) {
                    continue;
                }
                acceptedMcqSignatures.push(candidateSignature);
            } else if (normalizedQuestionType !== "essay") {
                const candidateSignature = buildQuestionPromptSignature(q.questionText);
                const duplicateExists = existingQuestions
                    .filter((question: any) => normalizeQuestionType(question?.questionType) === normalizedQuestionType)
                    .some((question: any) =>
                        areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                    );
                if (duplicateExists) {
                    continue;
                }
            }
            const id = await ctx.db.insert("questions", {
                topicId: args.topicId,
                ...q,
            });
            questionIds.push(id);
        }

        const topicQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, topicQuestions, {
            mcqTargetCount: topic.mcqTargetCount,
            essayTargetCount: topic.essayTargetCount,
        });
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            mcqTargetCount: readiness.mcqTargetCount,
            essayTargetCount: readiness.essayTargetCount,
            usableMcqCount: readiness.usableMcqCount,
            usableEssayCount: readiness.usableEssayCount,
            examReadyUpdatedAt: Date.now(),
        });

        return questionIds;
    },
});

// ─── User Topic Progress ────────────────────────────────────────────

export const upsertTopicProgress = mutation({
    args: {
        topicId: v.string(),
        lastStudiedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        bestScore: v.optional(v.number()),
        attemptCount: v.optional(v.number()),
        termsStarred: v.optional(v.array(v.string())),
        studyMode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) throw new Error("Unauthenticated");

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) throw new Error("Invalid topicId");

        const topic = await ctx.db.get(topicId);
        if (!topic) throw new Error("Topic not found");

        const existing = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", authUserId).eq("topicId", topicId)
            )
            .first();

        const now = Date.now();
        const patch: Record<string, any> = {
            lastStudiedAt: args.lastStudiedAt ?? now,
        };
        if (args.completedAt !== undefined) patch.completedAt = args.completedAt;
        if (args.bestScore !== undefined) patch.bestScore = args.bestScore;
        if (args.attemptCount !== undefined) patch.attemptCount = args.attemptCount;
        if (args.termsStarred !== undefined) patch.termsStarred = args.termsStarred;
        if (args.studyMode !== undefined) patch.studyMode = args.studyMode;

        if (existing) {
            // Only update bestScore if the new score is higher
            if (
                args.bestScore !== undefined &&
                existing.bestScore !== undefined &&
                args.bestScore <= existing.bestScore
            ) {
                delete patch.bestScore;
            }
            await ctx.db.patch(existing._id, patch);
            return existing._id;
        }

        return await ctx.db.insert("userTopicProgress", {
            userId: authUserId,
            topicId,
            courseId: topic.courseId,
            ...patch,
        });
    },
});

export const getUserTopicProgress = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return null;

        return await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", authUserId).eq("topicId", topicId)
            )
            .first();
    },
});

export const getUserCourseProgress = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return {};

        const rows = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_courseId", (q) =>
                q.eq("userId", authUserId).eq("courseId", args.courseId)
            )
            .collect();

        const result: Record<string, typeof rows[number]> = {};
        for (const row of rows) {
            result[row.topicId] = row;
        }
        return result;
    },
});

export const getResumeTarget = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const row = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_lastStudied", (q) =>
                q.eq("userId", authUserId)
            )
            .order("desc")
            .first();

        if (!row) return null;

        const topic = await ctx.db.get(row.topicId);
        if (!topic) return null;

        return {
            topicId: row.topicId,
            topicTitle: topic.title,
            courseId: row.courseId,
            lastStudiedAt: row.lastStudiedAt,
            bestScore: row.bestScore,
            completedAt: row.completedAt,
        };
    },
});

export const getTopicSourcePassages = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return [];

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return [];

        const topic = await ctx.db.get(topicId);
        if (!topic || !topic.sourceUploadId) return [];

        const passageIds = topic.sourcePassageIds ?? [];
        if (passageIds.length === 0) return [];

        const passages = await Promise.all(
            passageIds.slice(0, 12).map(async (pid: string) => {
                const passage = await ctx.db
                    .query("evidencePassages")
                    .withIndex("by_uploadId_passageId", (q) =>
                        q.eq("uploadId", topic.sourceUploadId!).eq("passageId", pid)
                    )
                    .first();
                return passage;
            })
        );

        return passages
            .filter(Boolean)
            .map((p: any) => ({
                passageId: p.passageId,
                page: p.page,
                sectionHint: p.sectionHint,
                text: p.text?.slice(0, 400) ?? '',
            }));
    },
});
