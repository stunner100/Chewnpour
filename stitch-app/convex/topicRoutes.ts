import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { assertAuthorizedUser, resolveAuthUserId } from "./lib/examSecurity";

const resolveTopicIdFromRoute = (ctx: any, routeId: unknown) => {
    const normalizedRouteId = typeof routeId === "string" ? routeId.trim() : "";
    if (!normalizedRouteId) return null;
    try {
        return ctx.db.normalizeId("topics", normalizedRouteId);
    } catch {
        return null;
    }
};

export const getTopicRouteState = query({
    args: { routeId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) {
            return { status: "invalid" as const };
        }

        const topicId = resolveTopicIdFromRoute(ctx, args.routeId);
        if (!topicId) {
            return { status: "invalid" as const };
        }

        const owner = await ctx.runQuery(internal.topics.getTopicOwnerUserIdInternal, { topicId });
        if (!owner?.userId) {
            return { status: "invalid" as const };
        }

        try {
            assertAuthorizedUser({
                authUserId,
                resourceOwnerUserId: owner.userId,
            });
        } catch {
            return { status: "invalid" as const };
        }

        const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, { topicId });
        if (!topic) {
            return { status: "invalid" as const };
        }

        return {
            status: "resolved" as const,
            topic,
        };
    },
});
