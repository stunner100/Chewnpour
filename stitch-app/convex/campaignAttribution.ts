import { v } from "convex/values";
import { mutation } from "./_generated/server";

const normalizeUserId = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

const normalizeString = (value: unknown, maxLength: number) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return "";
    return normalized.slice(0, maxLength);
};

export const recordCampaignLanding = mutation({
    args: {
        campaignId: v.string(),
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
        content: v.optional(v.string()),
        landingPath: v.optional(v.string()),
        landingSearch: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const userId = normalizeUserId(identity?.subject);
        if (!userId) {
            throw new Error("Authentication required.");
        }

        const campaignId = normalizeString(args.campaignId, 160);
        if (!campaignId) {
            throw new Error("Campaign id is required.");
        }

        const source = normalizeString(args.source, 80) || undefined;
        const medium = normalizeString(args.medium, 80) || undefined;
        const content = normalizeString(args.content, 160) || undefined;
        const landingPath = normalizeString(args.landingPath, 200) || undefined;
        const landingSearch = normalizeString(args.landingSearch, 500) || undefined;
        const now = Date.now();

        const existing = await ctx.db
            .query("campaignLandingEvents")
            .withIndex("by_userId_campaignId", (q) => q.eq("userId", userId).eq("campaignId", campaignId))
            .first();

        if (existing) {
            const nextLandingCount = Math.max(1, Number(existing.landingCount || 0) + 1);
            await ctx.db.patch(existing._id, {
                source: source || existing.source,
                medium: medium || existing.medium,
                content: content || existing.content,
                landingPath: landingPath || existing.landingPath,
                landingSearch: landingSearch || existing.landingSearch,
                lastLandedAt: now,
                landingCount: nextLandingCount,
            });
            return {
                campaignId,
                userId,
                firstLandedAt: Number(existing.firstLandedAt || now) || now,
                lastLandedAt: now,
                landingCount: nextLandingCount,
            };
        }

        await ctx.db.insert("campaignLandingEvents", {
            campaignId,
            userId,
            source,
            medium,
            content,
            landingPath,
            landingSearch,
            firstLandedAt: now,
            lastLandedAt: now,
            landingCount: 1,
        });

        return {
            campaignId,
            userId,
            firstLandedAt: now,
            lastLandedAt: now,
            landingCount: 1,
        };
    },
});
