import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for file storage
// Note: This doesn't require authentication since we validate on createUpload
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

// Create upload record after file is stored
export const createUpload = mutation({
    args: {
        userId: v.string(),
        fileName: v.string(),
        fileType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        // Get the file URL from storage
        const fileUrl = await ctx.storage.getUrl(args.storageId);

        const uploadId = await ctx.db.insert("uploads", {
            userId: args.userId,
            fileName: args.fileName,
            fileUrl: fileUrl || "",
            fileType: args.fileType,
            fileSize: args.fileSize,
            status: "processing",
            storageId: args.storageId,
        });

        return uploadId;
    },
});

// Get all uploads for a user
export const getUserUploads = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const userId = args.userId;
        if (!userId) return [];

        const uploads = await ctx.db
            .query("uploads")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();

        return uploads;
    },
});

// Get single upload by ID
export const getUpload = query({
    args: { uploadId: v.id("uploads") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.uploadId);
    },
});

// Update upload status
export const updateUploadStatus = mutation({
    args: {
        uploadId: v.id("uploads"),
        status: v.string(),
        processingStep: v.optional(v.string()),
        processingProgress: v.optional(v.number()),
        plannedTopicCount: v.optional(v.number()),
        generatedTopicCount: v.optional(v.number()),
        plannedTopicTitles: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const updateData: {
            status: string;
            processingStep?: string;
            processingProgress?: number;
            plannedTopicCount?: number;
            generatedTopicCount?: number;
            plannedTopicTitles?: string[];
        } = {
            status: args.status,
        };

        if (args.processingStep !== undefined) {
            updateData.processingStep = args.processingStep;
        }
        if (args.processingProgress !== undefined) {
            updateData.processingProgress = args.processingProgress;
        }
        if (args.plannedTopicCount !== undefined) {
            updateData.plannedTopicCount = args.plannedTopicCount;
        }
        if (args.generatedTopicCount !== undefined) {
            updateData.generatedTopicCount = args.generatedTopicCount;
        }
        if (args.plannedTopicTitles !== undefined) {
            updateData.plannedTopicTitles = args.plannedTopicTitles;
        }

        await ctx.db.patch(args.uploadId, updateData);
    },
});

// Delete upload
export const deleteUpload = mutation({
    args: { uploadId: v.id("uploads") },
    handler: async (ctx, args) => {
        const upload = await ctx.db.get(args.uploadId);
        if (upload && upload.storageId) {
            await ctx.storage.delete(upload.storageId);
        }
        await ctx.db.delete(args.uploadId);
    },
});
