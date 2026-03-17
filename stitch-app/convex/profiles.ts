import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const normalizeUserId = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const PRESENCE_HEARTBEAT_MIN_INTERVAL_MS = 60 * 1000;

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

export const touchPresence = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const authenticatedUserId = normalizeUserId(identity?.subject);
        const requestedUserId = normalizeUserId(args.userId);

        if (!authenticatedUserId || !requestedUserId || authenticatedUserId !== requestedUserId) {
            throw new Error("Unauthorized presence heartbeat.");
        }

        const now = Date.now();
        const existing = await ctx.db
            .query("userPresence")
            .withIndex("by_userId", (q) => q.eq("userId", authenticatedUserId))
            .first();

        if (existing) {
            const existingLastSeenAt = Number(existing.lastSeenAt || 0);
            if (now - existingLastSeenAt >= PRESENCE_HEARTBEAT_MIN_INTERVAL_MS) {
                await ctx.db.patch(existing._id, { lastSeenAt: now });
                return { ok: true, lastSeenAt: now };
            }
            return { ok: true, lastSeenAt: existingLastSeenAt };
        }

        await ctx.db.insert("userPresence", {
            userId: authenticatedUserId,
            lastSeenAt: now,
        });
        return { ok: true, lastSeenAt: now };
    },
});

// Update email notification preferences
export const updateEmailPreferences = mutation({
    args: {
        userId: v.string(),
        streakReminders: v.optional(v.boolean()),
        streakBroken: v.optional(v.boolean()),
        weeklySummary: v.optional(v.boolean()),
        productResearch: v.optional(v.boolean()),
        winbackOffers: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const authenticatedUserId = normalizeUserId(identity?.subject);
        const requestedUserId = normalizeUserId(args.userId);

        if (!authenticatedUserId || !requestedUserId || authenticatedUserId !== requestedUserId) {
            throw new Error("Unauthorized.");
        }

        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", requestedUserId))
            .first();

        if (!profile) {
            throw new Error("Profile not found.");
        }

        const current = profile.emailPreferences ?? {
            streakReminders: true,
            streakBroken: true,
            weeklySummary: true,
            productResearch: true,
            winbackOffers: true,
        };

        const updated = {
            streakReminders: args.streakReminders ?? current.streakReminders,
            streakBroken: args.streakBroken ?? current.streakBroken,
            weeklySummary: args.weeklySummary ?? current.weeklySummary,
            productResearch: args.productResearch ?? current.productResearch,
            winbackOffers: args.winbackOffers ?? current.winbackOffers,
        };

        await ctx.db.patch(profile._id, { emailPreferences: updated });
        return { ok: true, emailPreferences: updated };
    },
});

// Unsubscribe via token (no auth required — used from email links)
export const unsubscribeByToken = mutation({
    args: {
        token: v.string(),
        emailType: v.optional(v.string()), // specific type or "all"
    },
    handler: async (ctx, args) => {
        const token = args.token.trim();
        if (!token) throw new Error("Invalid token.");

        // Scan profiles to find matching token. In practice the table is small enough
        // that a full scan is acceptable; if it grew large a secondary index could be added.
        const profiles = await ctx.db.query("profiles").collect();
        const profile = profiles.find((p) => p.emailUnsubscribeToken === token);
        if (!profile) {
            throw new Error("Invalid or expired unsubscribe token.");
        }

        const emailType = (args.emailType || "all").trim().toLowerCase();
        const current = profile.emailPreferences ?? {
            streakReminders: true,
            streakBroken: true,
            weeklySummary: true,
            productResearch: true,
            winbackOffers: true,
        };

        let updated;
        if (emailType === "all") {
            updated = {
                streakReminders: false,
                streakBroken: false,
                weeklySummary: false,
                productResearch: false,
                winbackOffers: false,
            };
        } else if (emailType === "streak_reminders" || emailType === "streakReminders") {
            updated = { ...current, streakReminders: false };
        } else if (emailType === "streak_broken" || emailType === "streakBroken") {
            updated = { ...current, streakBroken: false };
        } else if (emailType === "weekly_summary" || emailType === "weeklySummary") {
            updated = { ...current, weeklySummary: false };
        } else if (emailType === "product_research" || emailType === "productResearch") {
            updated = { ...current, productResearch: false };
        } else if (emailType === "winback_offers" || emailType === "winbackOffers") {
            updated = { ...current, winbackOffers: false };
        } else {
            updated = {
                streakReminders: false,
                streakBroken: false,
                weeklySummary: false,
                productResearch: false,
                winbackOffers: false,
            };
        }

        await ctx.db.patch(profile._id, { emailPreferences: updated });
        return { ok: true, userId: profile.userId };
    },
});

// ────────────────────────────────────────────────────────────────
// Referral program
// ────────────────────────────────────────────────────────────────

const REFERRAL_CODE_LENGTH = 6;
const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion

const generateRandomCode = (): string => {
    let code = "";
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
    }
    return code;
};

// Ensure the current user has a referral code; returns the code.
export const ensureReferralCode = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!profile) return null;
        if (profile.referralCode) return profile.referralCode;

        // Generate a unique code (retry on collision)
        let code = generateRandomCode();
        let attempts = 0;
        while (attempts < 10) {
            const existing = await ctx.db
                .query("profiles")
                .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
                .first();
            if (!existing) break;
            code = generateRandomCode();
            attempts++;
        }

        await ctx.db.patch(profile._id, { referralCode: code });
        return code;
    },
});

// Store the referral code on the new user's profile (called during signup)
export const setReferredBy = mutation({
    args: { userId: v.string(), referralCode: v.string() },
    handler: async (ctx, args) => {
        const code = args.referralCode.trim().toUpperCase();
        if (!code || code.length !== REFERRAL_CODE_LENGTH) return { ok: false };

        // Verify the referral code exists and isn't the user's own
        const referrer = await ctx.db
            .query("profiles")
            .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
            .first();
        if (!referrer || referrer.userId === args.userId) return { ok: false };

        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
        if (!profile) return { ok: false };
        // Don't overwrite if already set
        if (profile.referredBy) return { ok: false };

        await ctx.db.patch(profile._id, { referredBy: code });
        return { ok: true };
    },
});

// Get referral stats for a user
export const getReferralStats = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return null;

        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!profile) return null;

        const referralCode = profile.referralCode || null;
        if (!referralCode) {
            return { referralCode: null, successfulReferrals: 0, creditsEarned: 0 };
        }

        // Count profiles that were referred by this code AND completed their first upload credit
        const allProfiles = await ctx.db.query("profiles").collect();
        const referredProfiles = allProfiles.filter(
            (p) => p.referredBy === referralCode && p.referralCreditApplied === true
        );

        return {
            referralCode,
            successfulReferrals: referredProfiles.length,
            creditsEarned: referredProfiles.length, // 1 credit per successful referral
        };
    },
});

// Apply referral credit after a referred user's first upload.
// Grants +1 credit to both the referrer and the referee.
export const applyReferralCredit = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!profile) return { applied: false };
        if (profile.referralCreditApplied) return { applied: false }; // already applied
        if (!profile.referredBy) return { applied: false }; // not referred

        // Find the referrer
        const referrer = await ctx.db
            .query("profiles")
            .withIndex("by_referralCode", (q) => q.eq("referralCode", profile.referredBy))
            .first();

        if (!referrer) return { applied: false };

        // Grant +1 credit to referee (current user)
        const refereeSub = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (refereeSub) {
            await ctx.db.patch(refereeSub._id, {
                purchasedUploadCredits: (refereeSub.purchasedUploadCredits || 0) + 1,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId: args.userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: "GHS",
                purchasedUploadCredits: 1,
                consumedUploadCredits: 0,
            });
        }

        // Grant +1 credit to referrer
        const referrerSub = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", referrer.userId))
            .first();

        if (referrerSub) {
            await ctx.db.patch(referrerSub._id, {
                purchasedUploadCredits: (referrerSub.purchasedUploadCredits || 0) + 1,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId: referrer.userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: "GHS",
                purchasedUploadCredits: 1,
                consumedUploadCredits: 0,
            });
        }

        // Mark as applied
        await ctx.db.patch(profile._id, { referralCreditApplied: true });

        return { applied: true };
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
