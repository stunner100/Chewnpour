import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";
import { buildConceptSessionItems, summarizeConceptExerciseBank } from "./lib/conceptSessionSelection.js";

const CONCEPT_SESSION_SIZE = 5;
const CONCEPT_BANK_TARGET_SIZE = 9;
const CONCEPT_BANK_BATCH_SIZE = 6;
const CONCEPT_MIN_EXERCISE_TYPES = 3;
const CONCEPT_MIN_CONCEPT_KEYS = 4;
const MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS = 3;

export const createConceptAttempt = mutation({
    args: {
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.optional(v.number()),
        answers: v.optional(v.any()),
        questionText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const userId = assertAuthorizedUser({ authUserId });

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }
        const course = await ctx.db.get(topic.courseId);
        if (!course) {
            throw new Error("Topic not found");
        }
        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: course.userId,
        });

        const attemptId = await ctx.db.insert("conceptAttempts", {
            userId,
            topicId: args.topicId,
            score: args.score,
            totalQuestions: args.totalQuestions,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: args.answers,
            questionText: args.questionText,
        });

        return { attemptId };
    },
});

export const getUserConceptAttempts = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return [];
        const userId = authUserId;

        const attempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        return attempts;
    },
});

export const getUserConceptAttemptsForTopicInternal = internalQuery({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const cap = args.limit || 50;
        const attempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", args.userId).eq("topicId", args.topicId)
            )
            .order("desc")
            .take(cap);

        return attempts;
    },
});

export const getConceptExercisesForTopicInternal = internalQuery({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("conceptExercises")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .order("desc")
            .collect();
    },
});

export const createConceptExerciseInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        exerciseType: v.optional(v.string()),
        conceptKey: v.optional(v.string()),
        difficulty: v.optional(v.string()),
        questionText: v.string(),
        explanation: v.optional(v.string()),
        template: v.optional(v.array(v.string())),
        answers: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.object({
            id: v.string(),
            text: v.string(),
        }))),
        correctOptionId: v.optional(v.string()),
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()),
        qualityScore: v.optional(v.number()),
        active: v.optional(v.boolean()),
        version: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("conceptExercises", {
            topicId: args.topicId,
            exerciseType: args.exerciseType,
            conceptKey: args.conceptKey,
            difficulty: args.difficulty,
            questionText: args.questionText,
            explanation: args.explanation,
            template: args.template,
            answers: args.answers,
            tokens: args.tokens,
            options: args.options,
            correctOptionId: args.correctOptionId,
            citations: args.citations,
            sourcePassageIds: args.sourcePassageIds,
            groundingScore: args.groundingScore,
            qualityScore: args.qualityScore,
            active: args.active !== false,
            version: args.version,
            createdAt: Date.now(),
        });
    },
});

export const getConceptSessionForTopic = action({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const userId = assertAuthorizedUser({ authUserId });

        const owner = await ctx.runQuery("topics:getTopicOwnerUserIdInternal", {
            topicId: args.topicId,
        });
        if (!owner) {
            throw new Error("Topic not found");
        }
        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: owner.userId,
        });

        const topic = await ctx.runQuery("topics:getTopicWithQuestionsInternal", {
            topicId: args.topicId,
        });
        if (!topic) {
            throw new Error("Topic not found");
        }

        const attempts = await ctx.runQuery("concepts:getUserConceptAttemptsForTopicInternal", {
            userId,
            topicId: args.topicId,
            limit: 50,
        });

        let bankExercises = await ctx.runQuery("concepts:getConceptExercisesForTopicInternal", {
            topicId: args.topicId,
        });

        let generationCount = 0;
        let generationAttempts = 0;
        let bankSummary = summarizeConceptExerciseBank(bankExercises);

        while (
            generationAttempts < MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS
            && (
                bankSummary.activeCount < CONCEPT_BANK_TARGET_SIZE
                || bankSummary.exerciseTypeCount < CONCEPT_MIN_EXERCISE_TYPES
                || bankSummary.conceptKeyCount < CONCEPT_MIN_CONCEPT_KEYS
            )
        ) {
            const generatedExercises = await ctx.runAction(
                "ai:generateConceptExerciseBatchForTopicInternal",
                {
                    topicId: args.topicId,
                    userId,
                    requestedCount: CONCEPT_BANK_BATCH_SIZE,
                }
            );
            const insertedExercises = Array.isArray(generatedExercises) ? generatedExercises.filter(Boolean) : [];
            if (insertedExercises.length === 0) {
                break;
            }
            generationAttempts += 1;
            generationCount += insertedExercises.length;
            bankExercises = [...insertedExercises, ...bankExercises];
            bankSummary = summarizeConceptExerciseBank(bankExercises);
        }

        let sessionItems = buildConceptSessionItems({
            bankExercises,
            attempts,
            sessionSize: CONCEPT_SESSION_SIZE,
        });

        while (
            sessionItems.length < CONCEPT_SESSION_SIZE
            && generationAttempts < MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS
        ) {
            const generatedExercises = await ctx.runAction(
                "ai:generateConceptExerciseBatchForTopicInternal",
                {
                    topicId: args.topicId,
                    userId,
                    requestedCount: CONCEPT_BANK_BATCH_SIZE,
                }
            );
            const insertedExercises = Array.isArray(generatedExercises) ? generatedExercises.filter(Boolean) : [];
            if (insertedExercises.length === 0) {
                break;
            }
            generationAttempts += 1;
            generationCount += insertedExercises.length;
            bankExercises = [...insertedExercises, ...bankExercises];
            sessionItems = buildConceptSessionItems({
                bankExercises,
                attempts,
                sessionSize: CONCEPT_SESSION_SIZE,
            });
        }

        if (sessionItems.length === 0) {
            throw new Error("Couldn't prepare concept practice for this topic yet.");
        }

        return {
            topicId: args.topicId,
            topicTitle: topic.title,
            sessionSize: sessionItems.length,
            targetSize: CONCEPT_SESSION_SIZE,
            generationCount,
            items: sessionItems.map((exercise: any) => ({
                exerciseKey: exercise.exerciseKey,
                exerciseType: exercise.exerciseType,
                conceptKey: exercise.conceptKey,
                difficulty: exercise.difficulty,
                questionText: exercise.questionText,
                explanation: exercise.explanation,
                template: exercise.template,
                answers: exercise.answers,
                tokens: exercise.tokens,
                options: exercise.options,
                correctOptionId: exercise.correctOptionId,
                citations: exercise.citations,
                sourcePassageIds: exercise.sourcePassageIds,
                groundingScore: exercise.groundingScore,
            })),
        };
    },
});

export const createConceptSessionAttempt = mutation({
    args: {
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.optional(v.number()),
        answers: v.any(),
        questionText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const userId = assertAuthorizedUser({ authUserId });

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }
        const course = await ctx.db.get(topic.courseId);
        if (!course) {
            throw new Error("Topic not found");
        }
        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: course.userId,
        });

        const attemptId = await ctx.db.insert("conceptAttempts", {
            userId,
            topicId: args.topicId,
            score: args.score,
            totalQuestions: args.totalQuestions,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: args.answers,
            questionText: args.questionText,
        });

        return { attemptId };
    },
});
