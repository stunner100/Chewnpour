import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const deleteTopicAsAdmin = mutation({
    args: {
        topicId: v.id("topics"),
        confirmTitle: v.string(),
    },
    handler: async (ctx, args) => {
        const access = await ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {});
        if (!access?.authUserId || !access.allowlistConfigured || !access.isAllowed) {
            throw new Error("Admin access required.");
        }

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                ok: true,
                deleted: false,
                topicId: args.topicId,
                title: null,
                courseId: null,
            };
        }

        const topicTitle = String(topic.title || "").trim();
        const confirmTitle = String(args.confirmTitle || "").trim();
        if (!confirmTitle) {
            throw new Error("Topic title confirmation is required.");
        }
        if (confirmTitle !== topicTitle) {
            throw new Error("Topic title confirmation mismatch.");
        }

        const deletion = await ctx.runMutation(internal.topics.deleteTopicCascadeInternal, { topicId: args.topicId });
        return {
            ok: true,
            ...deletion,
        };
    },
});
