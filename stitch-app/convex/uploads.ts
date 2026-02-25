import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    consumeUploadCreditOrThrow,
    getHistoricalStoredUploadCount,
} from "./subscriptions";

const resolveAuthUserId = (identity: any) => {
    if (!identity || typeof identity !== "object") return "";
    const candidates = [
        identity.subject,
        identity.userId,
        identity.id,
        identity.tokenIdentifier,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
};

const assertAuthorizedUser = (identity: any, userId: string) => {
    const authUserId = resolveAuthUserId(identity);
    if (!authUserId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "You must be signed in to upload files.",
        });
    }
    if (authUserId !== userId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "You do not have permission to upload for this user.",
        });
    }
};

const isUploadQuotaExceededError = (error: unknown) => {
    return error instanceof ConvexError
        && typeof error.data === "object"
        && error.data !== null
        && String((error.data as { code?: unknown }).code || "") === "UPLOAD_QUOTA_EXCEEDED";
};

const isAuthenticationError = (error: unknown) => {
    return error instanceof ConvexError
        && typeof error.data === "object"
        && error.data !== null
        && ["UNAUTHENTICATED", "UNAUTHORIZED"].includes(
            String((error.data as { code?: unknown }).code || "")
        );
};

// Generate upload URL for file storage
// Note: This doesn't require authentication since we validate on createUpload
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) {
            throw new ConvexError({
                code: "UNAUTHENTICATED",
                message: "You must be signed in to upload files.",
            });
        }
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
        const identity = await ctx.auth.getUserIdentity();
        try {
            assertAuthorizedUser(identity, args.userId);
        } catch (error) {
            if (isAuthenticationError(error)) {
                await ctx.storage.delete(args.storageId).catch(() => undefined);
            }
            throw error;
        }

        const historicalStoredUploadCount = await getHistoricalStoredUploadCount(ctx, args.userId);

        try {
            await consumeUploadCreditOrThrow(ctx, args.userId, historicalStoredUploadCount);
        } catch (error) {
            if (isUploadQuotaExceededError(error)) {
                await ctx.storage.delete(args.storageId).catch(() => undefined);
            }
            throw error;
        }

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
