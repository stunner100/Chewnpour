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
