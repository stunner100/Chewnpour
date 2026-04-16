import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const toNonNegativeInt = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
};

const buildDateKey = (timestampMs: number) => {
    const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
    return new Date(safeTimestamp).toISOString().slice(0, 10);
};

export const recordUsageInternal = internalMutation({
    args: {
        userId: v.string(),
        requestCount: v.number(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        timestampMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) return { ok: false, skipped: true, reason: "missing_user" };

        const requestCount = toNonNegativeInt(args.requestCount);
        const promptTokens = toNonNegativeInt(args.promptTokens);
        const completionTokens = toNonNegativeInt(args.completionTokens);
        const totalTokens = toNonNegativeInt(args.totalTokens);
        if (requestCount <= 0 && totalTokens <= 0 && promptTokens <= 0 && completionTokens <= 0) {
            return { ok: false, skipped: true, reason: "empty_usage" };
        }

        const timestampMs = Number(args.timestampMs || Date.now());
        const date = buildDateKey(timestampMs);
        const existing = await ctx.db
            .query("llmUsageDaily")
            .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", date))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                requestCount: toNonNegativeInt(existing.requestCount) + requestCount,
                promptTokens: toNonNegativeInt(existing.promptTokens) + promptTokens,
                completionTokens: toNonNegativeInt(existing.completionTokens) + completionTokens,
                totalTokens: toNonNegativeInt(existing.totalTokens) + totalTokens,
                updatedAt: timestampMs,
            });
            return { ok: true, updated: true, userId, date };
        }

        await ctx.db.insert("llmUsageDaily", {
            userId,
            date,
            requestCount,
            promptTokens,
            completionTokens,
            totalTokens,
            updatedAt: timestampMs,
        });
        return { ok: true, inserted: true, userId, date };
    },
});

export const recordProviderAttemptInternal = internalMutation({
    args: {
        feature: v.string(),
        provider: v.string(),
        model: v.string(),
        requestCount: v.number(),
        successCount: v.number(),
        failureCount: v.number(),
        timeoutCount: v.number(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        totalLatencyMs: v.number(),
        maxLatencyMs: v.number(),
        timestampMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const feature = String(args.feature || "").trim() || "unknown";
        const provider = String(args.provider || "").trim() || "unknown";
        const model = String(args.model || "").trim() || "unknown";
        const requestCount = toNonNegativeInt(args.requestCount);
        const successCount = toNonNegativeInt(args.successCount);
        const failureCount = toNonNegativeInt(args.failureCount);
        const timeoutCount = toNonNegativeInt(args.timeoutCount);
        const promptTokens = toNonNegativeInt(args.promptTokens);
        const completionTokens = toNonNegativeInt(args.completionTokens);
        const totalTokens = toNonNegativeInt(args.totalTokens);
        const totalLatencyMs = toNonNegativeInt(args.totalLatencyMs);
        const maxLatencyMs = toNonNegativeInt(args.maxLatencyMs);

        if (
            requestCount <= 0
            && successCount <= 0
            && failureCount <= 0
            && timeoutCount <= 0
            && totalTokens <= 0
            && totalLatencyMs <= 0
            && maxLatencyMs <= 0
        ) {
            return { ok: false, skipped: true, reason: "empty_provider_attempt" };
        }

        const timestampMs = Number(args.timestampMs || Date.now());
        const date = buildDateKey(timestampMs);
        const existing = await ctx.db
            .query("llmProviderPerformanceDaily")
            .withIndex("by_date_feature_provider_model", (q) =>
                q.eq("date", date).eq("feature", feature).eq("provider", provider).eq("model", model)
            )
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                requestCount: toNonNegativeInt(existing.requestCount) + requestCount,
                successCount: toNonNegativeInt(existing.successCount) + successCount,
                failureCount: toNonNegativeInt(existing.failureCount) + failureCount,
                timeoutCount: toNonNegativeInt(existing.timeoutCount) + timeoutCount,
                promptTokens: toNonNegativeInt(existing.promptTokens) + promptTokens,
                completionTokens: toNonNegativeInt(existing.completionTokens) + completionTokens,
                totalTokens: toNonNegativeInt(existing.totalTokens) + totalTokens,
                totalLatencyMs: toNonNegativeInt(existing.totalLatencyMs) + totalLatencyMs,
                maxLatencyMs: Math.max(toNonNegativeInt(existing.maxLatencyMs), maxLatencyMs),
                updatedAt: timestampMs,
            });
            return { ok: true, updated: true, date, feature, provider, model };
        }

        await ctx.db.insert("llmProviderPerformanceDaily", {
            date,
            feature,
            provider,
            model,
            requestCount,
            successCount,
            failureCount,
            timeoutCount,
            promptTokens,
            completionTokens,
            totalTokens,
            totalLatencyMs,
            maxLatencyMs,
            updatedAt: timestampMs,
        });
        return { ok: true, inserted: true, date, feature, provider, model };
    },
});
