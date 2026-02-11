import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createConceptAttempt = mutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.optional(v.number()),
        answers: v.optional(v.any()),
        questionText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        const attemptId = await ctx.db.insert("conceptAttempts", {
            userId: args.userId,
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
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return [];

        const attempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();

        return attempts;
    },
});
