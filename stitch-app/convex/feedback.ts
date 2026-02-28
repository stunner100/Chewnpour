import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const submitFeedback = mutation({
    args: {
        userId: v.string(),
        rating: v.number(),
        message: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (!args.userId) {
            throw new Error("Must be signed in to submit feedback");
        }
        if (args.rating !== 0 && (args.rating < 1 || args.rating > 5)) {
            throw new Error("Rating must be between 1 and 5");
        }

        await ctx.db.insert("feedback", {
            userId: args.userId,
            rating: args.rating,
            message: args.message,
            createdAt: Date.now(),
        });
    },
});
