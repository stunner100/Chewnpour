import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";

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
                if (!topic.illustrationStorageId) return topic;
                const freshIllustrationUrl = await resolveIllustrationUrl({
                    illustrationStorageId: topic.illustrationStorageId,
                    getUrl: (storageId) => ctx.storage.getUrl(storageId),
                });
                return {
                    ...topic,
                    // Convex storage URLs are signed and can expire; refresh on each read.
                    illustrationUrl: freshIllustrationUrl || undefined,
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
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;

        let freshIllustrationUrl: string | undefined = topic.illustrationUrl;
        if (topic.illustrationStorageId) {
            freshIllustrationUrl =
                (await resolveIllustrationUrl({
                    illustrationStorageId: topic.illustrationStorageId,
                    getUrl: (storageId) => ctx.storage.getUrl(storageId),
                })) || undefined;
        }

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        return {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            questions,
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
        return questions.sort(() => Math.random() - 0.5);
    },
});

// Create a new topic
export const createTopic = mutation({
    args: {
        courseId: v.id("courses"),
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()),
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
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl,
            orderIndex: args.orderIndex,
            isLocked: args.isLocked,
        });

        return topicId;
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
export const createQuestion = mutation({
    args: {
        topicId: v.id("topics"),
        questionText: v.string(),
        questionType: v.string(),
        options: v.optional(v.any()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const questionId = await ctx.db.insert("questions", {
            topicId: args.topicId,
            questionText: args.questionText,
            questionType: args.questionType,
            options: args.options,
            correctAnswer: args.correctAnswer,
            explanation: args.explanation,
            difficulty: args.difficulty,
        });

        return questionId;
    },
});

// Delete all questions for a topic (used for regeneration)
export const deleteQuestionsByTopic = mutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        for (const question of questions) {
            await ctx.db.delete(question._id);
        }

        return { deleted: questions.length };
    },
});


// Batch create questions (for AI-generated content)
export const batchCreateQuestions = mutation({
    args: {
        topicId: v.id("topics"),
        questions: v.array(
            v.object({
                questionText: v.string(),
                questionType: v.string(),
                options: v.optional(v.any()),
                correctAnswer: v.string(),
                explanation: v.optional(v.string()),
            })
        ),
    },
    handler: async (ctx, args) => {
        const questionIds = [];
        for (const q of args.questions) {
            const id = await ctx.db.insert("questions", {
                topicId: args.topicId,
                ...q,
            });
            questionIds.push(id);
        }

        return questionIds;
    },
});
