import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";
import { buildConceptSessionItems, summarizeConceptExerciseBank } from "./lib/conceptSessionSelection.js";
import {
    buildConceptMasterySummary,
    buildConceptMasteryUpdates,
} from "./lib/conceptMastery.js";
import { normalizeConceptTextKey } from "./lib/conceptExerciseGeneration.js";

const CONCEPT_SESSION_SIZE = 5;
const CONCEPT_BANK_TARGET_SIZE = 9;
const CONCEPT_BANK_BATCH_SIZE = 6;
const CONCEPT_MIN_EXERCISE_TYPES = 3;
const CONCEPT_MIN_CONCEPT_KEYS = 4;
const MAX_CONCEPT_SESSION_GENERATION_ATTEMPTS = 3;
const DEFAULT_REVIEW_QUEUE_LIMIT = 6;

const normalizeFocusConceptKeys = (values: unknown) => {
    return Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map((value) => normalizeConceptTextKey(value).replace(/\s+/g, "_"))
                .filter(Boolean)
        )
    );
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

const getConceptMasteryRecordsForTopic = async (
    ctx: any,
    userId: string,
    topicId: any,
) => {
    return await ctx.db
        .query("conceptMastery")
        .withIndex("by_userId_topicId", (q: any) =>
            q.eq("userId", userId).eq("topicId", topicId)
        )
        .collect();
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
        const records = await getConceptMasteryRecordsForTopic(ctx, userId, args.topicId);
        const summary = buildConceptMasterySummary({ records, now: Date.now() });

        return {
            topicId: String(topic._id),
            topicTitle: topic.title,
            ...summary,
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
        const now = Date.now();
        const records = await ctx.db
            .query("conceptMastery")
            .withIndex("by_userId_nextReviewAt", (q: any) => q.eq("userId", userId))
            .take(80);

        const byTopicId = new Map<string, any[]>();
        for (const record of records) {
            const key = String(record.topicId);
            const current = byTopicId.get(key) || [];
            current.push(record);
            byTopicId.set(key, current);
        }

        const items = [];
        for (const [topicKey, topicRecords] of byTopicId.entries()) {
            const topic = await ctx.db.get(topicRecords[0].topicId);
            if (!topic) continue;
            const course = await ctx.db.get(topic.courseId);
            if (!course || course.userId !== userId) continue;
            const summary = buildConceptMasterySummary({
                records: topicRecords,
                now,
                maxConcepts: 4,
            });
            items.push({
                topicId: topicKey,
                courseId: String(topic.courseId),
                topicTitle: topic.title,
                dueCount: summary.dueCount,
                weakCount: summary.weakCount,
                shakyCount: summary.shakyCount,
                strongCount: summary.strongCount,
                averageStrength: summary.averageStrength,
                nextReviewAt: summary.nextReviewAt,
                reviewConceptKeys: summary.reviewConceptKeys,
                concepts: summary.items.slice(0, 4),
            });
        }

        items.sort((left, right) => {
            const leftDue = left.dueCount > 0 ? 1 : 0;
            const rightDue = right.dueCount > 0 ? 1 : 0;
            if (leftDue !== rightDue) return rightDue - leftDue;
            if ((left.nextReviewAt || 0) !== (right.nextReviewAt || 0)) {
                return (left.nextReviewAt || 0) - (right.nextReviewAt || 0);
            }
            return (left.averageStrength || 0) - (right.averageStrength || 0);
        });

        const limitedItems = items.slice(0, limit);

        return {
            items: limitedItems,
            dueTopicCount: limitedItems.filter((item) => item.dueCount > 0).length,
            dueConceptCount: limitedItems.reduce((sum, item) => sum + item.dueCount, 0),
        };
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
        const focusConceptKeys = normalizeFocusConceptKeys(args.focusConceptKeys);

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
            focusConceptKeys,
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
                focusConceptKeys,
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
            focusConceptKeys,
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

        const masteryUpdates = buildConceptMasteryUpdates({
            existingRecords: await getConceptMasteryRecordsForTopic(ctx, userId, args.topicId),
            sessionItems: Array.isArray(args.answers?.items) ? args.answers.items : [],
            topicId: args.topicId,
            userId,
            now: Date.now(),
        });

        for (const update of masteryUpdates) {
            const {
                existingId,
                ...record
            } = update;
            if (existingId) {
                await ctx.db.patch(existingId, record);
                continue;
            }
            await ctx.db.insert("conceptMastery", record);
        }

        return { attemptId };
    },
});
