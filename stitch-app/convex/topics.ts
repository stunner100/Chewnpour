import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
    assertAuthorizedUser,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";
import { areMcqQuestionsNearDuplicate, buildMcqUniquenessSignature } from "./lib/mcqUniqueness";

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

const computeTopicExamReadinessFromQuestions = (questions: any[]) => {
    const usableMcqCount = questions.filter(
        (question) =>
            question?.questionType !== "essay"
            && isUsableExamQuestion(question)
    ).length;
    const usableEssayCount = questions.filter(
        (question) =>
            question?.questionType === "essay"
            && isUsableExamQuestion(question, { allowEssay: true })
    ).length;
    const examReady =
        usableMcqCount >= EXAM_READY_MIN_MCQ_COUNT
        && usableEssayCount >= EXAM_READY_MIN_ESSAY_COUNT;

    return {
        usableMcqCount,
        usableEssayCount,
        examReady,
    };
};

const dedupeTopicQuestions = (questions: any[]) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenMcqSignatures: any[] = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        if (String(question?.questionType || "") === "essay") {
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
    const dedupedQuestions = dedupeTopicQuestions(questions);
    const safeQuestions = dedupedQuestions
        .filter((question: any) => isUsableExamQuestion(question))
        .map((question: any) => sanitizeExamQuestionForClient(question));
    const computedReadiness = computeTopicExamReadinessFromQuestions(dedupedQuestions);

    return {
        topic: {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            usableMcqCount: computedReadiness.usableMcqCount,
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
        return payload.topic;
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
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        // Shuffle questions for randomized exams
        return dedupeTopicQuestions(questions)
            .filter((question) => isUsableExamQuestion(question))
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
            title: args.title,
            description: args.description,
            content: args.content,
            sourceChunkIds: args.sourceChunkIds,
            sourcePassageIds: args.sourcePassageIds,
            groundingVersion: args.groundingVersion,
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl || resolveDefaultTopicIllustrationUrl(),
            examReady: false,
            usableMcqCount: 0,
            usableEssayCount: 0,
            examReadyUpdatedAt: Date.now(),
            orderIndex: args.orderIndex,
            isLocked: args.isLocked,
        });

        return topicId;
    },
});

export const refreshTopicExamReadinessInternal = internalMutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                topicId: args.topicId,
                exists: false,
                examReady: false,
                usableMcqCount: 0,
                usableEssayCount: 0,
            };
        }

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(questions);

        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
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
        if (!topic) return { acquired: false };

        const now = Date.now();
        const lockField = args.format === "essay"
            ? "essayGenerationLockedUntil"
            : "mcqGenerationLockedUntil";
        const currentLock = Number((topic as any)[lockField] || 0);

        if (currentLock > now) {
            // Lock is still held and not expired
            return { acquired: false };
        }

        const ttlMs = args.format === "essay"
            ? ESSAY_GENERATION_LOCK_TTL_MS
            : MCQ_GENERATION_LOCK_TTL_MS;
        await ctx.db.patch(args.topicId, {
            [lockField]: now + ttlMs,
        });

        return { acquired: true };
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
        rubricPoints: v.optional(v.array(v.string())),
        qualityFlags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        if (String(args.questionType || "") !== "essay") {
            const existingQuestions = await ctx.db
                .query("questions")
                .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
                .collect();
            const candidateSignature = buildMcqUniquenessSignature({
                questionText: args.questionText,
                options: args.options,
                correctAnswer: args.correctAnswer,
                citations: args.citations,
            });
            const duplicateExists = existingQuestions
                .filter((question: any) => String(question?.questionType || "") !== "essay")
                .some((question: any) =>
                    areMcqQuestionsNearDuplicate(candidateSignature, buildMcqUniquenessSignature(question))
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
            learningObjective: args.learningObjective,
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

        const readiness = computeTopicExamReadinessFromQuestions(remainingQuestions);
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
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
                rubricPoints: v.optional(v.array(v.string())),
                qualityFlags: v.optional(v.array(v.string())),
            })
        ),
    },
    handler: async (ctx, args) => {
        const questionIds = [];
        const existingQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const acceptedMcqSignatures = existingQuestions
            .filter((question: any) => String(question?.questionType || "") !== "essay")
            .map((question: any) => buildMcqUniquenessSignature(question));
        for (const q of args.questions) {
            if (String(q.questionType || "") !== "essay") {
                const candidateSignature = buildMcqUniquenessSignature(q);
                if (acceptedMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(candidateSignature, prior))) {
                    continue;
                }
                acceptedMcqSignatures.push(candidateSignature);
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
        const readiness = computeTopicExamReadinessFromQuestions(topicQuestions);
        await ctx.db.patch(args.topicId, {
            examReady: readiness.examReady,
            usableMcqCount: readiness.usableMcqCount,
            usableEssayCount: readiness.usableEssayCount,
            examReadyUpdatedAt: Date.now(),
        });

        return questionIds;
    },
});
