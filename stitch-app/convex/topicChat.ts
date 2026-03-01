import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveAuthUserId } from "./lib/examSecurity";

const MAX_MESSAGE_LENGTH = 4000;

export const getMessages = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return [];

        const messages = await ctx.db
            .query("topicChatMessages")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .collect();

        // Sort by createdAt ascending (oldest first)
        messages.sort((a, b) => a.createdAt - b.createdAt);

        return messages.map((m) => ({
            _id: m._id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
        }));
    },
});

export const sendMessage = mutation({
    args: {
        topicId: v.id("topics"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) throw new Error("Not authenticated");

        const content = String(args.content || "").trim();
        if (!content) throw new Error("Message cannot be empty.");
        if (content.length > MAX_MESSAGE_LENGTH) {
            throw new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
        }

        const messageId = await ctx.db.insert("topicChatMessages", {
            userId,
            topicId: args.topicId,
            role: "user",
            content,
            createdAt: Date.now(),
        });

        return { messageId };
    },
});

export const appendAssistantMessage = mutation({
    args: {
        topicId: v.id("topics"),
        userId: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const content = String(args.content || "").trim();
        if (!content) return null;

        const messageId = await ctx.db.insert("topicChatMessages", {
            userId: args.userId,
            topicId: args.topicId,
            role: "assistant",
            content,
            createdAt: Date.now(),
        });

        return { messageId };
    },
});

export const clearChat = mutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) throw new Error("Not authenticated");

        const messages = await ctx.db
            .query("topicChatMessages")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId)
            )
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }
    },
});
