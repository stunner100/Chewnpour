import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const normalizeUserId = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

// Get the user's profile
export const getProfile = query({
    args: { userId: v.optional(v.any()) },
    handler: async (ctx, args) => {
        const explicitUserId = normalizeUserId(args.userId);
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const authenticatedUserId = normalizeUserId(identity?.subject);
        const effectiveUserId = authenticatedUserId ?? explicitUserId;

        if (!effectiveUserId) return null;

        // Never allow explicit cross-user lookups from authenticated requests.
        if (explicitUserId && authenticatedUserId && explicitUserId !== authenticatedUserId) {
            return null;
        }

        try {
            const profile = await ctx.db
                .query("profiles")
                .withIndex("by_userId", (q) => q.eq("userId", effectiveUserId))
                .first();

            return profile;
        } catch (error) {
            console.error("[profiles:getProfile] Failed to read profile", {
                hasExplicitUserId: Boolean(explicitUserId),
                hasAuthenticatedUserId: Boolean(authenticatedUserId),
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    },
});

// Create or update user profile
export const upsertProfile = mutation({
    args: {
        userId: v.string(),
        fullName: v.optional(v.string()),
        educationLevel: v.optional(v.string()),
        department: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        avatarGradient: v.optional(v.number()),
        voiceModeEnabled: v.optional(v.boolean()),
        onboardingCompleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (existing) {
            const updates: Record<string, unknown> = {};
            if (args.fullName !== undefined) updates.fullName = args.fullName;
            if (args.educationLevel !== undefined) updates.educationLevel = args.educationLevel;
            if (args.department !== undefined) updates.department = args.department;
            if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
            if (args.avatarGradient !== undefined) updates.avatarGradient = args.avatarGradient;
            if (args.voiceModeEnabled !== undefined) updates.voiceModeEnabled = args.voiceModeEnabled;
            if (args.onboardingCompleted !== undefined) updates.onboardingCompleted = args.onboardingCompleted;

            if (Object.keys(updates).length > 0) {
                await ctx.db.patch(existing._id, updates);
            }
            return existing._id;
        } else {
            return await ctx.db.insert("profiles", {
                userId: args.userId,
                fullName: args.fullName,
                educationLevel: args.educationLevel,
                department: args.department,
                avatarUrl: args.avatarUrl,
                avatarGradient: args.avatarGradient,
                voiceModeEnabled: args.voiceModeEnabled ?? false,
                onboardingCompleted: args.onboardingCompleted ?? false,
                streakDays: 0,
                totalStudyHours: 0,
            });
        }
    },
});

// Get user stats aggregated from various tables
export const getUserStats = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return null;

        // Count completed topics from exam attempts
        const examAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        const conceptAttempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        // Get unique topics attempted
        const uniqueTopics = new Set([
            ...examAttempts.map((a) => a.topicId),
            ...conceptAttempts.map((a) => a.topicId),
        ]);

        const toDayIndex = (timestampMs: number) => Math.floor(timestampMs / (1000 * 60 * 60 * 24));
        const uniqueDays = new Set([
            ...examAttempts.map((attempt) => toDayIndex(attempt._creationTime)),
            ...conceptAttempts.map((attempt) => toDayIndex(attempt._creationTime)),
        ]);
        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
        let streakDays = 0;
        if (sortedDays.length > 0) {
            const todayIndex = toDayIndex(Date.now());
            if (todayIndex - sortedDays[0] <= 1) {
                streakDays = 1;
                let prev = sortedDays[0];
                for (let i = 1; i < sortedDays.length; i += 1) {
                    if (sortedDays[i] === prev - 1) {
                        streakDays += 1;
                        prev = sortedDays[i];
                    } else {
                        break;
                    }
                }
            }
        }

        // Calculate average accuracy
        let totalScore = 0;
        let totalQuestions = 0;
        examAttempts.forEach((attempt) => {
            totalScore += attempt.score;
            totalQuestions += attempt.totalQuestions;
        });
        conceptAttempts.forEach((attempt) => {
            totalScore += attempt.score;
            totalQuestions += attempt.totalQuestions;
        });
        const accuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

        // Count courses
        const courses = await ctx.db
            .query("courses")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        // Get profile for study time
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        return {
            topics: uniqueTopics.size,
            accuracy,
            courses: courses.length,
            studyTime: profile?.totalStudyHours || 0,
            streakDays: streakDays || profile?.streakDays || 0,
        };
    },
});

// Update streak days
export const updateStreak = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (profile) {
            await ctx.db.patch(profile._id, {
                streakDays: (profile.streakDays || 0) + 1,
            });
        }
    },
});

// Add study time
export const addStudyTime = mutation({
    args: {
        userId: v.string(),
        minutes: v.number(),
    },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (profile) {
            const hoursToAdd = args.minutes / 60;
            await ctx.db.patch(profile._id, {
                totalStudyHours: (profile.totalStudyHours || 0) + hoursToAdd,
            });
        }
    },
});

// One-time migration: mark all existing profiles as onboarded
export const markAllOnboarded = mutation({
    args: {},
    handler: async (ctx) => {
        const profiles = await ctx.db.query("profiles").collect();
        let updated = 0;

        for (const profile of profiles) {
            if (profile.onboardingCompleted !== true) {
                await ctx.db.patch(profile._id, { onboardingCompleted: true });
                updated += 1;
            }
        }

        return { updated };
    },
});
