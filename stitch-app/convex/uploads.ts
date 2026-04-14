import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
    consumeUploadCreditOrThrow,
    getHistoricalStoredUploadCount,
} from "./subscriptions";
import { GROUNDED_EVIDENCE_INDEX_VERSION } from "./lib/groundedEvidenceIndex";

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
            errorMessage: "",
            storageId: args.storageId,
            extractionStatus: "pending",
            extractionQualityScore: 0,
            extractionCoverage: 0,
            extractionVersion: "v2",
            provisionalExtraction: false,
            evidenceIndexVersion: GROUNDED_EVIDENCE_INDEX_VERSION,
            evidencePassageCount: 0,
            embeddingsStatus: "pending",
            embeddingsVersion: "voyage-large-2-1536-v1",
            embeddedPassageCount: 0,
        });

        // Apply referral credit on first upload (non-blocking, best-effort)
        try {
            const profile = await ctx.db
                .query("profiles")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .first();

            if (profile?.referredBy && !profile.referralCreditApplied) {
                // Find the referrer
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

                    // Mark as applied
                    await ctx.db.patch(profile._id, { referralCreditApplied: true });
                }
            }
        } catch (err) {
            // Non-fatal: referral credit can be retried later
            console.warn("[createUpload] Failed to apply referral credit", err);
        }

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
        status: v.optional(v.string()),
        processingStep: v.optional(v.string()),
        processingProgress: v.optional(v.number()),
        plannedTopicCount: v.optional(v.number()),
        generatedTopicCount: v.optional(v.number()),
        plannedTopicTitles: v.optional(v.array(v.string())),
        errorMessage: v.optional(v.string()),
        extractionWarnings: v.optional(v.array(v.string())),
        extractionStatus: v.optional(v.string()),
        extractionQualityScore: v.optional(v.number()),
        extractionCoverage: v.optional(v.number()),
        extractionVersion: v.optional(v.string()),
        provisionalExtraction: v.optional(v.boolean()),
        extractionBackend: v.optional(v.string()),
        extractionParser: v.optional(v.string()),
        extractionFallbackUsed: v.optional(v.boolean()),
        extractionReplacementReason: v.optional(v.string()),
        extractionArtifactStorageId: v.optional(v.id("_storage")),
        evidenceIndexStorageId: v.optional(v.id("_storage")),
        evidenceIndexVersion: v.optional(v.string()),
        evidencePassageCount: v.optional(v.number()),
        embeddingsStatus: v.optional(v.string()),
        embeddingsVersion: v.optional(v.string()),
        embeddedPassageCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const updateData: {
            status?: string;
            processingStep?: string;
            processingProgress?: number;
            plannedTopicCount?: number;
            generatedTopicCount?: number;
            plannedTopicTitles?: string[];
            errorMessage?: string;
            extractionWarnings?: string[];
            extractionStatus?: string;
            extractionQualityScore?: number;
            extractionCoverage?: number;
            extractionVersion?: string;
            provisionalExtraction?: boolean;
            extractionBackend?: string;
            extractionParser?: string;
            extractionFallbackUsed?: boolean;
            extractionReplacementReason?: string;
            extractionArtifactStorageId?: Id<"_storage">;
            evidenceIndexStorageId?: Id<"_storage">;
            evidenceIndexVersion?: string;
            evidencePassageCount?: number;
            embeddingsStatus?: string;
            embeddingsVersion?: string;
            embeddedPassageCount?: number;
        } = {};

        if (args.status !== undefined) {
            updateData.status = args.status;
        }

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
        if (args.errorMessage !== undefined) {
            updateData.errorMessage = args.errorMessage;
        }
        if (args.extractionWarnings !== undefined) {
            updateData.extractionWarnings = args.extractionWarnings;
        }
        if (args.extractionStatus !== undefined) {
            updateData.extractionStatus = args.extractionStatus;
        }
        if (args.extractionQualityScore !== undefined) {
            updateData.extractionQualityScore = args.extractionQualityScore;
        }
        if (args.extractionCoverage !== undefined) {
            updateData.extractionCoverage = args.extractionCoverage;
        }
        if (args.extractionVersion !== undefined) {
            updateData.extractionVersion = args.extractionVersion;
        }
        if (args.provisionalExtraction !== undefined) {
            updateData.provisionalExtraction = args.provisionalExtraction;
        }
        if (args.extractionBackend !== undefined) {
            updateData.extractionBackend = args.extractionBackend;
        }
        if (args.extractionParser !== undefined) {
            updateData.extractionParser = args.extractionParser;
        }
        if (args.extractionFallbackUsed !== undefined) {
            updateData.extractionFallbackUsed = args.extractionFallbackUsed;
        }
        if (args.extractionReplacementReason !== undefined) {
            updateData.extractionReplacementReason = args.extractionReplacementReason;
        }
        if (args.extractionArtifactStorageId !== undefined) {
            updateData.extractionArtifactStorageId = args.extractionArtifactStorageId;
        }
        if (args.evidenceIndexStorageId !== undefined) {
            updateData.evidenceIndexStorageId = args.evidenceIndexStorageId;
        }
        if (args.evidenceIndexVersion !== undefined) {
            updateData.evidenceIndexVersion = args.evidenceIndexVersion;
        }
        if (args.evidencePassageCount !== undefined) {
            updateData.evidencePassageCount = args.evidencePassageCount;
        }
        if (args.embeddingsStatus !== undefined) {
            updateData.embeddingsStatus = args.embeddingsStatus;
        }
        if (args.embeddingsVersion !== undefined) {
            updateData.embeddingsVersion = args.embeddingsVersion;
        }
        if (args.embeddedPassageCount !== undefined) {
            updateData.embeddedPassageCount = args.embeddedPassageCount;
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
