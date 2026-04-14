import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";

const DEFAULT_REVIEW_QUEUE_LIMIT = 6;
const DEFAULT_CONCEPT_SESSION_SIZE = 1;
const CONCEPT_STATUS_STRONG = "strong";
const CONCEPT_STATUS_SHAKY = "shaky";
const CONCEPT_STATUS_WEAK = "weak";

const normalizeConceptTextKey = (text: unknown) =>
    String(text || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const deriveConceptStatus = (correct: number, total: number) => {
    const accuracy = total > 0 ? correct / total : 0;
    if (total >= 2 && accuracy >= 0.8) return CONCEPT_STATUS_STRONG;
    if (accuracy >= 0.5 || correct >= 1) return CONCEPT_STATUS_SHAKY;
    return CONCEPT_STATUS_WEAK;
};

const summarizeConceptAttempts = (attempts: any[]) => {
    const conceptMap = new Map<string, {
        conceptKey: string;
        displayText: string;
        correct: number;
        total: number;
        lastSeenAt: number;
    }>();

    for (const attempt of Array.isArray(attempts) ? attempts : []) {
        const createdAt = Math.max(0, Number(attempt?._creationTime) || 0);
        const correctAnswers = Array.isArray(attempt?.answers?.correctAnswers)
            ? attempt.answers.correctAnswers
            : [];
        const userAnswers = Array.isArray(attempt?.answers?.userAnswers)
            ? attempt.answers.userAnswers
            : [];

        for (let index = 0; index < correctAnswers.length; index += 1) {
            const correctAnswer = String(correctAnswers[index] || "").trim();
            const conceptKey = normalizeConceptTextKey(correctAnswer);
            if (!conceptKey) continue;

            const userAnswer = normalizeConceptTextKey(userAnswers[index]);
            const existing = conceptMap.get(conceptKey) || {
                conceptKey,
                displayText: correctAnswer,
                correct: 0,
                total: 0,
                lastSeenAt: 0,
            };

            existing.total += 1;
            if (userAnswer === conceptKey) {
                existing.correct += 1;
            }
            existing.lastSeenAt = Math.max(existing.lastSeenAt, createdAt);
            if (!existing.displayText && correctAnswer) {
                existing.displayText = correctAnswer;
            }
            conceptMap.set(conceptKey, existing);
        }
    }

    const items = Array.from(conceptMap.values())
        .map((entry) => {
            const status = deriveConceptStatus(entry.correct, entry.total);
            const accuracy = entry.total > 0 ? entry.correct / entry.total : 0;
            return {
                conceptKey: entry.conceptKey,
                label: entry.displayText || entry.conceptKey,
                correctCount: entry.correct,
                attemptCount: entry.total,
                accuracy: Math.round(accuracy * 100),
                status,
                due: status !== CONCEPT_STATUS_STRONG,
                lastSeenAt: entry.lastSeenAt || null,
            };
        })
        .sort((left, right) => {
            if (left.due !== right.due) return left.due ? -1 : 1;
            if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy;
            return (right.lastSeenAt || 0) - (left.lastSeenAt || 0);
        });

    const strongCount = items.filter((item) => item.status === CONCEPT_STATUS_STRONG).length;
    const shakyCount = items.filter((item) => item.status === CONCEPT_STATUS_SHAKY).length;
    const weakCount = items.filter((item) => item.status === CONCEPT_STATUS_WEAK).length;
    const dueItems = items.filter((item) => item.due);
    const totalCorrect = items.reduce((sum, item) => sum + item.correctCount, 0);
    const totalAttempts = items.reduce((sum, item) => sum + item.attemptCount, 0);

    return {
        totalConcepts: items.length,
        strongCount,
        shakyCount,
        weakCount,
        dueCount: dueItems.length,
        averageStrength: totalAttempts > 0
            ? Math.round((totalCorrect / Math.max(1, totalAttempts)) * 100)
            : null,
        nextReviewAt: dueItems.length > 0 ? Date.now() : null,
        reviewConceptKeys: dueItems.map((item) => item.conceptKey),
        items,
    };
};

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

        const summary = summarizeConceptAttempts(attempts);

        return {
            topicId: String(topic._id),
            topicTitle: topic.title,
            source: attempts.length > 0 ? "attempt_fallback" : "empty",
            totalConcepts: summary.totalConcepts,
            strongCount: summary.strongCount,
            shakyCount: summary.shakyCount,
            weakCount: summary.weakCount,
            dueCount: summary.dueCount,
            averageStrength: summary.averageStrength,
            nextReviewAt: summary.nextReviewAt,
            reviewConceptKeys: summary.reviewConceptKeys,
            items: summary.items,
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
            .take(Math.max(limit * 20, 60));

        const seenTopicIds = new Set<string>();
        const groupedAttempts = new Map<string, any[]>();
        for (const attempt of attempts) {
            const topicId = String(attempt?.topicId || "").trim();
            if (!topicId) continue;
            const bucket = groupedAttempts.get(topicId) || [];
            bucket.push(attempt);
            groupedAttempts.set(topicId, bucket);
        }

        const items = [];
        for (const [topicId, topicAttempts] of groupedAttempts.entries()) {
            if (seenTopicIds.has(topicId)) continue;
            const canonicalAttempt = topicAttempts[0];
            const topic = await ctx.db.get(canonicalAttempt.topicId);
            if (!topic) continue;
            const course = await ctx.db.get(topic.courseId);
            if (!course || course.userId !== userId) continue;
            const summary = summarizeConceptAttempts(topicAttempts);
            if (summary.totalConcepts === 0) continue;
            seenTopicIds.add(topicId);
            items.push({
                topicId,
                courseId: String(topic.courseId),
                topicTitle: topic.title,
                dueCount: summary.dueCount,
                weakCount: summary.weakCount,
                shakyCount: summary.shakyCount,
                strongCount: summary.strongCount,
                averageStrength: summary.averageStrength,
                nextReviewAt: summary.nextReviewAt,
                reviewConceptKeys: summary.reviewConceptKeys,
                concepts: summary.items,
            });
            if (items.length >= limit) break;
        }

        items.sort((left, right) => {
            if (left.dueCount !== right.dueCount) return right.dueCount - left.dueCount;
            return (left.averageStrength ?? 0) - (right.averageStrength ?? 0);
        });

        return {
            items,
            dueTopicCount: items.filter((item) => item.dueCount > 0).length,
            dueConceptCount: items.reduce((sum, item) => sum + Math.max(0, Number(item.dueCount) || 0), 0),
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

export const getConceptSessionForTopic = action({
    args: {
        topicId: v.id("topics"),
        focusConceptKeys: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const userId = assertAuthorizedUser({ authUserId });

        const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
            topicId: args.topicId,
        });
        if (!topic) {
            throw new Error("Topic not found");
        }

        const owner = await ctx.runQuery(internal.topics.getTopicOwnerUserIdInternal, {
            topicId: args.topicId,
        });
        if (!owner) {
            throw new Error("Topic not found");
        }
        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: owner.userId,
        });

        let exercises = await ctx.runQuery(internal.concepts.getConceptExercisesForTopicInternal, {
            topicId: args.topicId,
        });

        const activeExercises = Array.isArray(exercises)
            ? exercises.filter((item: any) => item?.active !== false)
            : [];

        if (activeExercises.length === 0) {
            await ctx.runAction((internal as any).ai.generateConceptExerciseForTopicInternal, {
                topicId: args.topicId,
                userId,
            });
            exercises = await ctx.runQuery(internal.concepts.getConceptExercisesForTopicInternal, {
                topicId: args.topicId,
            });
        }

        const sessionItems = (Array.isArray(exercises) ? exercises : [])
            .filter((item: any) => item?.active !== false)
            .slice(0, DEFAULT_CONCEPT_SESSION_SIZE)
            .map((exercise: any) => ({
                exerciseKey: String(exercise?.conceptKey || exercise?._id || ""),
                exerciseType: String(exercise?.exerciseType || "cloze"),
                conceptKey: String(exercise?.conceptKey || topic.title || ""),
                difficulty: String(exercise?.difficulty || "medium"),
                questionText: String(exercise?.questionText || topic.title || "Concept practice"),
                explanation: typeof exercise?.explanation === "string" ? exercise.explanation : "",
                template: Array.isArray(exercise?.template) ? exercise.template : [],
                answers: Array.isArray(exercise?.answers) ? exercise.answers : [],
                tokens: Array.isArray(exercise?.tokens) ? exercise.tokens : [],
                options: Array.isArray(exercise?.options) ? exercise.options : [],
                correctOptionId: typeof exercise?.correctOptionId === "string" ? exercise.correctOptionId : "",
                citations: Array.isArray(exercise?.citations) ? exercise.citations : [],
                sourcePassageIds: Array.isArray(exercise?.sourcePassageIds) ? exercise.sourcePassageIds : [],
                groundingScore: Number(exercise?.groundingScore || 0),
            }))
            .filter((item: any) => item.answers.length > 0 || item.options.length > 0);

        if (sessionItems.length === 0) {
            throw new Error("Couldn't prepare concept practice for this topic yet.");
        }

        return {
            topicId: args.topicId,
            topicTitle: topic.title,
            sessionSize: sessionItems.length,
            targetSize: DEFAULT_CONCEPT_SESSION_SIZE,
            generationCount: sessionItems.length,
            focusConceptKeys: Array.isArray(args.focusConceptKeys) ? args.focusConceptKeys.filter(Boolean) : [],
            items: sessionItems,
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

        await getTopicAndCourseForAuthorizedUser(ctx, args.topicId, authUserId);

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
