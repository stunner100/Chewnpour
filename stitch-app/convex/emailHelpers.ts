import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const EMAIL_COOLDOWN_HOURS = 20;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Generate a simple random token for unsubscribe links.
 */
const generateToken = (): string => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 32; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
};

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/** Log that an email was sent (used for cooldown dedup). */
export const logEmailSent = internalMutation({
    args: {
        userId: v.string(),
        emailType: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("emailLog", {
            userId: args.userId,
            emailType: args.emailType,
            sentAt: Date.now(),
        });
    },
});

/** Ensure a profile has an unsubscribe token and return it. */
export const ensureUnsubscribeToken = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (!profile) return null;

        if (profile.emailUnsubscribeToken) {
            return profile.emailUnsubscribeToken;
        }

        const token = generateToken();
        await ctx.db.patch(profile._id, { emailUnsubscribeToken: token });
        return token;
    },
});

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

/** Return all profiles (lightweight projection used by email actions). */
export const getAllProfilesForEmail = internalQuery({
    args: {},
    handler: async (ctx) => {
        const profiles = await ctx.db.query("profiles").collect();
        return profiles.map((p) => ({
            _id: p._id,
            userId: p.userId,
            fullName: p.fullName,
            streakDays: p.streakDays,
            totalStudyHours: p.totalStudyHours,
            emailPreferences: p.emailPreferences,
            emailUnsubscribeToken: p.emailUnsubscribeToken,
        }));
    },
});

/** Return recent email log entries for given types. */
export const getRecentEmailLogs = internalQuery({
    args: { emailTypes: v.array(v.string()) },
    handler: async (ctx, args) => {
        const cutoff = Date.now() - EMAIL_COOLDOWN_HOURS * HOUR_MS;
        const all = await ctx.db.query("emailLog").collect();
        return all.filter(
            (log) =>
                args.emailTypes.includes(log.emailType) && log.sentAt >= cutoff,
        );
    },
});

/** Return exam + concept attempts for a single user. */
export const getUserAttempts = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const examAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();
        const conceptAttempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();
        return { examAttempts, conceptAttempts };
    },
});
