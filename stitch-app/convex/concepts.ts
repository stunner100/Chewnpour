import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";

const DEFAULT_REVIEW_QUEUE_LIMIT = 6;

const getTopicAndCourseForAuthorizedUser = async (
    ctx: any,
    topicId: any,
    authUserId: string | null,
) => {
    const topic = await ctx.db.get(topicId);
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
    return { topic, course };
};

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

export const getConceptMasteryForTopic = query({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const userId = assertAuthorizedUser({ authUserId });
        const { topic } = await getTopicAndCourseForAuthorizedUser(ctx, args.topicId, authUserId);
        const attempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .order("desc")
            .take(10);

        const totalQuestions = attempts.reduce(
            (sum: number, attempt: any) => sum + Math.max(0, Number(attempt?.totalQuestions) || 0),
            0,
        );
        const totalScore = attempts.reduce(
            (sum: number, attempt: any) => sum + Math.max(0, Number(attempt?.score) || 0),
            0,
        );
        const averageStrength = totalQuestions > 0
            ? Math.round((totalScore / Math.max(1, totalQuestions)) * 100)
            : null;

        return {
            topicId: String(topic._id),
            topicTitle: topic.title,
            source: attempts.length > 0 ? "attempt_fallback" : "empty",
            totalConcepts: 0,
            strongCount: 0,
            shakyCount: 0,
            weakCount: 0,
            dueCount: 0,
            averageStrength,
            nextReviewAt: null,
            reviewConceptKeys: [],
            items: [],
        };
    },
});

export const getConceptReviewQueue = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) {
            return {
                items: [],
                dueTopicCount: 0,
                dueConceptCount: 0,
            };
        }

        const userId = assertAuthorizedUser({ authUserId });
        const limit = Math.max(1, Math.min(12, Math.floor(Number(args.limit) || DEFAULT_REVIEW_QUEUE_LIMIT)));
        const attempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .take(limit);

        const seenTopicIds = new Set<string>();
        const items = [];
        for (const attempt of attempts) {
            const topicId = String(attempt?.topicId || "").trim();
            if (!topicId || seenTopicIds.has(topicId)) continue;
            const topic = await ctx.db.get(attempt.topicId);
            if (!topic) continue;
            const course = await ctx.db.get(topic.courseId);
            if (!course || course.userId !== userId) continue;
            seenTopicIds.add(topicId);
            items.push({
                topicId,
                courseId: String(topic.courseId),
                topicTitle: topic.title,
                dueCount: 0,
                weakCount: 0,
                shakyCount: 0,
                strongCount: 0,
                averageStrength: null,
                nextReviewAt: null,
                reviewConceptKeys: [],
                concepts: [],
            });
        }

        return {
            items,
            dueTopicCount: 0,
            dueConceptCount: 0,
        };
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
