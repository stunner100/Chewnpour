import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUserId } from "./lib/authz";

export const listFolders = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireAuthenticatedUserId(ctx);
        return await ctx.db
            .query("courseFolders")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    },
});

export const createFolder = mutation({
    args: {
        name: v.string(),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const trimmed = args.name.trim();
        if (!trimmed) throw new Error("Folder name is required.");
        if (trimmed.length > 80) throw new Error("Folder name is too long.");

        return await ctx.db.insert("courseFolders", {
            userId,
            name: trimmed,
            color: args.color,
        });
    },
});

export const renameFolder = mutation({
    args: {
        folderId: v.id("courseFolders"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const folder = await ctx.db.get(args.folderId);
        if (!folder || folder.userId !== userId) {
            throw new Error("Folder not found or access denied.");
        }
        const trimmed = args.name.trim();
        if (!trimmed) throw new Error("Folder name is required.");
        if (trimmed.length > 80) throw new Error("Folder name is too long.");
        await ctx.db.patch(args.folderId, { name: trimmed });
    },
});

export const deleteFolder = mutation({
    args: {
        folderId: v.id("courseFolders"),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const folder = await ctx.db.get(args.folderId);
        if (!folder || folder.userId !== userId) {
            throw new Error("Folder not found or access denied.");
        }

        // Move any courses in this folder back out to the main dashboard.
        const courses = await ctx.db
            .query("courses")
            .withIndex("by_userId_folderId", (q) =>
                q.eq("userId", userId).eq("folderId", args.folderId)
            )
            .collect();

        for (const course of courses) {
            await ctx.db.patch(course._id, { folderId: undefined });
        }

        await ctx.db.delete(args.folderId);
    },
});

export const moveCourseToFolder = mutation({
    args: {
        courseId: v.id("courses"),
        folderId: v.union(v.id("courseFolders"), v.null()),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const course = await ctx.db.get(args.courseId);
        if (!course || course.userId !== userId) {
            throw new Error("Course not found or access denied.");
        }

        if (args.folderId !== null) {
            const folder = await ctx.db.get(args.folderId);
            if (!folder || folder.userId !== userId) {
                throw new Error("Folder not found or access denied.");
            }
        }

        await ctx.db.patch(args.courseId, {
            folderId: args.folderId === null ? undefined : args.folderId,
        });
    },
});
