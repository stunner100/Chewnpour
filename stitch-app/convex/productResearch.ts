import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const OUTREACH_COOLDOWN_DAYS = 45;
const RESPONSE_SUPPRESSION_DAYS = 90;
const DUPLICATE_SUBMISSION_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_CAMPAIGN = "product_research_v1";
const MAX_OUTREACH_CANDIDATES = 200;
const RESEARCH_EMAIL_TYPE = "product_research";
const TOKEN_LENGTH = 40;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeString = (value: unknown, maxLength: number): string => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return "";
    return normalized.slice(0, maxLength);
};

const normalizeRequiredField = (value: unknown, fieldName: string): string => {
    const normalized = normalizeString(value, 1200);
    if (!normalized) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalized;
};

const normalizeOptionalField = (value: unknown, maxLength: number): string | undefined => {
    const normalized = normalizeString(value, maxLength);
    return normalized || undefined;
};

const normalizeUserId = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const normalizeToken = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const normalizeEmail = (value: unknown): string => {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!normalized || !EMAIL_PATTERN.test(normalized)) return "";
    return normalized;
};

const generateToken = (): string => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
};

const classifyCohort = (now: number, lastActivityAt: number): string => {
    const daysSinceLastActivity = Math.max(0, Math.floor((now - lastActivityAt) / DAY_MS));
    if (daysSinceLastActivity <= 14) return "active_recent";
    if (daysSinceLastActivity <= 60) return "active_lapsed";
    return "reactivation";
};

const fetchAuthEmailByUserId = async (ctx: any, userId: string): Promise<string> => {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return "";
    const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "user",
        where: [{ field: "_id", operator: "in", value: [normalizedUserId] }],
        paginationOpts: {
            cursor: null,
            numItems: 1,
        },
    });
    const row = Array.isArray(result?.page) ? result.page[0] : null;
    return normalizeEmail(row?.email);
};

export const ensureProductResearchToken = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = normalizeUserId(args.userId);
        if (!userId) return null;

        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!profile) return null;

        if (profile.productResearchToken) return profile.productResearchToken;

        const token = generateToken();
        await ctx.db.patch(profile._id, { productResearchToken: token });
        return token;
    },
});

export const getOutreachCandidates = internalQuery({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const now = Date.now();
        const outreachCutoff = now - OUTREACH_COOLDOWN_DAYS * DAY_MS;
        const responseCutoff = now - RESPONSE_SUPPRESSION_DAYS * DAY_MS;
        const requestedLimit = Number.isFinite(Number(args.limit))
            ? Math.max(1, Math.min(MAX_OUTREACH_CANDIDATES, Math.floor(Number(args.limit))))
            : MAX_OUTREACH_CANDIDATES;

        const [profiles, uploads, assignmentThreads, examAttempts, conceptAttempts, emailLogs, responses] =
            await Promise.all([
                ctx.db.query("profiles").collect(),
                ctx.db.query("uploads").collect(),
                ctx.db.query("assignmentThreads").collect(),
                ctx.db.query("examAttempts").collect(),
                ctx.db.query("conceptAttempts").collect(),
                ctx.db.query("emailLog").collect(),
                ctx.db.query("productResearchResponses").collect(),
            ]);

        const lastActivityByUser = new Map<string, number>();
        const updateLastActivity = (userId: string, timestamp: unknown) => {
            const normalizedUserId = normalizeUserId(userId);
            if (!normalizedUserId) return;
            const ts = Number(timestamp);
            if (!Number.isFinite(ts) || ts <= 0) return;
            const previous = lastActivityByUser.get(normalizedUserId) || 0;
            if (ts > previous) {
                lastActivityByUser.set(normalizedUserId, ts);
            }
        };

        for (const upload of uploads) {
            updateLastActivity(upload.userId, upload._creationTime);
        }
        for (const thread of assignmentThreads) {
            updateLastActivity(thread.userId, thread._creationTime);
        }
        for (const attempt of examAttempts) {
            updateLastActivity(attempt.userId, attempt._creationTime);
        }
        for (const attempt of conceptAttempts) {
            updateLastActivity(attempt.userId, attempt._creationTime);
        }

        const lastResearchEmailByUser = new Map<string, number>();
        for (const log of emailLogs) {
            const userId = normalizeUserId(log.userId);
            if (!userId || log.emailType !== RESEARCH_EMAIL_TYPE) continue;
            const ts = Number(log.sentAt);
            if (!Number.isFinite(ts) || ts <= 0) continue;
            const previous = lastResearchEmailByUser.get(userId) || 0;
            if (ts > previous) {
                lastResearchEmailByUser.set(userId, ts);
            }
        }

        const lastResearchResponseByUser = new Map<string, number>();
        for (const response of responses) {
            const userId = normalizeUserId(response.userId);
            if (!userId) continue;
            const ts = Number(response.createdAt) || Number(response._creationTime) || 0;
            if (!Number.isFinite(ts) || ts <= 0) continue;
            const previous = lastResearchResponseByUser.get(userId) || 0;
            if (ts > previous) {
                lastResearchResponseByUser.set(userId, ts);
            }
        }

        return profiles
            .map((profile) => {
                const userId = normalizeUserId(profile.userId);
                if (!userId) return null;

                const preferences = profile.emailPreferences ?? {
                    streakReminders: true,
                    streakBroken: true,
                    weeklySummary: true,
                    productResearch: true,
                    winbackOffers: true,
                };
                if (!preferences.productResearch) return null;

                const lastActivityAt = lastActivityByUser.get(userId) || 0;
                if (lastActivityAt <= 0) return null;

                const lastSentAt = lastResearchEmailByUser.get(userId) || 0;
                if (lastSentAt >= outreachCutoff) return null;

                const lastResponseAt = lastResearchResponseByUser.get(userId) || 0;
                if (lastResponseAt >= responseCutoff) return null;

                return {
                    userId,
                    fullName: normalizeOptionalField(profile.fullName, 120),
                    productResearchToken: normalizeOptionalField(profile.productResearchToken, 120),
                    campaign: DEFAULT_CAMPAIGN,
                    cohort: classifyCohort(now, lastActivityAt),
                    lastActivityAt,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((left, right) => right.lastActivityAt - left.lastActivityAt)
            .slice(0, requestedLimit);
    },
});

export const getPromptByToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const token = normalizeToken(args.token);
        if (!token) return { valid: false as const };

        const profiles = await ctx.db.query("profiles").collect();
        const profile = profiles.find((row) => row.productResearchToken === token);
        if (!profile) return { valid: false as const };

        return {
            valid: true as const,
            userId: normalizeUserId(profile.userId),
            fullName: normalizeOptionalField(profile.fullName, 120) || null,
            campaign: DEFAULT_CAMPAIGN,
        };
    },
});

export const submitResponseByToken = mutation({
    args: {
        token: v.string(),
        howUsingApp: v.string(),
        wantedFeatures: v.string(),
        additionalNotes: v.optional(v.string()),
        campaign: v.optional(v.string()),
        cohort: v.optional(v.string()),
        source: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const token = normalizeToken(args.token);
        if (!token) {
            throw new Error("A valid product research link is required.");
        }

        const profiles = await ctx.db.query("profiles").collect();
        const profile = profiles.find((row) => row.productResearchToken === token);
        if (!profile) {
            throw new Error("This product research link is invalid or expired.");
        }

        const userId = normalizeUserId(profile.userId);
        if (!userId) {
            throw new Error("Unable to resolve account for this research link.");
        }

        const howUsingApp = normalizeRequiredField(args.howUsingApp, "How you are using the app");
        const wantedFeatures = normalizeRequiredField(args.wantedFeatures, "Wanted features");
        const additionalNotes = normalizeOptionalField(args.additionalNotes, 4000);
        const campaign = normalizeOptionalField(args.campaign, 120) || DEFAULT_CAMPAIGN;
        const cohort = normalizeOptionalField(args.cohort, 120);
        const source = normalizeOptionalField(args.source, 80) || "email_research_form";
        const now = Date.now();

        const existing = await ctx.db
            .query("productResearchResponses")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect();
        const duplicate = existing.find((entry) => {
            const createdAt = Number(entry.createdAt) || Number(entry._creationTime) || 0;
            if (now - createdAt > DUPLICATE_SUBMISSION_WINDOW_MS) return false;
            return (
                normalizeString(entry.campaign, 120) === campaign
                && normalizeString(entry.howUsingApp, 1200) === howUsingApp
                && normalizeString(entry.wantedFeatures, 1200) === wantedFeatures
                && normalizeString(entry.additionalNotes, 4000) === (additionalNotes || "")
            );
        });

        if (duplicate) {
            return {
                ok: true as const,
                duplicate: true as const,
                responseId: String(duplicate._id),
            };
        }

        const email = await fetchAuthEmailByUserId(ctx, userId);
        const responseId = await ctx.db.insert("productResearchResponses", {
            userId,
            email: email || undefined,
            campaign,
            cohort,
            howUsingApp,
            wantedFeatures,
            additionalNotes,
            source,
            createdAt: now,
        });

        return {
            ok: true as const,
            duplicate: false as const,
            responseId: String(responseId),
        };
    },
});
