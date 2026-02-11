import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EXAM_QUESTION_SUBSET_SIZE = 25;

const pickRandomSubset = <T>(items: T[], size: number) => {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied.slice(0, Math.max(0, size));
};

// Start a new exam attempt
export const startExamAttempt = mutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        // Get questions for this topic to count them
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        const selectedQuestions = questions.length <= EXAM_QUESTION_SUBSET_SIZE
            ? questions
            : pickRandomSubset(questions, EXAM_QUESTION_SUBSET_SIZE);
        const questionIds = selectedQuestions.map((question) => question._id);

        // Create a new attempt record
        const attemptId = await ctx.db.insert("examAttempts", {
            userId: args.userId,
            topicId: args.topicId,
            score: 0,
            totalQuestions: selectedQuestions.length,
            timeTakenSeconds: 0,
            questionIds,
            answers: [],
        });

        return {
            attemptId,
            totalQuestions: selectedQuestions.length,
            questions: selectedQuestions,
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
        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) {
            throw new Error("Exam attempt not found");
        }

        // Calculate score
        let correctCount = 0;
        const gradedAnswers = [];
        const attemptQuestionIds = new Set((attempt.questionIds || []).map((id) => String(id)));
        const enforceSubset = attemptQuestionIds.size > 0;

        for (const answer of args.answers) {
            if (enforceSubset && !attemptQuestionIds.has(String(answer.questionId))) {
                throw new Error("Submitted answers include questions outside this exam attempt.");
            }
            const question = await ctx.db.get(answer.questionId);
            if (!question) {
                throw new Error("One or more submitted questions could not be found.");
            }
            if (question.topicId !== attempt.topicId) {
                throw new Error("Submitted answers include questions outside this topic.");
            }

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
        const totalQuestions = attempt.totalQuestions || (attempt.questionIds?.length ?? args.answers.length);
        const denominator = totalQuestions > 0 ? totalQuestions : args.answers.length || 1;

        return {
            score: correctCount,
            totalQuestions,
            percentage: Math.round((correctCount / denominator) * 100),
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
