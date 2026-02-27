import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveAuthUserId } from "./lib/examSecurity";

export const getNote = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return null;

        const note = await ctx.db
            .query("topicNotes")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .first();

        return note || null;
    },
});

export const saveNote = mutation({
    args: {
        topicId: v.id("topics"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) throw new Error("Not authenticated");

        const existing = await ctx.db
            .query("topicNotes")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                content: args.content,
                updatedAt: Date.now(),
            });
            return existing._id;
        }

        return await ctx.db.insert("topicNotes", {
            userId,
            topicId: args.topicId,
            content: args.content,
            updatedAt: Date.now(),
        });
    },
});

export const deleteNote = mutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) throw new Error("Not authenticated");

        const existing = await ctx.db
            .query("topicNotes")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});
