import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const providerTraceValidator = v.object({
    pass: v.string(),
    status: v.string(),
    latencyMs: v.number(),
    chars: v.number(),
    pageCount: v.number(),
    error: v.optional(v.string()),
});

export const getUploadForExtraction = internalQuery({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.uploadId);
    },
});

export const insertDocumentExtraction = internalMutation({
    args: {
        uploadId: v.id("uploads"),
        version: v.string(),
        status: v.string(),
        qualityScore: v.number(),
        coverage: v.number(),
        providerTrace: v.array(providerTraceValidator),
        artifactStorageId: v.optional(v.id("_storage")),
        startedAt: v.number(),
        finishedAt: v.number(),
        errorSummary: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("documentExtractions", {
            uploadId: args.uploadId,
            version: args.version,
            status: args.status,
            qualityScore: args.qualityScore,
            coverage: args.coverage,
            providerTrace: args.providerTrace,
            artifactStorageId: args.artifactStorageId,
            startedAt: args.startedAt,
            finishedAt: args.finishedAt,
            errorSummary: args.errorSummary,
        });
    },
});

export const listDocumentExtractions = internalQuery({
    args: {
        uploadId: v.id("uploads"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Number.isFinite(Number(args.limit))
            ? Math.max(1, Math.min(50, Math.floor(Number(args.limit))))
            : 10;

        return await ctx.db
            .query("documentExtractions")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .order("desc")
            .take(limit);
    },
});

export const getTopicAttemptState = internalQuery({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const examAttempt = await ctx.db
            .query("examAttempts")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .first();
        const conceptAttempt = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .first();

        return {
            hasAttempts: Boolean(examAttempt || conceptAttempt),
            examAttemptCount: examAttempt ? 1 : 0,
            conceptAttemptCount: conceptAttempt ? 1 : 0,
        };
    },
});

export const patchTopicContent = internalMutation({
    args: {
        topicId: v.id("topics"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.topicId, {
            content: args.content,
        });
        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "topic",
            entityId: args.topicId,
        }).catch(() => undefined);
        return { ok: true };
    },
});
