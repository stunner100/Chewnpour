import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { resolveAuthUserId } from "./lib/examSecurity";
import { DEFAULT_TUTOR_PERSONA, TUTOR_PERSONAS, normalizeTutorPersona } from "./lib/tutorSupport";

const resolveTopicId = (ctx: any, rawTopicId: string) => {
    const normalized = String(rawTopicId || "").trim();
    if (!normalized) return null;
    try {
        return ctx.db.normalizeId("topics", normalized);
    } catch {
        return null;
    }
};

const computeAttemptPercentage = (attempt: any) => {
    if (!attempt) return null;
    const isEssayAttempt = String(attempt.examFormat || "").toLowerCase() === "essay";
    if (isEssayAttempt && typeof attempt.essayWeightedPercentage === "number") {
        return Math.max(0, Math.min(100, Math.round(attempt.essayWeightedPercentage)));
    }
    const total = Number(attempt.totalQuestions || (Array.isArray(attempt.answers) ? attempt.answers.length : 0));
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((Number(attempt.score || 0) / total) * 100)));
};

const getTutorContextSnapshot = async (ctx: any, args: { userId: string; topicId: any }) => {
    const topic = await ctx.db.get(args.topicId);
    if (!topic) return null;

    const profile = await ctx.db
        .query("userTutorProfiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
        .first();

    const memory = await ctx.db
        .query("userTutorMemory")
        .withIndex("by_userId_topicId", (q: any) =>
            q.eq("userId", args.userId).eq("topicId", args.topicId)
        )
        .first();

    const progress = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_userId_topicId", (q: any) =>
            q.eq("userId", args.userId).eq("topicId", args.topicId)
        )
        .first();

    const latestAttempt = await ctx.db
        .query("examAttempts")
        .withIndex("by_userId_topicId", (q: any) =>
            q.eq("userId", args.userId).eq("topicId", args.topicId)
        )
        .order("desc")
        .first();

    const incorrectAnswers = Array.isArray(latestAttempt?.answers)
        ? latestAttempt.answers
            .filter((entry: any) => !entry?.isCorrect)
            .slice(0, 5)
            .map((entry: any) => ({
                questionText: String(entry?.questionText || "").trim(),
            }))
            .filter((entry: any) => entry.questionText)
        : [];

    return {
        topic: {
            _id: topic._id,
            title: topic.title,
            description: topic.description,
            courseId: topic.courseId,
            assessmentRoute: topic.assessmentRoute,
        },
        persona: normalizeTutorPersona(profile?.preferredPersona),
        memory: memory
            ? {
                memorySummary: memory.memorySummary,
                strengths: memory.strengths || [],
                weakAreas: memory.weakAreas || [],
                updatedAt: memory.updatedAt,
            }
            : null,
        progress: progress
            ? {
                completedAt: progress.completedAt,
                bestScore: progress.bestScore,
                lastStudiedAt: progress.lastStudiedAt,
            }
            : null,
        latestAttempt: latestAttempt
            ? {
                percentage: computeAttemptPercentage(latestAttempt),
                incorrectAnswers,
            }
            : null,
    };
};

export const getTutorProfile = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return { preferredPersona: DEFAULT_TUTOR_PERSONA, personas: Object.values(TUTOR_PERSONAS) };

        const profile = await ctx.db
            .query("userTutorProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        return {
            preferredPersona: normalizeTutorPersona(profile?.preferredPersona),
            personas: Object.values(TUTOR_PERSONAS),
        };
    },
});

export const setTutorPersona = mutation({
    args: {
        persona: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) throw new Error("Not authenticated");

        const persona = normalizeTutorPersona(args.persona);
        const existing = await ctx.db
            .query("userTutorProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                preferredPersona: persona,
                updatedAt: Date.now(),
            });
            return { preferredPersona: persona };
        }

        await ctx.db.insert("userTutorProfiles", {
            userId,
            preferredPersona: persona,
            updatedAt: Date.now(),
        });

        return { preferredPersona: persona };
    },
});

export const getTopicTutorSupport = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return null;

        const topicId = resolveTopicId(ctx, args.topicId);
        if (!topicId) return null;

        return await getTutorContextSnapshot(ctx, { userId, topicId });
    },
});

export const getTopicTutorContextInternal = internalQuery({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => getTutorContextSnapshot(ctx, args),
});

export const upsertTopicTutorMemoryInternal = internalMutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
        courseId: v.id("courses"),
        memorySummary: v.string(),
        strengths: v.optional(v.array(v.string())),
        weakAreas: v.optional(v.array(v.string())),
        lastQuestion: v.optional(v.string()),
        lastAnswer: v.optional(v.string()),
        lastScore: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        lastStudiedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("userTutorMemory")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", args.userId).eq("topicId", args.topicId)
            )
            .first();

        const patch = {
            courseId: args.courseId,
            memorySummary: args.memorySummary,
            strengths: args.strengths || [],
            weakAreas: args.weakAreas || [],
            lastQuestion: args.lastQuestion,
            lastAnswer: args.lastAnswer,
            lastScore: args.lastScore,
            completedAt: args.completedAt,
            lastStudiedAt: args.lastStudiedAt,
            updatedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, patch);
            return existing._id;
        }

        return await ctx.db.insert("userTutorMemory", {
            userId: args.userId,
            topicId: args.topicId,
            ...patch,
        });
    },
});
