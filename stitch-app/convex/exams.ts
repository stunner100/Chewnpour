import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Start a new exam attempt
export const startExamAttempt = mutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        // Get questions for this topic to count them
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        // Create a new attempt record
        const attemptId = await ctx.db.insert("examAttempts", {
            userId: args.userId,
            topicId: args.topicId,
            score: 0,
            totalQuestions: questions.length,
            timeTakenSeconds: 0,
            answers: [],
        });

        return {
            attemptId,
            totalQuestions: questions.length,
        };
    },
});

// Submit exam answers and calculate score
export const submitExamAttempt = mutation({
    args: {
        attemptId: v.id("examAttempts"),
        answers: v.array(
            v.object({
                questionId: v.id("questions"),
                selectedAnswer: v.string(),
            })
        ),
        timeTakenSeconds: v.number(),
    },
    handler: async (ctx, args) => {
        // Calculate score
        let correctCount = 0;
        const gradedAnswers = [];

        for (const answer of args.answers) {
            const question = await ctx.db.get(answer.questionId);
            const isCorrect = question?.correctAnswer === answer.selectedAnswer;
            if (isCorrect) correctCount++;

            gradedAnswers.push({
                questionId: answer.questionId,
                selectedAnswer: answer.selectedAnswer,
                correctAnswer: question?.correctAnswer,
                isCorrect,
            });
        }

        // Update the attempt
        await ctx.db.patch(args.attemptId, {
            score: correctCount,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: gradedAnswers,
        });

        // Get the attempt to return
        const attempt = await ctx.db.get(args.attemptId);

        return {
            score: correctCount,
            totalQuestions: attempt?.totalQuestions || args.answers.length,
            percentage: Math.round((correctCount / args.answers.length) * 100),
            timeTakenSeconds: args.timeTakenSeconds,
            gradedAnswers,
        };
    },
});

// Get all exam attempts for a user
export const getUserExamAttempts = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return [];

        const attempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();

        // Enrich with topic info
        const enrichedAttempts = await Promise.all(
            attempts.map(async (attempt) => {
                const topic = await ctx.db.get(attempt.topicId);
                return {
                    ...attempt,
                    topicTitle: topic?.title || "Unknown Topic",
                };
            })
        );

        return enrichedAttempts;
    },
});

// Get exam attempts for a specific topic
export const getExamAttemptsByTopic = query({
    args: {
        userId: v.optional(v.string()),
        topicId: v.id("topics")
    },
    handler: async (ctx, args) => {
        if (!args.userId) return [];

        const attempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .order("desc")
            .collect();

        // Filter to only user's attempts
        return attempts.filter((a) => a.userId === args.userId);
    },
});

// Get single exam attempt with detailed results
export const getExamAttempt = query({
    args: { attemptId: v.id("examAttempts") },
    handler: async (ctx, args) => {
        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) return null;

        const topic = await ctx.db.get(attempt.topicId);

        // Get full question details for each answer
        const enrichedAnswers = await Promise.all(
            (attempt.answers || []).map(async (answer: any) => {
                const question = await ctx.db.get(answer.questionId);
                return {
                    ...answer,
                    questionText: question?.questionText,
                    options: question?.options,
                    explanation: question?.explanation,
                };
            })
        );

        return {
            ...attempt,
            topicTitle: topic?.title || "Unknown Topic",
            answers: enrichedAnswers,
            percentage: Math.round((attempt.score / attempt.totalQuestions) * 100),
        };
    },
});
