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
        backend: v.string(),
        parser: v.optional(v.string()),
        winner: v.optional(v.boolean()),
        baselineBackend: v.optional(v.string()),
        baselineQualityScore: v.optional(v.number()),
        baselineCoverage: v.optional(v.number()),
        comparisonReason: v.optional(v.string()),
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
            backend: args.backend,
            parser: args.parser,
            winner: args.winner,
            baselineBackend: args.baselineBackend,
            baselineQualityScore: args.baselineQualityScore,
            baselineCoverage: args.baselineCoverage,
            comparisonReason: args.comparisonReason,
            artifactStorageId: args.artifactStorageId,
            startedAt: args.startedAt,
            finishedAt: args.finishedAt,
            errorSummary: args.errorSummary,
        });
    },
});

export const markWinningDocumentExtraction = internalMutation({
    args: {
        extractionId: v.id("documentExtractions"),
        winner: v.boolean(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.extractionId, {
            winner: args.winner,
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

export const getLatestWinningDocumentExtraction = internalQuery({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const entries = await ctx.db
            .query("documentExtractions")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .order("desc")
            .take(25);
        return entries.find((entry) => entry.winner !== false) || null;
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
        const questionSetVersion = Date.now();
        await ctx.db.patch(args.topicId, {
            content: args.content,
            assessmentBlueprint: undefined,
            questionSetVersion,
            examReady: false,
            usableMcqCount: 0,
            usableEssayCount: 0,
            examReadyUpdatedAt: questionSetVersion,
        });
        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "topic",
            entityId: args.topicId,
        }).catch(() => undefined);
        return { ok: true };
    },
});
