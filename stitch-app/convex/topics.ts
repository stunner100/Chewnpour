import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isUsableExamQuestion, sanitizeExamQuestionForClient } from "./lib/examSecurity";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";

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
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;

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

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const safeQuestions = questions
            .filter((question) => isUsableExamQuestion(question))
            .map((question) => sanitizeExamQuestionForClient(question));

        return {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            questions: safeQuestions,
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
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        // Shuffle questions for randomized exams
        return questions
            .filter((question) => isUsableExamQuestion(question))
            .map((question) => sanitizeExamQuestionForClient(question))
            .sort(() => Math.random() - 0.5);
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
            illustrationUrl: args.illustrationUrl || resolveDefaultTopicIllustrationUrl(),
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
export const createQuestionInternal = internalMutation({
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

        return { deleted: questions.length };
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
