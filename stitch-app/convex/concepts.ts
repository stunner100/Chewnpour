import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";
import { buildConceptSessionItems } from "./lib/conceptSessionSelection.js";

const CONCEPT_SESSION_SIZE = 5;
const MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS = 6;

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
        questionText: v.string(),
        template: v.array(v.string()),
        answers: v.array(v.string()),
        tokens: v.array(v.string()),
        citations: v.optional(v.array(v.any())),
        groundingScore: v.optional(v.number()),
        version: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("conceptExercises", {
            topicId: args.topicId,
            questionText: args.questionText,
            template: args.template,
            answers: args.answers,
            tokens: args.tokens,
            citations: args.citations,
            groundingScore: args.groundingScore,
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

        let sessionItems = buildConceptSessionItems({
            bankExercises,
            attempts,
            sessionSize: CONCEPT_SESSION_SIZE,
        });

        let generationCount = 0;
        while (
            sessionItems.length < CONCEPT_SESSION_SIZE
            && generationCount < MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS
        ) {
            const generatedExercise = await ctx.runAction(
                "ai:generateConceptExerciseForTopicInternal",
                {
                    topicId: args.topicId,
                    userId,
                }
            );
            generationCount += 1;
            bankExercises = [generatedExercise, ...bankExercises];
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
                questionText: exercise.questionText,
                template: exercise.template,
                answers: exercise.answers,
                tokens: exercise.tokens,
                citations: exercise.citations,
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
