import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
    consumeUploadCreditOrThrow,
    getHistoricalStoredUploadCount,
} from "./subscriptions";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

const isSupportedAssignmentMimeType = (fileType: string) => {
    const normalized = String(fileType || "").toLowerCase();
    return normalized === PDF_MIME || normalized === DOCX_MIME || normalized.startsWith("image/");
};

const deriveThreadTitle = (fileName: string) => {
    const base = String(fileName || "")
        .replace(/\.[^/.]+$/, "")
        .replace(/\s+/g, " ")
        .trim();
    return base || "Assignment Helper";
};

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
            message: "You must be signed in to upload assignments.",
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

export const listThreads = query({
    args: {
        userId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (!args.userId) return [];

        return await ctx.db
            .query("assignmentThreads")
            .withIndex("by_userId_updatedAt", (q) => q.eq("userId", args.userId!))
            .order("desc")
            .collect();
    },
});

export const getThreadWithMessages = query({
    args: {
        userId: v.optional(v.string()),
        threadId: v.id("assignmentThreads"),
    },
    handler: async (ctx, args) => {
        if (!args.userId) return null;

        const thread = await ctx.db.get(args.threadId);
        if (!thread || thread.userId !== args.userId) {
            return null;
        }

        const messages = await ctx.db
            .query("assignmentMessages")
            .withIndex("by_threadId_createdAt", (q) => q.eq("threadId", args.threadId))
            .order("asc")
            .collect();

        return {
            thread,
            messages,
        };
    },
});

export const createThreadFromUpload = mutation({
    args: {
        userId: v.string(),
        fileName: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
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

        if (!isSupportedAssignmentMimeType(args.fileType)) {
            throw new Error("Unsupported file format. Upload a PDF, DOCX, or image file.");
        }
        if (args.fileSize > MAX_FILE_SIZE_BYTES) {
            throw new Error("File is too large. Maximum supported size is 50MB.");
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

        const fileUrl = await ctx.storage.getUrl(args.storageId);
        const now = Date.now();

        const threadData = {
            userId: args.userId,
            title: deriveThreadTitle(args.fileName),
            status: "processing",
            fileName: args.fileName,
            fileType: args.fileType,
            fileSize: args.fileSize,
            storageId: args.storageId,
            updatedAt: now,
        };
        if (fileUrl) {
            threadData.fileUrl = fileUrl;
        }

        const threadId = await ctx.db.insert("assignmentThreads", threadData);

        // Apply referral credit on first upload (non-blocking, best-effort)
        try {
            const profile = await ctx.db
                .query("profiles")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .first();

            if (profile?.referredBy && !profile.referralCreditApplied) {
                const referrer = await ctx.db
                    .query("profiles")
                    .withIndex("by_referralCode", (q) => q.eq("referralCode", profile.referredBy))
                    .first();

                if (referrer) {
                    // Grant +1 credit to referee
                    const refereeSub = await ctx.db
                        .query("subscriptions")
                        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                        .first();
                    if (refereeSub) {
                        await ctx.db.patch(refereeSub._id, {
                            purchasedUploadCredits: (refereeSub.purchasedUploadCredits || 0) + 1,
                        });
                    }

                    // Grant +1 credit to referrer
                    const referrerSub = await ctx.db
                        .query("subscriptions")
                        .withIndex("by_userId", (q) => q.eq("userId", referrer.userId))
                        .first();
                    if (referrerSub) {
                        await ctx.db.patch(referrerSub._id, {
                            purchasedUploadCredits: (referrerSub.purchasedUploadCredits || 0) + 1,
                        });
                    } else {
                        await ctx.db.insert("subscriptions", {
                            userId: referrer.userId,
                            plan: "free",
                            status: "active",
                            amount: 0,
                            currency: "GHS",
                            purchasedUploadCredits: 1,
                            consumedUploadCredits: 0,
                        });
                    }

                    await ctx.db.patch(profile._id, { referralCreditApplied: true });
                }
            }
        } catch (err) {
            console.warn("[createAssignmentThread] Failed to apply referral credit", err);
        }

        return {
            threadId,
        };
    },
});

export const renameThread = mutation({
    args: {
        userId: v.string(),
        threadId: v.id("assignmentThreads"),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const thread = await ctx.db.get(args.threadId);
        if (!thread || thread.userId !== args.userId) {
            throw new Error("Assignment thread not found.");
        }

        const title = args.title.trim();
        if (!title) {
            throw new Error("Thread title cannot be empty.");
        }
        if (title.length > 120) {
            throw new Error("Thread title cannot exceed 120 characters.");
        }

        await ctx.db.patch(args.threadId, {
            title,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

export const deleteThread = mutation({
    args: {
        userId: v.string(),
        threadId: v.id("assignmentThreads"),
    },
    handler: async (ctx, args) => {
        const thread = await ctx.db.get(args.threadId);
        if (!thread || thread.userId !== args.userId) {
            throw new Error("Assignment thread not found.");
        }

        const messages = await ctx.db
            .query("assignmentMessages")
            .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }

        if (thread.storageId) {
            await ctx.storage.delete(thread.storageId);
        }

        await ctx.db.delete(args.threadId);
        return { success: true };
    },
});

export const appendMessage = mutation({
    args: {
        userId: v.string(),
        threadId: v.id("assignmentThreads"),
        role: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const thread = await ctx.db.get(args.threadId);
        if (!thread || thread.userId !== args.userId) {
            throw new Error("Assignment thread not found.");
        }

        if (!["user", "assistant"].includes(args.role)) {
            throw new Error("Invalid message role.");
        }

        const content = args.content.trim();
        if (!content) {
            throw new Error("Message cannot be empty.");
        }
        if (content.length > 20000) {
            throw new Error("Message is too long.");
        }

        const now = Date.now();
        const messageId = await ctx.db.insert("assignmentMessages", {
            threadId: args.threadId,
            userId: args.userId,
            role: args.role,
            content,
            createdAt: now,
        });

        await ctx.db.patch(args.threadId, {
            updatedAt: now,
        });

        return { messageId };
    },
});

export const updateThreadStatus = mutation({
    args: {
        userId: v.string(),
        threadId: v.id("assignmentThreads"),
        status: v.string(),
        extractedText: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const thread = await ctx.db.get(args.threadId);
        if (!thread || thread.userId !== args.userId) {
            throw new Error("Assignment thread not found.");
        }

        if (!["processing", "ready", "error"].includes(args.status)) {
            throw new Error("Invalid assignment thread status.");
        }

        const patch: {
            status: string;
            updatedAt: number;
            extractedText?: string;
            errorMessage?: string;
        } = {
            status: args.status,
            updatedAt: Date.now(),
        };

        if (args.extractedText !== undefined) {
            patch.extractedText = args.extractedText;
        }

        if (args.errorMessage !== undefined) {
            patch.errorMessage = args.errorMessage;
        } else if (args.status === "ready") {
            patch.errorMessage = "";
        }

        await ctx.db.patch(args.threadId, patch);
        return { success: true };
    },
});
