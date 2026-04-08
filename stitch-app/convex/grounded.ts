import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
    buildGroundedEvidenceIndexFromArtifact,
    GROUNDED_EVIDENCE_INDEX_VERSION,
    type EvidencePassage,
} from "./lib/groundedEvidenceIndex";
import { retrieveGroundedEvidence } from "./lib/groundedRetrieval";
import {
    embedTexts,
    isVoyageEmbeddingsConfigured,
    VOYAGE_EMBEDDINGS_VERSION,
} from "./lib/voyageEmbeddings";
import { isUsableExamQuestion } from "./lib/examSecurity";
import { runDeterministicGroundingCheck } from "./lib/groundedVerifier";
import {
    QUESTION_BANK_BACKGROUND_PROFILE,
    calculateQuestionBankTarget,
    resolveEvidenceRichEssayCap,
    resolveEvidenceRichMcqCap,
} from "./lib/questionBankConfig";

type UploadDoc = {
    _id: Id<"uploads">;
    userId?: string;
    fileName: string;
    status?: string;
    extractionStatus?: string;
    extractionArtifactStorageId?: Id<"_storage">;
    evidenceIndexStorageId?: Id<"_storage">;
    evidencePassageCount?: number;
    embeddingsStatus?: string;
    embeddingsVersion?: string;
    embeddedPassageCount?: number;
    _creationTime?: number;
};

type MaterializedEvidencePassage = {
    userId: string;
    uploadId: Id<"uploads">;
    courseId: Id<"courses">;
    topicId?: Id<"topics">;
    passageId: string;
    page: number;
    startChar: number;
    endChar: number;
    sectionHint: string;
    flags: string[];
    text: string;
    embedding?: number[];
    embeddingModel?: string;
    createdAt: number;
};

const DEFAULT_SWEEP_ESSAY_TARGET = 3;

const buildAuditSummary = (result: any) => ({
    scannedTopicCount: Math.max(0, Math.round(Number(result?.scannedTopicCount || 0))),
    candidateTopicCount: Math.max(0, Math.round(Number(result?.candidateTopicCount || 0))),
    rebasedTopicCount: Math.max(0, Math.round(Number(result?.rebasedTopicCount || 0))),
    scheduledTopicCount: Math.max(0, Math.round(Number(result?.scheduledTopicCount || 0))),
    totalTargetReduction: Math.max(0, Math.round(Number(result?.totalTargetReduction || 0))),
});

const mapRebasedTopicsForAudit = (result: any, format: "mcq" | "essay") =>
    (Array.isArray(result?.rebasedTopics) ? result.rebasedTopics : []).map((topic: any) => ({
        format,
        topicId: topic.topicId,
        topicTitle: String(topic?.topicTitle || "Unknown Topic"),
        currentTarget: Math.max(1, Math.round(Number(topic?.currentTarget || 1))),
        recalculatedTarget: Math.max(1, Math.round(Number(topic?.recalculatedTarget || 1))),
        usableMcqCount: Math.max(0, Math.round(Number(topic?.usableMcqCount || 0))),
        usableEssayCount: Math.max(0, Math.round(Number(topic?.usableEssayCount || 0))),
        fillRatio: Math.max(0, Number(topic?.fillRatio || 0)),
        scheduled: topic?.scheduled === true,
        wordCountTarget: Number.isFinite(Number(topic?.wordCountTarget))
            ? Math.max(1, Math.round(Number(topic.wordCountTarget)))
            : undefined,
        evidenceRichnessCap: Number.isFinite(Number(topic?.evidenceRichnessCap))
            ? Math.max(1, Math.round(Number(topic.evidenceRichnessCap)))
            : undefined,
        evidenceCapBroadTopicPenaltyApplied: topic?.evidenceCapBroadTopicPenaltyApplied === true,
        retrievedEvidencePassageCount: Number.isFinite(Number(topic?.retrievedEvidencePassageCount))
            ? Math.max(0, Math.round(Number(topic.retrievedEvidencePassageCount)))
            : undefined,
    }));

const toErrorSummary = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

const readJsonFromStorage = async (ctx: any, storageId: Id<"_storage">) => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Storage URL unavailable");
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Storage fetch failed: ${response.status}`);
    }
    return await response.json();
};

const writeJsonToStorage = async (ctx: any, value: unknown): Promise<Id<"_storage">> => {
    const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
    return await ctx.storage.store(blob);
};

const hasCurrentGroundedEvidenceIndex = (upload: any, index: any) => {
    const storedVersion = String(index?.version || "").trim();
    const uploadVersion = String(upload?.evidenceIndexVersion || "").trim();
    if (storedVersion !== GROUNDED_EVIDENCE_INDEX_VERSION) {
        return false;
    }
    return !uploadVersion || uploadVersion === GROUNDED_EVIDENCE_INDEX_VERSION;
};

const countWords = (value: unknown) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

const extractNumericTokens = (value: unknown) =>
    Array.from(
        new Set(
            String(value || "")
                .match(/\b\d+(?:\.\d+)?%?\b/g)
                ?.map((token) => token.trim()) || []
        )
    );

const computePassageHitMetrics = (args: {
    targetPassageIds: string[];
    retrievedPassageIds: string[];
}) => {
    const targetSet = new Set(
        (Array.isArray(args.targetPassageIds) ? args.targetPassageIds : [])
            .map((entry) => String(entry || "").trim())
            .filter(Boolean)
    );
    const retrieved = (Array.isArray(args.retrievedPassageIds) ? args.retrievedPassageIds : [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    const retrievedSet = new Set(retrieved);
    const matchedCount = Array.from(targetSet).filter((passageId) => retrievedSet.has(passageId)).length;

    return {
        targetCount: targetSet.size,
        top1Hit: retrieved.length > 0 && targetSet.has(retrieved[0]),
        top3Hit: retrieved.slice(0, 3).some((passageId) => targetSet.has(passageId)),
        recallAtK: targetSet.size > 0 ? matchedCount / targetSet.size : 0,
        matchedCount,
    };
};

const classifyBenchmarkDelta = (args: {
    lexical: ReturnType<typeof computePassageHitMetrics>;
    hybrid: ReturnType<typeof computePassageHitMetrics>;
}) => {
    const lexicalScore =
        args.lexical.recallAtK
        + (args.lexical.top3Hit ? 0.05 : 0)
        + (args.lexical.top1Hit ? 0.1 : 0);
    const hybridScore =
        args.hybrid.recallAtK
        + (args.hybrid.top3Hit ? 0.05 : 0)
        + (args.hybrid.top1Hit ? 0.1 : 0);

    if (hybridScore > lexicalScore + 1e-9) return "improved";
    if (hybridScore + 1e-9 < lexicalScore) return "worsened";
    return "unchanged";
};

const toRate = (numerator: number, denominator: number) =>
    denominator > 0 ? numerator / denominator : 0;

const average = (values: number[]) =>
    values.length > 0
        ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
        : 0;

const loadRecentTopicsForBenchmark = async (ctx: any, limit: number) => {
    const collected: any[] = [];
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone && collected.length < limit) {
        const batchSize = Math.max(1, Math.min(100, limit - collected.length));
        const page = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
            paginationOpts: {
                numItems: batchSize,
                cursor,
            },
        });
        const pageItems = Array.isArray(page?.page) ? page.page : [];
        collected.push(...pageItems);
        isDone = page?.isDone === true || !page?.continueCursor;
        cursor = page?.continueCursor || null;
    }

    return collected.slice(0, limit);
};

const loadSelectedTopicsForBenchmark = async (ctx: any, args: {
    limit: number;
    topicIds?: Id<"topics">[];
}) => {
    const requestedTopicIds = Array.isArray(args.topicIds)
        ? args.topicIds.filter(Boolean)
        : [];
    if (requestedTopicIds.length === 0) {
        return await loadRecentTopicsForBenchmark(ctx, args.limit);
    }

    const collected: any[] = [];
    for (const topicId of requestedTopicIds.slice(0, args.limit)) {
        const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
            topicId,
        });
        if (topic) {
            collected.push(topic);
        }
    }
    return collected;
};

const EVIDENCE_EMBEDDING_BATCH_SIZE = 16;
const EVIDENCE_PASSAGE_WRITE_BATCH_SIZE = 30;

const normalizePassageText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();

const chunkArray = <T>(items: T[], size: number) => {
    const normalizedSize = Math.max(1, Math.floor(Number(size || 1)));
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += normalizedSize) {
        chunks.push(items.slice(index, index + normalizedSize));
    }
    return chunks;
};

const buildMaterializedEvidenceRows = async (args: {
    upload: UploadDoc;
    courseId: Id<"courses">;
    passages: EvidencePassage[];
}) => {
    const createdAt = Date.now();
    const normalizedPassages = (Array.isArray(args.passages) ? args.passages : [])
        .map((passage) => ({
            passageId: String(passage?.passageId || "").trim(),
            page: Math.max(0, Math.floor(Number(passage?.page || 0))),
            startChar: Math.max(0, Math.floor(Number(passage?.startChar || 0))),
            endChar: Math.max(0, Math.floor(Number(passage?.endChar || 0))),
            sectionHint: String(passage?.sectionHint || "").trim(),
            flags: Array.isArray(passage?.flags)
                ? passage.flags.map((flag) => String(flag || "").trim()).filter(Boolean)
                : [],
            text: normalizePassageText(String(passage?.text || "")),
        }))
        .filter((passage) => passage.passageId && passage.text);

    const baseRows: MaterializedEvidencePassage[] = normalizedPassages.map((passage) => ({
        userId: String(args.upload.userId || "").trim(),
        uploadId: args.upload._id,
        courseId: args.courseId,
        topicId: undefined,
        passageId: passage.passageId,
        page: passage.page,
        startChar: passage.startChar,
        endChar: Math.max(passage.startChar, passage.endChar),
        sectionHint: passage.sectionHint,
        flags: passage.flags,
        text: passage.text,
        createdAt,
    }));

    if (baseRows.length === 0) {
        return {
            rows: [] as MaterializedEvidencePassage[],
            embeddingsStatus: "ready",
            embeddingModel: VOYAGE_EMBEDDINGS_VERSION,
            embeddedPassageCount: 0,
        };
    }

    if (!isVoyageEmbeddingsConfigured()) {
        return {
            rows: baseRows,
            embeddingsStatus: "pending",
            embeddingModel: VOYAGE_EMBEDDINGS_VERSION,
            embeddedPassageCount: 0,
        };
    }

    try {
        const embeddingResult = await embedTexts(
            baseRows.map((row) => [row.sectionHint, row.text].filter(Boolean).join("\n\n")),
            {
                batchSize: EVIDENCE_EMBEDDING_BATCH_SIZE,
                inputType: "document",
            }
        );

        const rowsWithEmbeddings = baseRows.map((row, index) => ({
            ...row,
            embedding: embeddingResult.embeddings[index],
            embeddingModel: embeddingResult.model,
        }));

        return {
            rows: rowsWithEmbeddings,
            embeddingsStatus: "ready",
            embeddingModel: embeddingResult.model,
            embeddedPassageCount: rowsWithEmbeddings.filter((row) => Array.isArray(row.embedding)).length,
        };
    } catch (error) {
        console.warn("[Grounded] evidence_embedding_materialization_failed", {
            uploadId: String(args.upload._id),
            fileName: String(args.upload.fileName || ""),
            message: toErrorSummary(error),
        });
        return {
            rows: baseRows,
            embeddingsStatus: "failed",
            embeddingModel: VOYAGE_EMBEDDINGS_VERSION,
            embeddedPassageCount: 0,
        };
    }
};

const loadGroundedEvidenceIndexForTopicSweep = async (ctx: any, topic: any) => {
    if (!topic?.courseId) {
        return { index: null, upload: null };
    }

    const course = await ctx.runQuery(api.courses.getCourseWithTopics, {
        courseId: topic.courseId,
    });
    const uploadId = course?.uploadId;
    if (!uploadId) {
        return { index: null, upload: null };
    }

    const upload = await ctx.runQuery((internal as any).grounded.getUploadForGrounded, {
        uploadId,
    }) as UploadDoc | null;
    if (!upload) {
        return { index: null, upload: null };
    }

    if (upload.evidenceIndexStorageId) {
        try {
            const stored = await readJsonFromStorage(ctx, upload.evidenceIndexStorageId);
            if (
                stored
                && Array.isArray((stored as any)?.passages)
                && hasCurrentGroundedEvidenceIndex(upload, stored)
            ) {
                return { index: stored, upload };
            }
        } catch {
            // Fall through to extraction artifact rebuild.
        }
    }

    if (upload.extractionArtifactStorageId) {
        try {
            const artifact = await readJsonFromStorage(ctx, upload.extractionArtifactStorageId);
            if (artifact && Array.isArray((artifact as any)?.pages)) {
                void ctx.scheduler.runAfter(0, (internal as any).grounded.buildEvidenceIndex, {
                    uploadId: upload._id,
                    artifactStorageId: upload.extractionArtifactStorageId,
                }).catch(() => { });
                return {
                    index: buildGroundedEvidenceIndexFromArtifact({
                        artifact,
                        uploadId: String(upload._id || ""),
                    }),
                    upload,
                };
            }
        } catch {
            return { index: null, upload };
        }
    }

    return { index: null, upload };
};

const resolveMcqTargetForSweep = async (ctx: any, topic: any) => {
    const { index, upload } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
    if (!index) return null;

    const retrieval = await retrieveGroundedEvidence({
        ctx,
        index,
        query: [
            String(topic?.title || ""),
            String(topic?.description || ""),
        ].join(" "),
        limit: 18,
        preferFlags: ["table"],
        uploadId: upload?._id,
        embeddingBacklogCount: Math.max(
            0,
            Number(upload?.evidencePassageCount || 0) - Number(upload?.embeddedPassageCount || 0)
        ),
    });
    const evidence = retrieval.evidence;
    if (evidence.length === 0) return null;

    const wordCountTarget = calculateQuestionBankTarget({
        wordCount: countWords(topic?.content),
        minTarget: QUESTION_BANK_BACKGROUND_PROFILE.minTarget,
        maxTarget: QUESTION_BANK_BACKGROUND_PROFILE.maxTarget,
        wordDivisor: QUESTION_BANK_BACKGROUND_PROFILE.wordDivisor,
    });
    const evidenceCapResolution = resolveEvidenceRichMcqCap({
        evidence,
        topicTitle: String(topic?.title || ""),
        topicDescription: String(topic?.description || ""),
        sourcePassageIds: Array.isArray(topic?.sourcePassageIds) ? topic.sourcePassageIds : [],
        minTarget: 1,
        maxTarget: wordCountTarget,
    });

    return {
        targetCount: Math.min(wordCountTarget, evidenceCapResolution.cap),
        wordCountTarget,
        evidenceRichnessCap: evidenceCapResolution.cap,
        evidenceCapEstimatedCapacity: evidenceCapResolution.estimatedCapacity,
        evidenceCapPassageDrivenCap: evidenceCapResolution.passageDrivenCap,
        evidenceCapBroadTopicPenaltyApplied: evidenceCapResolution.broadTopicPenaltyApplied,
        evidenceCapUniquePassageCount: evidenceCapResolution.uniquePassageCount,
        retrievedEvidenceCount: evidence.length,
        retrievedEvidencePassageCount: new Set(
            evidence.map((entry: any) => String(entry?.passageId || "").trim()).filter(Boolean)
        ).size,
    };
};

const resolveEssayTargetForSweep = async (ctx: any, topic: any) => {
    const { index, upload } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
    if (!index) return null;

    const retrieval = await retrieveGroundedEvidence({
        ctx,
        index,
        query: [
            String(topic?.title || ""),
            String(topic?.description || ""),
        ].join(" "),
        limit: 24,
        preferFlags: ["table", "formula"],
        uploadId: upload?._id,
        embeddingBacklogCount: Math.max(
            0,
            Number(upload?.evidencePassageCount || 0) - Number(upload?.embeddedPassageCount || 0)
        ),
    });
    const evidence = retrieval.evidence;
    if (evidence.length === 0) return null;

    const wordCountTarget = calculateQuestionBankTarget({
        wordCount: countWords(topic?.content),
        minTarget: 1,
        maxTarget: 6,
        wordDivisor: 220,
    });
    const evidenceCapResolution = resolveEvidenceRichEssayCap({
        evidence,
        topicTitle: String(topic?.title || ""),
        topicDescription: String(topic?.description || ""),
        sourcePassageIds: Array.isArray(topic?.sourcePassageIds) ? topic.sourcePassageIds : [],
        minTarget: 1,
        maxTarget: wordCountTarget,
    });

    return {
        targetCount: Math.min(wordCountTarget, evidenceCapResolution.cap),
        wordCountTarget,
        evidenceRichnessCap: evidenceCapResolution.cap,
        evidenceCapEstimatedCapacity: evidenceCapResolution.estimatedCapacity,
        evidenceCapPassageDrivenCap: evidenceCapResolution.passageDrivenCap,
        evidenceCapBroadTopicPenaltyApplied: evidenceCapResolution.broadTopicPenaltyApplied,
        evidenceCapUniquePassageCount: evidenceCapResolution.uniquePassageCount,
        retrievedEvidenceCount: evidence.length,
        retrievedEvidencePassageCount: new Set(
            evidence.map((entry: any) => String(entry?.passageId || "").trim()).filter(Boolean)
        ).size,
    };
};

export const insertUploadEvidenceIndexRecord = internalMutation({
    args: {
        uploadId: v.id("uploads"),
        version: v.string(),
        storageId: v.id("_storage"),
        passageCount: v.number(),
        status: v.string(),
        errorSummary: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("uploadEvidenceIndexes", {
            uploadId: args.uploadId,
            version: args.version,
            storageId: args.storageId,
            passageCount: args.passageCount,
            status: args.status,
            errorSummary: args.errorSummary,
            createdAt: Date.now(),
        });
    },
});

export const listUploadEvidenceIndexes = internalQuery({
    args: {
        uploadId: v.id("uploads"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 20))));
        return await ctx.db
            .query("uploadEvidenceIndexes")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .order("desc")
            .take(limit);
    },
});

export const getUploadForGrounded = internalQuery({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.uploadId);
    },
});

export const getUploadMaterializationContext = internalQuery({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const upload = await ctx.db.get(args.uploadId);
        if (!upload) return null;

        const course = await ctx.db
            .query("courses")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .first();

        return {
            upload,
            courseId: course?._id || null,
            courseUserId: course?.userId || upload.userId || null,
        };
    },
});

export const clearEvidencePassagesForUpload = internalMutation({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("evidencePassages")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .collect();
        for (const row of existing) {
            await ctx.db.delete(row._id);
        }
        return {
            uploadId: args.uploadId,
            deletedCount: existing.length,
        };
    },
});

export const insertEvidencePassageBatch = internalMutation({
    args: {
        rows: v.array(v.object({
            userId: v.string(),
            uploadId: v.id("uploads"),
            courseId: v.id("courses"),
            topicId: v.optional(v.id("topics")),
            passageId: v.string(),
            page: v.number(),
            startChar: v.number(),
            endChar: v.number(),
            sectionHint: v.string(),
            flags: v.array(v.string()),
            text: v.string(),
            embedding: v.optional(v.array(v.float64())),
            embeddingModel: v.optional(v.string()),
            createdAt: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        for (const row of args.rows) {
            await ctx.db.insert("evidencePassages", row);
        }
        return {
            uploadId: args.rows[0]?.uploadId || null,
            insertedCount: args.rows.length,
        };
    },
});

export const getEvidencePassagesByIds = internalQuery({
    args: {
        ids: v.array(v.id("evidencePassages")),
    },
    handler: async (ctx, args) => {
        const rows = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
        return rows.filter(Boolean);
    },
});

export const listBackfillUploads = internalQuery({
    args: {
        days: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const days = Math.max(1, Math.min(120, Math.floor(Number(args.days || 30))));
        const limit = Math.max(1, Math.min(10_000, Math.floor(Number(args.limit || 1_000))));
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        const uploads = await ctx.db
            .query("uploads")
            .order("desc")
            .take(limit * 3);

        return uploads
            .filter((upload: any) => Number(upload._creationTime || 0) >= cutoff)
            .filter((upload: any) => ["ready", "processing"].includes(String(upload.status || "")))
            .slice(0, limit);
    },
});

export const listCoursesByUpload = internalQuery({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const direct = await ctx.db
            .query("courses")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .collect();
        if (direct.length > 0) return direct;

        const courses = await ctx.db
            .query("courses")
            .order("desc")
            .take(2000);
        return courses.filter((course: any) => String(course.uploadId || "") === String(args.uploadId));
    },
});

export const listTopicsForSweep = internalQuery({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("topics")
            .order("desc")
            .paginate(args.paginationOpts);
    },
});

export const insertQuestionTargetAuditRunInternal = internalMutation({
    args: {
        dryRun: v.boolean(),
        startedAt: v.number(),
        finishedAt: v.number(),
        staleHours: v.number(),
        maxTopicsPerFormat: v.number(),
        mcqSummary: v.object({
            scannedTopicCount: v.number(),
            candidateTopicCount: v.number(),
            rebasedTopicCount: v.number(),
            scheduledTopicCount: v.number(),
            totalTargetReduction: v.number(),
        }),
        essaySummary: v.object({
            scannedTopicCount: v.number(),
            candidateTopicCount: v.number(),
            rebasedTopicCount: v.number(),
            scheduledTopicCount: v.number(),
            totalTargetReduction: v.number(),
        }),
        rebasedTopics: v.array(v.object({
            format: v.string(),
            topicId: v.id("topics"),
            topicTitle: v.string(),
            currentTarget: v.number(),
            recalculatedTarget: v.number(),
            usableMcqCount: v.number(),
            usableEssayCount: v.number(),
            fillRatio: v.number(),
            scheduled: v.boolean(),
            wordCountTarget: v.optional(v.number()),
            evidenceRichnessCap: v.optional(v.number()),
            evidenceCapBroadTopicPenaltyApplied: v.optional(v.boolean()),
            retrievedEvidencePassageCount: v.optional(v.number()),
        })),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("questionTargetAuditRuns", args);
    },
});

export const getLatestQuestionTargetAuditDiagnostics = internalQuery({
    args: {
        includeDryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const includeDryRun = args.includeDryRun === true;
        const recentRuns = await ctx.db
            .query("questionTargetAuditRuns")
            .withIndex("by_finishedAt")
            .order("desc")
            .take(10);

        const latest =
            recentRuns.find((run: any) => includeDryRun || run?.dryRun !== true)
            || recentRuns[0]
            || null;
        if (!latest) return null;

        return {
            ...latest,
            totalRebasedTopics: Array.isArray(latest?.rebasedTopics) ? latest.rebasedTopics.length : 0,
        };
    },
});

export const materializeEvidencePassagesForUpload = internalAction({
    args: {
        uploadId: v.id("uploads"),
        evidenceIndexStorageId: v.optional(v.id("_storage")),
        artifactStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        const materializationContext = await ctx.runQuery(
            (internal as any).grounded.getUploadMaterializationContext,
            { uploadId: args.uploadId }
        ) as {
            upload: UploadDoc | null;
            courseId: Id<"courses"> | null;
            courseUserId: string | null;
        } | null;

        const upload = materializationContext?.upload || null;
        if (!upload) {
            throw new Error("Upload not found for evidence passage materialization");
        }

        const courseId = materializationContext?.courseId || null;
        if (!courseId) {
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId: args.uploadId,
                status: String(upload.status || "processing"),
                embeddingsStatus: "pending",
                embeddingsVersion: VOYAGE_EMBEDDINGS_VERSION,
                embeddedPassageCount: 0,
            });
            return {
                uploadId: args.uploadId,
                skipped: true,
                reason: "course_not_found",
                insertedCount: 0,
                embeddedPassageCount: 0,
            };
        }

        let index: any = null;
        const candidateIndexStorageId = args.evidenceIndexStorageId || upload.evidenceIndexStorageId;
        const candidateArtifactStorageId = args.artifactStorageId || upload.extractionArtifactStorageId;

        if (candidateIndexStorageId) {
            try {
                const storedIndex = await readJsonFromStorage(ctx, candidateIndexStorageId);
                if (storedIndex && Array.isArray((storedIndex as any)?.passages)) {
                    index = storedIndex;
                }
            } catch {
                index = null;
            }
        }

        if (!index && candidateArtifactStorageId) {
            const artifact = await readJsonFromStorage(ctx, candidateArtifactStorageId);
            index = buildGroundedEvidenceIndexFromArtifact({
                artifact,
                uploadId: String(args.uploadId),
            });
        }

        if (!index || !Array.isArray(index?.passages)) {
            throw new Error("Evidence index unavailable for evidence passage materialization");
        }

        await ctx.runMutation(api.uploads.updateUploadStatus, {
            uploadId: args.uploadId,
            status: String(upload.status || "processing"),
            embeddingsStatus: "running",
            embeddingsVersion: VOYAGE_EMBEDDINGS_VERSION,
        });

        const materialized = await buildMaterializedEvidenceRows({
            upload,
            courseId,
            passages: index.passages,
        });

        const rowChunks = chunkArray(materialized.rows, EVIDENCE_PASSAGE_WRITE_BATCH_SIZE);
        await ctx.runMutation((internal as any).grounded.clearEvidencePassagesForUpload, {
            uploadId: args.uploadId,
        });
        for (const rowChunk of rowChunks) {
            await ctx.runMutation((internal as any).grounded.insertEvidencePassageBatch, {
                rows: rowChunk,
            });
        }

        await ctx.runMutation(api.uploads.updateUploadStatus, {
            uploadId: args.uploadId,
            status: String(upload.status || "processing"),
            embeddingsStatus: materialized.embeddingsStatus,
            embeddingsVersion: materialized.embeddingModel || VOYAGE_EMBEDDINGS_VERSION,
            embeddedPassageCount: materialized.embeddedPassageCount,
            evidencePassageCount: materialized.rows.length,
        });

        return {
            uploadId: args.uploadId,
            skipped: false,
            insertedCount: materialized.rows.length,
            embeddedPassageCount: materialized.embeddedPassageCount,
            embeddingsStatus: materialized.embeddingsStatus,
            embeddingModel: materialized.embeddingModel || VOYAGE_EMBEDDINGS_VERSION,
        };
    },
});

export const buildEvidenceIndex = internalAction({
    args: {
        uploadId: v.id("uploads"),
        artifactStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        const upload = await ctx.runQuery((internal as any).grounded.getUploadForGrounded, {
            uploadId: args.uploadId,
        }) as UploadDoc | null;
        if (!upload) {
            throw new Error("Upload not found");
        }

        const artifactStorageId = args.artifactStorageId || upload.extractionArtifactStorageId;
        if (!artifactStorageId) {
            throw new Error("Extraction artifact missing for evidence indexing");
        }

        try {
            const artifact = await readJsonFromStorage(ctx, artifactStorageId);
            const index = buildGroundedEvidenceIndexFromArtifact({
                artifact,
                uploadId: String(args.uploadId),
            });
            const storageId = await writeJsonToStorage(ctx, index);
            const materialization = await ctx.runAction(
                (internal as any).grounded.materializeEvidencePassagesForUpload,
                {
                    uploadId: args.uploadId,
                    evidenceIndexStorageId: storageId,
                    artifactStorageId,
                }
            );

            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId: args.uploadId,
                status: String(upload.status || "processing"),
                evidenceIndexStorageId: storageId,
                evidenceIndexVersion: index.version,
                evidencePassageCount: index.passageCount,
                embeddingsStatus: materialization?.embeddingsStatus,
                embeddingsVersion: materialization?.embeddingModel || VOYAGE_EMBEDDINGS_VERSION,
                embeddedPassageCount: Number(materialization?.embeddedPassageCount || 0),
            });

            await ctx.runMutation((internal as any).grounded.insertUploadEvidenceIndexRecord, {
                uploadId: args.uploadId,
                version: index.version,
                storageId,
                passageCount: index.passageCount,
                status: "ready",
            });

            return {
                uploadId: args.uploadId,
                storageId,
                version: index.version,
                passageCount: index.passageCount,
                embeddedPassageCount: Number(materialization?.embeddedPassageCount || 0),
                embeddingsStatus: materialization?.embeddingsStatus || "pending",
            };
        } catch (error) {
            await ctx.runMutation((internal as any).grounded.insertUploadEvidenceIndexRecord, {
                uploadId: args.uploadId,
                version: GROUNDED_EVIDENCE_INDEX_VERSION,
                storageId: artifactStorageId,
                passageCount: 0,
                status: "failed",
                errorSummary: toErrorSummary(error),
            });
            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId: args.uploadId,
                status: String(upload.status || "processing"),
                embeddingsStatus: "failed",
                embeddingsVersion: VOYAGE_EMBEDDINGS_VERSION,
                embeddedPassageCount: 0,
            });
            throw error;
        }
    },
});

export const generateGroundedMcqForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        return await ctx.runAction((internal as any).ai.generateQuestionsForTopicInternal, {
            topicId: args.topicId,
        });
    },
});

export const scheduleGroundedMcqForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, (internal as any).ai.retryAssessmentGapFillInternal, {
            topicId: args.topicId,
            allowObjective: true,
            allowEssay: false,
            reason: "schedule_grounded_mcq",
        });
        return {
            scheduled: true,
            topicId: args.topicId,
        };
    },
});

export const generateGroundedEssayForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
        count: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.runAction((internal as any).ai.generateEssayQuestionsForTopicInternal, {
            topicId: args.topicId,
            count: args.count,
        });
    },
});

export const scheduleGroundedEssayForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
        count: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await ctx.scheduler.runAfter(0, (internal as any).ai.retryAssessmentGapFillInternal, {
            topicId: args.topicId,
            allowObjective: false,
            allowEssay: true,
            requestedEssayCount: args.count,
            reason: "schedule_grounded_essay",
        });
        return {
            scheduled: true,
            topicId: args.topicId,
            count: args.count,
        };
    },
});

export const generateGroundedConceptForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
        userId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (typeof args.userId === "string" && args.userId.trim()) {
            return await ctx.runAction((internal as any).ai.generateConceptExerciseForTopicInternal, {
                topicId: args.topicId,
                userId: args.userId.trim(),
            });
        }
        return {
            skipped: true,
            reason: "userId_required_for_concept_generation",
        };
    },
});

export const backfillEvidencePassages = internalAction({
    args: {
        days: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const uploads = await ctx.runQuery((internal as any).grounded.listBackfillUploads, {
            days: args.days,
            limit: args.limit,
        }) as UploadDoc[];

        const scheduledUploads: string[] = [];
        for (const upload of uploads) {
            if (upload.evidenceIndexStorageId) {
                await ctx.scheduler.runAfter(0, (internal as any).grounded.materializeEvidencePassagesForUpload, {
                    uploadId: upload._id,
                    evidenceIndexStorageId: upload.evidenceIndexStorageId,
                    artifactStorageId: upload.extractionArtifactStorageId,
                });
                scheduledUploads.push(String(upload._id));
                continue;
            }

            if (upload.extractionArtifactStorageId) {
                await ctx.scheduler.runAfter(0, (internal as any).grounded.buildEvidenceIndex, {
                    uploadId: upload._id,
                    artifactStorageId: upload.extractionArtifactStorageId,
                });
                scheduledUploads.push(String(upload._id));
            }
        }

        return {
            days: args.days,
            limit: args.limit,
            scannedCount: uploads.length,
            scheduledCount: scheduledUploads.length,
            scheduledUploadIds: scheduledUploads,
        };
    },
});

export const runGroundedBackfillSweep = internalAction({
    args: {
        days: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const uploads = await ctx.runQuery((internal as any).grounded.listBackfillUploads, {
            days: args.days,
            limit: args.limit,
        }) as UploadDoc[];

        let scheduledUploads = 0;
        let scheduledTopics = 0;

        for (const upload of uploads) {
            const courses = await ctx.runQuery((internal as any).grounded.listCoursesByUpload, {
                uploadId: upload._id,
            });
            if (!Array.isArray(courses) || courses.length === 0) continue;

            const effectiveArtifactStorageId = upload.extractionArtifactStorageId;
            if (effectiveArtifactStorageId) {
                await ctx.scheduler.runAfter(0, (internal as any).grounded.buildEvidenceIndex, {
                    uploadId: upload._id,
                    artifactStorageId: effectiveArtifactStorageId,
                });
            }

            for (const course of courses) {
                const courseWithTopics = await ctx.runQuery(api.courses.getCourseWithTopics, {
                    courseId: course._id,
                });
                const topics = Array.isArray(courseWithTopics?.topics) ? courseWithTopics.topics : [];
                for (const topic of topics) {
                    await ctx.scheduler.runAfter(0, (internal as any).grounded.generateGroundedMcqForTopic, {
                        topicId: topic._id,
                    });
                    await ctx.scheduler.runAfter(0, (internal as any).grounded.generateGroundedEssayForTopic, {
                        topicId: topic._id,
                        count: 15,
                    });
                    scheduledTopics += 1;
                }

                if (String(upload.extractionStatus || "") === "provisional") {
                    await ctx.scheduler.runAfter(0, internal.extraction.runBackgroundReprocess, {
                        uploadId: upload._id,
                        courseId: course._id,
                    });
                }
            }

            scheduledUploads += 1;
        }

        return {
            scannedUploads: uploads.length,
            scheduledUploads,
            scheduledTopics,
        };
    },
});

const NUMERIC_MCQ_SIGNAL_PATTERN =
    /(?:%|percent|percentage|rate|ratio|target|limit|threshold|minimum|maximum|at least|at most|how many|how much|count|number of|per week|per day|per month|weekly|daily|monthly|increase|decrease)/i;

const getStoredMcqQuestions = (rawQuestions: any[]) =>
    (Array.isArray(rawQuestions) ? rawQuestions : [])
        .filter((question: any) => String(question?.questionType || "") !== "essay");

const getStoredEssayQuestions = (rawQuestions: any[]) =>
    (Array.isArray(rawQuestions) ? rawQuestions : [])
        .filter((question: any) => String(question?.questionType || "") === "essay");

const resolveStoredCorrectOption = (question: any) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    const storedCorrectLabel = String(question?.correctAnswer || "").trim().toUpperCase();
    return options.find((option: any) => option?.isCorrect === true)
        || options.find((option: any) => String(option?.label || "").trim().toUpperCase() === storedCorrectLabel)
        || null;
};

const buildSyntheticEvidenceIndexFromCitations = (question: any) => {
    const citations = Array.isArray(question?.citations) ? question.citations : [];
    const passages = citations
        .map((citation: any, index: number) => {
            const quote = String(citation?.quote || "").trim();
            if (!quote) return null;
            const passageId = String(citation?.passageId || "").trim() || `citation-${index}`;
            const page = Number.isFinite(Number(citation?.page))
                ? Math.max(0, Math.floor(Number(citation.page)))
                : 0;
            return {
                passageId,
                page,
                startChar: 0,
                endChar: quote.length,
                sectionHint: "",
                text: quote,
                flags: [] as string[],
            };
        })
        .filter(Boolean);

    return {
        version: "grounded-sweep-v1",
        createdAt: Date.now(),
        passageCount: passages.length,
        pageCount: new Set(passages.map((passage: any) => passage.page)).size,
        passages,
    };
};

const inspectStoredMcqGrounding = (question: any) => {
    const correctOption = resolveStoredCorrectOption(question);
    const correctOptionText = String(correctOption?.text || "").trim();
    const citations = Array.isArray(question?.citations) ? question.citations : [];
    const numericCandidateText = [
        String(question?.questionText || ""),
        correctOptionText,
        ...citations.map((citation: any) => String(citation?.quote || "")),
    ].join(" ");
    const isNumericCandidate = NUMERIC_MCQ_SIGNAL_PATTERN.test(numericCandidateText);
    if (!isNumericCandidate) {
        return {
            correctOptionText,
            citations,
            deterministicPass: true,
            isNumericCandidate: false,
            reasons: [] as string[],
        };
    }

    const evidenceIndex = buildSyntheticEvidenceIndexFromCitations(question);
    const deterministic = runDeterministicGroundingCheck({
        type: "mcq",
        candidate: {
            questionText: question?.questionText,
            options: Array.isArray(question?.options) ? question.options : [],
            citations,
        },
        evidenceIndex,
    });
    const reasons = Array.isArray(deterministic.reasons)
        ? deterministic.reasons.filter(Boolean)
        : [];

    return {
        correctOptionText,
        citations,
        deterministicPass: deterministic.deterministicPass,
        isNumericCandidate: true,
        reasons,
    };
};

export const summarizeTopicUpdateBuckets = internalAction({
    args: {
        fromTs: v.optional(v.number()),
        toTs: v.optional(v.number()),
        bucketMs: v.optional(v.number()),
        limit: v.optional(v.number()),
        sampleLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 20))));
        const bucketMs = Math.max(1_000, Math.min(60 * 60 * 1000, Math.floor(Number(args.bucketMs || 60_000))));
        const fromTs = Number(args.fromTs || 0);
        const toTs = Number(args.toTs || Date.now());
        const bucketCounts = new Map<number, number>();
        const sampleTopics: any[] = [];
        let scannedTopicCount = 0;
        let candidateTopicCount = 0;
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) {
                    break;
                }

                const updatedAt = Number(topic?.examReadyUpdatedAt || 0);
                if (!updatedAt || updatedAt < fromTs || updatedAt > toTs) {
                    continue;
                }

                candidateTopicCount += 1;
                const bucketStart = Math.floor(updatedAt / bucketMs) * bucketMs;
                bucketCounts.set(bucketStart, (bucketCounts.get(bucketStart) || 0) + 1);

                if (sampleTopics.length < sampleLimit) {
                    sampleTopics.push({
                        topicId: topic._id,
                        topicTitle: String(topic?.title || "Unknown Topic"),
                        examReadyUpdatedAt: updatedAt,
                        usableMcqCount: Number(topic?.usableMcqCount || 0),
                        usableEssayCount: Number(topic?.usableEssayCount || 0),
                    });
                }
            }
        }

        const buckets = Array.from(bucketCounts.entries())
            .map(([bucketStart, count]) => ({
                bucketStart,
                bucketEnd: bucketStart + bucketMs - 1,
                count,
            }))
            .sort((left, right) => left.bucketStart - right.bucketStart);

        return {
            scannedTopicCount,
            candidateTopicCount,
            fromTs,
            toTs,
            bucketMs,
            buckets,
            sampleTopics,
        };
    },
});

export const auditMcqRefillForUpdatedTopicsWindow = internalAction({
    args: {
        fromTs: v.number(),
        toTs: v.number(),
        rebuildFromTs: v.optional(v.number()),
        rebuildToTs: v.optional(v.number()),
        topicCreatedBeforeTs: v.optional(v.number()),
        limit: v.optional(v.number()),
        minVerifiedMcqs: v.optional(v.number()),
        sampleLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const minVerifiedMcqs = Math.max(1, Math.min(50, Math.floor(Number(args.minVerifiedMcqs || 7))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 20))));
        const fromTs = Number(args.fromTs);
        const toTs = Number(args.toTs);
        const rebuildFromTs = Number(args.rebuildFromTs || 0);
        const rebuildToTs = Number(args.rebuildToTs || 0);
        const topicCreatedBeforeTs = Number(args.topicCreatedBeforeTs || toTs);
        let scannedTopicCount = 0;
        let candidateTopicCount = 0;
        let updatedWindowTopicCount = 0;
        let rebuildWindowTopicCount = 0;
        let anyVerifiedMcqCount = 0;
        let fullyRefilledCount = 0;
        let partialRefillCount = 0;
        let zeroMcqCount = 0;
        let zeroVerifiedMcqCount = 0;
        let lockedCount = 0;
        let totalRawMcqCount = 0;
        let totalVerifiedMcqCount = 0;
        let numericCandidateCount = 0;
        let remainingNumericMismatchCount = 0;
        let remainingNumericMismatchTopicCount = 0;
        const topicStates: any[] = [];
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) {
                    break;
                }

                const updatedAt = Number(topic?.examReadyUpdatedAt || 0);
                const updatedInWindow = Boolean(updatedAt && updatedAt >= fromTs && updatedAt <= toTs);
                let selectionReason: "updated_window" | "rebuild_window" | "both" | null = null;
                let rawQuestions: any[] = [];
                let mcqQuestions: any[] = [];
                let essayQuestions: any[] = [];
                let newestMcqCreatedAt = 0;

                if (updatedInWindow) {
                    selectionReason = "updated_window";
                    updatedWindowTopicCount += 1;
                    rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                        topicId: topic._id,
                    });
                    mcqQuestions = getStoredMcqQuestions(rawQuestions);
                    essayQuestions = getStoredEssayQuestions(rawQuestions);
                    newestMcqCreatedAt = mcqQuestions.reduce(
                        (maxCreatedAt: number, question: any) =>
                            Math.max(maxCreatedAt, Number(question?._creationTime || 0)),
                        0,
                    );
                } else if (rebuildFromTs > 0 && rebuildToTs > 0 && Number(topic?._creationTime || 0) < topicCreatedBeforeTs) {
                    rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                        topicId: topic._id,
                    });
                    mcqQuestions = getStoredMcqQuestions(rawQuestions);
                    if (mcqQuestions.length === 0) {
                        continue;
                    }
                    essayQuestions = getStoredEssayQuestions(rawQuestions);
                    newestMcqCreatedAt = mcqQuestions.reduce(
                        (maxCreatedAt: number, question: any) =>
                            Math.max(maxCreatedAt, Number(question?._creationTime || 0)),
                        0,
                    );
                    const oldestEssayCreatedAt = essayQuestions.reduce(
                        (minCreatedAt: number, question: any) =>
                            Math.min(minCreatedAt, Number(question?._creationTime || Number.MAX_SAFE_INTEGER)),
                        Number.MAX_SAFE_INTEGER,
                    );
                    const rebuiltInWindow =
                        newestMcqCreatedAt >= rebuildFromTs
                        && newestMcqCreatedAt <= rebuildToTs
                        && oldestEssayCreatedAt < rebuildFromTs;
                    if (!rebuiltInWindow) {
                        continue;
                    }
                    selectionReason = "rebuild_window";
                    rebuildWindowTopicCount += 1;
                } else {
                    continue;
                }

                candidateTopicCount += 1;
                if (mcqQuestions.length === 0 && rawQuestions.length > 0) {
                    mcqQuestions = getStoredMcqQuestions(rawQuestions);
                }
                if (essayQuestions.length === 0 && rawQuestions.length > 0) {
                    essayQuestions = getStoredEssayQuestions(rawQuestions);
                }
                if (newestMcqCreatedAt === 0) {
                    newestMcqCreatedAt = mcqQuestions.reduce(
                        (maxCreatedAt: number, question: any) =>
                            Math.max(maxCreatedAt, Number(question?._creationTime || 0)),
                        0,
                    );
                }
                const verifiedMcqs = mcqQuestions.filter((question: any) =>
                    String(question?.factualityStatus || "") === "verified"
                    && Array.isArray(question?.citations)
                    && question.citations.length > 0);
                const currentlyLocked = Number(topic?.mcqGenerationLockedUntil || 0) > Date.now();
                if (currentlyLocked) {
                    lockedCount += 1;
                }

                totalRawMcqCount += mcqQuestions.length;
                totalVerifiedMcqCount += verifiedMcqs.length;

                if (mcqQuestions.length === 0) {
                    zeroMcqCount += 1;
                }
                if (verifiedMcqs.length === 0) {
                    zeroVerifiedMcqCount += 1;
                } else {
                    anyVerifiedMcqCount += 1;
                    if (verifiedMcqs.length >= minVerifiedMcqs) {
                        fullyRefilledCount += 1;
                    } else {
                        partialRefillCount += 1;
                    }
                }

                let topicNumericMismatchCount = 0;
                for (const question of mcqQuestions) {
                    const inspection = inspectStoredMcqGrounding(question);
                    if (!inspection.isNumericCandidate) {
                        continue;
                    }
                    numericCandidateCount += 1;
                    if (inspection.reasons.includes("correct option unsupported by cited evidence")) {
                        remainingNumericMismatchCount += 1;
                        topicNumericMismatchCount += 1;
                    }
                }
                if (topicNumericMismatchCount > 0) {
                    remainingNumericMismatchTopicCount += 1;
                }

                if (topicStates.length < sampleLimit) {
                    topicStates.push({
                        topicId: topic._id,
                        topicTitle: String(topic?.title || "Unknown Topic"),
                        examReadyUpdatedAt: updatedAt,
                        rawMcqCount: mcqQuestions.length,
                        verifiedMcqCount: verifiedMcqs.length,
                        essayCount: essayQuestions.length,
                        locked: currentlyLocked,
                        numericMismatchCount: topicNumericMismatchCount,
                        newestMcqCreatedAt,
                        selectionReason,
                    });
                }
            }
        }

        return {
            scannedTopicCount,
            candidateTopicCount,
            fromTs,
            toTs,
            rebuildFromTs,
            rebuildToTs,
            topicCreatedBeforeTs,
            minVerifiedMcqs,
            updatedWindowTopicCount,
            rebuildWindowTopicCount,
            anyVerifiedMcqCount,
            fullyRefilledCount,
            partialRefillCount,
            zeroMcqCount,
            zeroVerifiedMcqCount,
            lockedCount,
            totalRawMcqCount,
            totalVerifiedMcqCount,
            numericCandidateCount,
            remainingNumericMismatchCount,
            remainingNumericMismatchTopicCount,
            sampleTopics: topicStates,
        };
    },
});

export const sweepStoredMcqBanksForGroundingMismatches = internalAction({
    args: {
        limit: v.optional(v.number()),
        maxFlags: v.optional(v.number()),
        maxTopics: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const maxFlags = Math.max(1, Math.min(500, Math.floor(Number(args.maxFlags || 200))));
        const maxTopics = Math.max(1, Math.min(500, Math.floor(Number(args.maxTopics || 100))));
        const flaggedQuestions: any[] = [];
        const topicCounts = new Map<string, number>();
        const topicTitles = new Map<string, string>();
        let numericCandidateCount = 0;
        let scannedMcqCount = 0;
        let supportedCount = 0;
        let numericMismatchCount = 0;
        let otherMismatchCount = 0;
        let scannedTopicCount = 0;
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) {
                    break;
                }

                const rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                    topicId: topic._id,
                });
                const mcqQuestions = getStoredMcqQuestions(rawQuestions);
                if (mcqQuestions.length === 0) {
                    continue;
                }

                const topicId = String(topic?._id || "");
                const topicTitle = String(topic?.title || "Unknown Topic");
                topicTitles.set(topicId, topicTitle);

                for (const question of mcqQuestions) {
                    scannedMcqCount += 1;
                    const inspection = inspectStoredMcqGrounding(question);
                    if (!inspection.isNumericCandidate) {
                        continue;
                    }

                    numericCandidateCount += 1;
                    if (inspection.deterministicPass) {
                        supportedCount += 1;
                        continue;
                    }

                    const reasons = inspection.reasons;
                    const isNumericMismatch = reasons.includes("correct option unsupported by cited evidence");
                    if (isNumericMismatch) {
                        numericMismatchCount += 1;
                    } else {
                        otherMismatchCount += 1;
                    }

                    topicCounts.set(topicId, (topicCounts.get(topicId) || 0) + 1);

                    if (flaggedQuestions.length >= maxFlags) {
                        continue;
                    }

                    flaggedQuestions.push({
                        topicId: question?.topicId,
                        topicTitle,
                        questionId: question?._id,
                        questionText: String(question?.questionText || ""),
                        correctOptionText: inspection.correctOptionText,
                        citationQuote: String(inspection.citations[0]?.quote || ""),
                        reasons,
                        numericMismatch: isNumericMismatch,
                    });
                }
            }
        }

        const flaggedTopics = Array.from(topicCounts.entries())
            .map(([topicId, mismatchCount]) => ({
                topicId,
                topicTitle: topicTitles.get(topicId) || "Unknown Topic",
                mismatchCount,
            }))
            .sort((left, right) => right.mismatchCount - left.mismatchCount)
            .slice(0, maxTopics);

        return {
            scannedTopicCount,
            scannedMcqCount,
            numericCandidateCount,
            supportedCount,
            numericMismatchCount,
            otherMismatchCount,
            flaggedTopicCount: flaggedTopics.length,
            flaggedTopics,
            flaggedQuestions,
        };
    },
});

export const remediateStoredMcqGroundingMismatches = internalAction({
    args: {
        limit: v.optional(v.number()),
        maxTopics: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
        sampleLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const maxTopics = Math.max(1, Math.min(1_000, Math.floor(Number(args.maxTopics || 500))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 25))));
        const dryRun = args.dryRun === true;
        const remediationTopics: Array<{
            topicId: Id<"topics">;
            topicTitle: string;
            mismatchCount: number;
            offendingQuestionIds: Id<"questions">[];
        }> = [];
        let scannedTopicCount = 0;
        let scannedMcqCount = 0;
        let numericMismatchCount = 0;
        let cursor: string | null = null;
        let isDone = false;

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) {
                    break;
                }

                const rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                    topicId: topic._id,
                });
                const mcqQuestions = getStoredMcqQuestions(rawQuestions);
                if (mcqQuestions.length === 0) {
                    continue;
                }

                scannedMcqCount += mcqQuestions.length;
                const offendingQuestionIds: Id<"questions">[] = [];

                for (const question of mcqQuestions) {
                    const inspection = inspectStoredMcqGrounding(question);
                    if (!inspection.isNumericCandidate) {
                        continue;
                    }

                    const reasons = inspection.reasons;
                    if (!reasons.includes("correct option unsupported by cited evidence")) {
                        continue;
                    }

                    offendingQuestionIds.push(question._id);
                    numericMismatchCount += 1;
                }

                if (offendingQuestionIds.length === 0) {
                    continue;
                }

                remediationTopics.push({
                    topicId: topic._id,
                    topicTitle: String(topic?.title || "Unknown Topic"),
                    mismatchCount: offendingQuestionIds.length,
                    offendingQuestionIds,
                });
            }
        }

        remediationTopics.sort((left, right) => right.mismatchCount - left.mismatchCount);
        const selectedTopics = remediationTopics.slice(0, maxTopics);

        let remediatedTopicCount = 0;
        let deletedQuestionCount = 0;
        if (!dryRun) {
            for (const topic of selectedTopics) {
                const deletionResult = await ctx.runMutation(internal.topics.deleteObjectiveQuestionsByTopicInternal, {
                    topicId: topic.topicId,
                });
                deletedQuestionCount += Number(deletionResult?.deleted || 0);
                await ctx.scheduler.runAfter(0, (internal as any).grounded.generateGroundedMcqForTopic, {
                    topicId: topic.topicId,
                });
                remediatedTopicCount += 1;
            }
        }

        return {
            dryRun,
            scannedTopicCount,
            scannedMcqCount,
            numericMismatchCount,
            candidateTopicCount: remediationTopics.length,
            remediatedTopicCount,
            deletedQuestionCount,
            scheduledTopicCount: dryRun ? 0 : remediatedTopicCount,
            sampleTopics: selectedTopics.slice(0, sampleLimit).map((topic) => ({
                topicId: topic.topicId,
                topicTitle: topic.topicTitle,
                mismatchCount: topic.mismatchCount,
                offendingQuestionIds: topic.offendingQuestionIds.slice(0, 10),
            })),
        };
    },
});

export const rebaseStaleOversizedMcqTargets = internalAction({
    args: {
        limit: v.optional(v.number()),
        maxTopics: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
        sampleLimit: v.optional(v.number()),
        staleHours: v.optional(v.number()),
        minCurrentTarget: v.optional(v.number()),
        maxFillRatio: v.optional(v.number()),
        includeTopicDetails: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const maxTopics = Math.max(1, Math.min(2_000, Math.floor(Number(args.maxTopics || 500))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 25))));
        const staleHours = Math.max(1, Math.min(24 * 30, Number(args.staleHours || 6)));
        const minCurrentTarget = Math.max(1, Math.min(100, Math.floor(Number(args.minCurrentTarget || 12))));
        const maxFillRatio = Math.max(0, Math.min(1, Number(args.maxFillRatio || 0.6)));
        const dryRun = args.dryRun === true;
        const includeTopicDetails = args.includeTopicDetails === true;
        const staleCutoffTs = Date.now() - staleHours * 60 * 60 * 1000;

        let scannedTopicCount = 0;
        let candidateTopicCount = 0;
        let rebasedTopicCount = 0;
        let scheduledTopicCount = 0;
        let skippedForMissingEvidenceCount = 0;
        let skippedForLockCount = 0;
        let skippedForFreshnessCount = 0;
        let skippedForHealthyFillCount = 0;
        let totalTargetReduction = 0;
        let cursor: string | null = null;
        let isDone = false;
        const candidateTopics: any[] = [];

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) break;

                const currentTarget = Math.max(1, Math.round(Number(topic?.mcqTargetCount || 0)));
                const usableMcqCount = Math.max(0, Math.round(Number(topic?.usableMcqCount || 0)));
                const updatedAt = Number(topic?.examReadyUpdatedAt || topic?._creationTime || 0);
                const currentlyLocked = Number(topic?.mcqGenerationLockedUntil || 0) > Date.now();

                if (currentTarget < minCurrentTarget || usableMcqCount >= currentTarget) {
                    continue;
                }
                if (currentlyLocked) {
                    skippedForLockCount += 1;
                    continue;
                }
                if (updatedAt > staleCutoffTs) {
                    skippedForFreshnessCount += 1;
                    continue;
                }

                const fillRatio = currentTarget > 0 ? usableMcqCount / currentTarget : 1;
                if (usableMcqCount > 0 && fillRatio > maxFillRatio) {
                    skippedForHealthyFillCount += 1;
                    continue;
                }

                const resolution = await resolveMcqTargetForSweep(ctx, topic);
                if (!resolution) {
                    skippedForMissingEvidenceCount += 1;
                    continue;
                }
                if (resolution.targetCount >= currentTarget) {
                    continue;
                }

                candidateTopicCount += 1;
                candidateTopics.push({
                    topicId: topic._id,
                    topicTitle: String(topic?.title || "Unknown Topic"),
                    currentTarget,
                    recalculatedTarget: resolution.targetCount,
                    usableMcqCount,
                    usableEssayCount: Math.max(0, Math.round(Number(topic?.usableEssayCount || 0))),
                    fillRatio,
                    updatedAt,
                    ...resolution,
                });
            }
        }

        candidateTopics.sort((left, right) => {
            const delta = (right.currentTarget - right.recalculatedTarget) - (left.currentTarget - left.recalculatedTarget);
            if (delta !== 0) return delta;
            return left.fillRatio - right.fillRatio;
        });

        const selectedTopics = candidateTopics.slice(0, maxTopics);

        if (!dryRun) {
            for (const topic of selectedTopics) {
                await ctx.runMutation(internal.topics.refreshTopicExamReadinessInternal, {
                    topicId: topic.topicId,
                    objectiveTargetCount: topic.recalculatedTarget,
                });
                rebasedTopicCount += 1;
                totalTargetReduction += Math.max(0, topic.currentTarget - topic.recalculatedTarget);

                if (topic.usableMcqCount < topic.recalculatedTarget) {
                    await ctx.scheduler.runAfter(0, internal.ai.retryAssessmentGapFillInternal, {
                        topicId: topic.topicId,
                        allowObjective: true,
                        allowEssay: false,
                        reason: "rebase_stale_oversized_mcq_targets",
                    });
                    scheduledTopicCount += 1;
                }
            }
        }

        const rebasedTopics = includeTopicDetails && !dryRun
            ? selectedTopics.map((topic) => ({
                topicId: topic.topicId,
                topicTitle: topic.topicTitle,
                currentTarget: topic.currentTarget,
                recalculatedTarget: topic.recalculatedTarget,
                usableMcqCount: topic.usableMcqCount,
                usableEssayCount: topic.usableEssayCount,
                fillRatio: topic.fillRatio,
                wordCountTarget: topic.wordCountTarget,
                evidenceRichnessCap: topic.evidenceRichnessCap,
                evidenceCapBroadTopicPenaltyApplied: topic.evidenceCapBroadTopicPenaltyApplied,
                retrievedEvidencePassageCount: topic.retrievedEvidencePassageCount,
                scheduled: topic.usableMcqCount < topic.recalculatedTarget,
            }))
            : [];

        return {
            dryRun,
            scannedTopicCount,
            candidateTopicCount,
            rebasedTopicCount,
            scheduledTopicCount,
            staleHours,
            minCurrentTarget,
            maxFillRatio,
            totalTargetReduction,
            skippedForMissingEvidenceCount,
            skippedForLockCount,
            skippedForFreshnessCount,
            skippedForHealthyFillCount,
            sampleTopics: selectedTopics.slice(0, sampleLimit),
            rebasedTopics,
        };
    },
});

export const rebaseStaleOversizedEssayTargets = internalAction({
    args: {
        limit: v.optional(v.number()),
        maxTopics: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
        sampleLimit: v.optional(v.number()),
        staleHours: v.optional(v.number()),
        minCurrentTarget: v.optional(v.number()),
        maxFillRatio: v.optional(v.number()),
        includeTopicDetails: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const maxTopics = Math.max(1, Math.min(2_000, Math.floor(Number(args.maxTopics || 500))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 25))));
        const staleHours = Math.max(1, Math.min(24 * 30, Number(args.staleHours || 24)));
        const minCurrentTarget = Math.max(1, Math.min(20, Math.floor(Number(args.minCurrentTarget || 2))));
        const maxFillRatio = Math.max(0, Math.min(1, Number(args.maxFillRatio || 0.8)));
        const dryRun = args.dryRun === true;
        const includeTopicDetails = args.includeTopicDetails === true;
        const staleCutoffTs = Date.now() - staleHours * 60 * 60 * 1000;

        let scannedTopicCount = 0;
        let candidateTopicCount = 0;
        let rebasedTopicCount = 0;
        let scheduledTopicCount = 0;
        let skippedForMissingEvidenceCount = 0;
        let skippedForLockCount = 0;
        let skippedForFreshnessCount = 0;
        let skippedForHealthyFillCount = 0;
        let totalTargetReduction = 0;
        let cursor: string | null = null;
        let isDone = false;
        const candidateTopics: any[] = [];

        while (!isDone && scannedTopicCount < topicLimit) {
            const pageSize = Math.min(40, topicLimit - scannedTopicCount);
            const topicPage = await ctx.runQuery((internal as any).grounded.listTopicsForSweep, {
                paginationOpts: {
                    numItems: pageSize,
                    cursor,
                },
            }) as {
                page: any[];
                continueCursor: string;
                isDone: boolean;
            };
            cursor = topicPage.continueCursor;
            isDone = topicPage.isDone;

            for (const topic of topicPage.page) {
                scannedTopicCount += 1;
                if (scannedTopicCount > topicLimit) break;

                const currentTarget = Math.max(
                    1,
                    Math.round(Number(topic?.essayTargetCount || DEFAULT_SWEEP_ESSAY_TARGET))
                );
                const usableEssayCount = Math.max(0, Math.round(Number(topic?.usableEssayCount || 0)));
                const updatedAt = Number(topic?.examReadyUpdatedAt || topic?._creationTime || 0);
                const currentlyLocked = Number(topic?.essayGenerationLockedUntil || 0) > Date.now();

                if (currentTarget < minCurrentTarget || usableEssayCount >= currentTarget) {
                    continue;
                }
                if (currentlyLocked) {
                    skippedForLockCount += 1;
                    continue;
                }
                if (updatedAt > staleCutoffTs) {
                    skippedForFreshnessCount += 1;
                    continue;
                }

                const fillRatio = currentTarget > 0 ? usableEssayCount / currentTarget : 1;
                if (usableEssayCount > 0 && fillRatio > maxFillRatio) {
                    skippedForHealthyFillCount += 1;
                    continue;
                }

                const resolution = await resolveEssayTargetForSweep(ctx, topic);
                if (!resolution) {
                    skippedForMissingEvidenceCount += 1;
                    continue;
                }
                if (resolution.targetCount >= currentTarget) {
                    continue;
                }

                candidateTopicCount += 1;
                candidateTopics.push({
                    topicId: topic._id,
                    topicTitle: String(topic?.title || "Unknown Topic"),
                    currentTarget,
                    recalculatedTarget: resolution.targetCount,
                    usableMcqCount: Math.max(0, Math.round(Number(topic?.usableMcqCount || 0))),
                    usableEssayCount,
                    fillRatio,
                    updatedAt,
                    ...resolution,
                });
            }
        }

        candidateTopics.sort((left, right) => {
            const delta = (right.currentTarget - right.recalculatedTarget) - (left.currentTarget - left.recalculatedTarget);
            if (delta !== 0) return delta;
            return left.fillRatio - right.fillRatio;
        });

        const selectedTopics = candidateTopics.slice(0, maxTopics);

        if (!dryRun) {
            for (const topic of selectedTopics) {
                await ctx.runMutation(internal.topics.refreshTopicExamReadinessInternal, {
                    topicId: topic.topicId,
                    essayTargetCount: topic.recalculatedTarget,
                });
                rebasedTopicCount += 1;
                totalTargetReduction += Math.max(0, topic.currentTarget - topic.recalculatedTarget);

                if (topic.usableEssayCount < topic.recalculatedTarget) {
                    await ctx.scheduler.runAfter(0, internal.ai.retryAssessmentGapFillInternal, {
                        topicId: topic.topicId,
                        allowObjective: false,
                        allowEssay: true,
                        requestedEssayCount: topic.recalculatedTarget,
                        reason: "rebase_stale_oversized_essay_targets",
                    });
                    scheduledTopicCount += 1;
                }
            }
        }

        const rebasedTopics = includeTopicDetails && !dryRun
            ? selectedTopics.map((topic) => ({
                topicId: topic.topicId,
                topicTitle: topic.topicTitle,
                currentTarget: topic.currentTarget,
                recalculatedTarget: topic.recalculatedTarget,
                usableMcqCount: topic.usableMcqCount,
                usableEssayCount: topic.usableEssayCount,
                fillRatio: topic.fillRatio,
                wordCountTarget: topic.wordCountTarget,
                evidenceRichnessCap: topic.evidenceRichnessCap,
                evidenceCapBroadTopicPenaltyApplied: topic.evidenceCapBroadTopicPenaltyApplied,
                retrievedEvidencePassageCount: topic.retrievedEvidencePassageCount,
                scheduled: topic.usableEssayCount < topic.recalculatedTarget,
            }))
            : [];

        return {
            dryRun,
            scannedTopicCount,
            candidateTopicCount,
            rebasedTopicCount,
            scheduledTopicCount,
            staleHours,
            minCurrentTarget,
            maxFillRatio,
            totalTargetReduction,
            skippedForMissingEvidenceCount,
            skippedForLockCount,
            skippedForFreshnessCount,
            skippedForHealthyFillCount,
            sampleTopics: selectedTopics.slice(0, sampleLimit),
            rebasedTopics,
        };
    },
});

export const runStaleQuestionBankTargetAudit = internalAction({
    args: {
        mcqLimit: v.optional(v.number()),
        essayLimit: v.optional(v.number()),
        maxTopicsPerFormat: v.optional(v.number()),
        staleHours: v.optional(v.number()),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const startedAt = Date.now();
        const dryRun = args.dryRun === true;
        const staleHours = Math.max(1, Math.min(24 * 30, Number(args.staleHours || 12)));
        const maxTopicsPerFormat = Math.max(1, Math.min(2_000, Math.floor(Number(args.maxTopicsPerFormat || 250))));

        const mcq = await ctx.runAction((internal as any).grounded.rebaseStaleOversizedMcqTargets, {
            dryRun,
            limit: args.mcqLimit,
            maxTopics: maxTopicsPerFormat,
            staleHours,
            minCurrentTarget: 12,
            maxFillRatio: 0.6,
            sampleLimit: 10,
            includeTopicDetails: !dryRun,
        });
        const essay = await ctx.runAction((internal as any).grounded.rebaseStaleOversizedEssayTargets, {
            dryRun,
            limit: args.essayLimit,
            maxTopics: maxTopicsPerFormat,
            staleHours: Math.max(staleHours, 24),
            minCurrentTarget: 2,
            maxFillRatio: 0.8,
            sampleLimit: 10,
            includeTopicDetails: !dryRun,
        });

        const finishedAt = Date.now();
        const rebasedTopics = dryRun
            ? []
            : [
                ...mapRebasedTopicsForAudit(mcq, "mcq"),
                ...mapRebasedTopicsForAudit(essay, "essay"),
            ];

        await ctx.runMutation((internal as any).grounded.insertQuestionTargetAuditRunInternal, {
            dryRun,
            startedAt,
            finishedAt,
            staleHours,
            maxTopicsPerFormat,
            mcqSummary: buildAuditSummary(mcq),
            essaySummary: buildAuditSummary(essay),
            rebasedTopics,
        });

        return {
            dryRun,
            staleHours,
            maxTopicsPerFormat,
            mcq,
            essay,
        };
    },
});

export const benchmarkSemanticRetrievalAB = internalAction({
    args: {
        limit: v.optional(v.number()),
        numericOnly: v.optional(v.boolean()),
        topicIds: v.optional(v.array(v.id("topics"))),
    },
    handler: async (ctx, args) => {
        const limit = Math.max(5, Math.min(200, Math.floor(Number(args.limit || 30))));
        const numericOnly = args.numericOnly === true;
        const topics = await loadSelectedTopicsForBenchmark(ctx, {
            limit: Array.isArray(args.topicIds) && args.topicIds.length > 0
                ? Math.max(limit, args.topicIds.length)
                : Math.min(1000, Math.max(limit, limit * (numericOnly ? 8 : 3))),
            topicIds: args.topicIds,
        });

        const lexicalRecallValues: number[] = [];
        const hybridRecallValues: number[] = [];
        const lexicalLatencyValues: number[] = [];
        const hybridLatencyValues: number[] = [];

        let eligibleTopicCount = 0;
        let comparedTopicCount = 0;
        let vectorActiveTopicCount = 0;
        let numericTopicCount = 0;
        let lexicalTop1HitCount = 0;
        let hybridTop1HitCount = 0;
        let lexicalTop3HitCount = 0;
        let hybridTop3HitCount = 0;
        let improvedTopicsCount = 0;
        let worsenedTopicsCount = 0;
        let unchangedTopicsCount = 0;
        let improvedVectorActiveTopicsCount = 0;

        const samples: Array<{
            topicId: Id<"topics">;
            topicTitle: string;
            lexicalRecallAtK: number;
            hybridRecallAtK: number;
            lexicalTop1Hit: boolean;
            hybridTop1Hit: boolean;
            vectorHitCount: number;
            lexicalHitCount: number;
            targetPassageCount: number;
            queryHasNumericTokens: boolean;
            delta: "improved" | "worsened" | "unchanged";
        }> = [];

        for (const topic of topics) {
            if (comparedTopicCount >= limit) {
                break;
            }
            const targetPassageIds = Array.isArray(topic?.sourcePassageIds)
                ? topic.sourcePassageIds.map((entry: any) => String(entry || "").trim()).filter(Boolean)
                : [];
            if (targetPassageIds.length === 0) {
                continue;
            }

            const { index, upload } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
            if (!index || !upload?._id) {
                continue;
            }
            eligibleTopicCount += 1;

            const query = [
                String(topic?.title || ""),
                String(topic?.description || ""),
            ].join(" ").trim();
            if (!query) {
                continue;
            }
            const queryHasNumericTokens = extractNumericTokens(query).length > 0;
            if (queryHasNumericTokens) {
                numericTopicCount += 1;
            }
            if (numericOnly && !queryHasNumericTokens) {
                continue;
            }

            const lexical = await retrieveGroundedEvidence({
                index,
                query,
                limit: 18,
                preferFlags: ["table", "formula"],
            });
            const hybrid = await retrieveGroundedEvidence({
                ctx,
                index,
                query,
                limit: 18,
                preferFlags: ["table", "formula"],
                uploadId: upload._id,
                embeddingBacklogCount: Math.max(
                    0,
                    Number(upload?.evidencePassageCount || 0) - Number(upload?.embeddedPassageCount || 0)
                ),
            });

            comparedTopicCount += 1;
            if (hybrid.vectorHitCount > 0) {
                vectorActiveTopicCount += 1;
            }

            const lexicalMetrics = computePassageHitMetrics({
                targetPassageIds,
                retrievedPassageIds: lexical.evidence.map((entry) => String(entry?.passageId || "")),
            });
            const hybridMetrics = computePassageHitMetrics({
                targetPassageIds,
                retrievedPassageIds: hybrid.evidence.map((entry) => String(entry?.passageId || "")),
            });
            const delta = classifyBenchmarkDelta({
                lexical: lexicalMetrics,
                hybrid: hybridMetrics,
            });

            lexicalRecallValues.push(lexicalMetrics.recallAtK);
            hybridRecallValues.push(hybridMetrics.recallAtK);
            lexicalLatencyValues.push(Number(lexical.latencyMs || 0));
            hybridLatencyValues.push(Number(hybrid.latencyMs || 0));
            if (lexicalMetrics.top1Hit) lexicalTop1HitCount += 1;
            if (hybridMetrics.top1Hit) hybridTop1HitCount += 1;
            if (lexicalMetrics.top3Hit) lexicalTop3HitCount += 1;
            if (hybridMetrics.top3Hit) hybridTop3HitCount += 1;

            if (delta === "improved") {
                improvedTopicsCount += 1;
                if (hybrid.vectorHitCount > 0) {
                    improvedVectorActiveTopicsCount += 1;
                }
            } else if (delta === "worsened") {
                worsenedTopicsCount += 1;
            } else {
                unchangedTopicsCount += 1;
            }

            samples.push({
                topicId: topic._id,
                topicTitle: String(topic?.title || "Unknown Topic"),
                lexicalRecallAtK: lexicalMetrics.recallAtK,
                hybridRecallAtK: hybridMetrics.recallAtK,
                lexicalTop1Hit: lexicalMetrics.top1Hit,
                hybridTop1Hit: hybridMetrics.top1Hit,
                vectorHitCount: Math.max(0, Number(hybrid.vectorHitCount || 0)),
                lexicalHitCount: Math.max(0, Number(lexical.lexicalHitCount || 0)),
                targetPassageCount: lexicalMetrics.targetCount,
                queryHasNumericTokens,
                delta,
            });
        }

        const sortSampleRows = (
            rows: typeof samples,
            delta: "improved" | "worsened"
        ) => rows
            .filter((row) => row.delta === delta)
            .sort((left, right) => {
                const deltaLeft = left.hybridRecallAtK - left.lexicalRecallAtK;
                const deltaRight = right.hybridRecallAtK - right.lexicalRecallAtK;
                return delta === "improved"
                    ? deltaRight - deltaLeft
                    : deltaLeft - deltaRight;
            })
            .slice(0, 5);

        return {
            benchmark: "semantic_retrieval_ab",
            numericOnly,
            sampledTopicCount: topics.length,
            eligibleTopicCount,
            comparedTopicCount,
            vectorActiveTopicCount,
            numericTopicCount,
            lexical: {
                top1HitRate: toRate(lexicalTop1HitCount, comparedTopicCount),
                top3HitRate: toRate(lexicalTop3HitCount, comparedTopicCount),
                averageRecallAtK: average(lexicalRecallValues),
                averageLatencyMs: average(lexicalLatencyValues),
            },
            hybrid: {
                top1HitRate: toRate(hybridTop1HitCount, comparedTopicCount),
                top3HitRate: toRate(hybridTop3HitCount, comparedTopicCount),
                averageRecallAtK: average(hybridRecallValues),
                averageLatencyMs: average(hybridLatencyValues),
            },
            delta: {
                top1HitRate: toRate(hybridTop1HitCount, comparedTopicCount)
                    - toRate(lexicalTop1HitCount, comparedTopicCount),
                top3HitRate: toRate(hybridTop3HitCount, comparedTopicCount)
                    - toRate(lexicalTop3HitCount, comparedTopicCount),
                averageRecallAtK: average(hybridRecallValues) - average(lexicalRecallValues),
                averageLatencyMs: average(hybridLatencyValues) - average(lexicalLatencyValues),
                improvedTopicsCount,
                worsenedTopicsCount,
                unchangedTopicsCount,
                improvedVectorActiveTopicsCount,
            },
            samples: {
                improved: sortSampleRows(samples, "improved"),
                worsened: sortSampleRows(samples, "worsened"),
            },
        };
    },
});

export const benchmarkStoredMcqRetrievalAB = internalAction({
    args: {
        limit: v.optional(v.number()),
        numericOnly: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const limit = Math.max(10, Math.min(150, Math.floor(Number(args.limit || 50))));
        const numericOnly = args.numericOnly === true;
        const topics = await loadRecentTopicsForBenchmark(
            ctx,
            Math.min(1000, Math.max(limit, limit * (numericOnly ? 8 : 5)))
        );

        const lexicalRecallValues: number[] = [];
        const hybridRecallValues: number[] = [];
        const lexicalLatencyValues: number[] = [];
        const hybridLatencyValues: number[] = [];

        let scannedTopicCount = 0;
        let scannedQuestionCount = 0;
        let eligibleQuestionCount = 0;
        let comparedQuestionCount = 0;
        let vectorActiveQuestionCount = 0;
        let numericQuestionCount = 0;
        let lexicalTop1HitCount = 0;
        let hybridTop1HitCount = 0;
        let lexicalTop3HitCount = 0;
        let hybridTop3HitCount = 0;
        let improvedQuestionsCount = 0;
        let worsenedQuestionsCount = 0;
        let unchangedQuestionsCount = 0;

        const samples: Array<{
            topicId: Id<"topics">;
            topicTitle: string;
            questionId: Id<"questions">;
            questionText: string;
            lexicalRecallAtK: number;
            hybridRecallAtK: number;
            lexicalTop1Hit: boolean;
            hybridTop1Hit: boolean;
            vectorHitCount: number;
            lexicalHitCount: number;
            targetPassageCount: number;
            queryHasNumericTokens: boolean;
            delta: "improved" | "worsened" | "unchanged";
        }> = [];

        for (const topicSeed of topics) {
            if (comparedQuestionCount >= limit) {
                break;
            }

            scannedTopicCount += 1;
            const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
                topicId: topicSeed._id,
            });
            if (!topic?.courseId) {
                continue;
            }

            const rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                topicId: topic._id,
            });
            const storedMcqs = (Array.isArray(rawQuestions) ? rawQuestions : []).filter((question: any) =>
                String(question?.questionType || "") !== "essay"
                && isUsableExamQuestion(question)
                && Array.isArray(question?.sourcePassageIds)
                && question.sourcePassageIds.length > 0
            );
            if (storedMcqs.length === 0) {
                continue;
            }

            const { index, upload } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
            if (!index || !upload?._id) {
                continue;
            }

            for (const question of storedMcqs) {
                if (comparedQuestionCount >= limit) {
                    break;
                }
                scannedQuestionCount += 1;

                const targetPassageIds = Array.isArray(question?.sourcePassageIds)
                    ? question.sourcePassageIds.map((entry: any) => String(entry || "").trim()).filter(Boolean)
                    : [];
                if (targetPassageIds.length === 0) {
                    continue;
                }

                const questionText = String(question?.questionText || "").trim();
                if (!questionText) {
                    continue;
                }

                const numericSignalText = [
                    questionText,
                    String(resolveStoredCorrectOption(question)?.text || ""),
                ].join(" ");
                const queryHasNumericTokens =
                    extractNumericTokens(numericSignalText).length > 0
                    || NUMERIC_MCQ_SIGNAL_PATTERN.test(numericSignalText);
                if (queryHasNumericTokens) {
                    numericQuestionCount += 1;
                }
                if (numericOnly && !queryHasNumericTokens) {
                    continue;
                }

                eligibleQuestionCount += 1;

                const lexical = await retrieveGroundedEvidence({
                    index,
                    query: questionText,
                    limit: 18,
                    preferFlags: ["table"],
                });
                const hybrid = await retrieveGroundedEvidence({
                    ctx,
                    index,
                    query: questionText,
                    limit: 18,
                    preferFlags: ["table"],
                    uploadId: upload._id,
                    embeddingBacklogCount: Math.max(
                        0,
                        Number(upload?.evidencePassageCount || 0) - Number(upload?.embeddedPassageCount || 0)
                    ),
                });

                comparedQuestionCount += 1;
                if (hybrid.vectorHitCount > 0) {
                    vectorActiveQuestionCount += 1;
                }

                const lexicalMetrics = computePassageHitMetrics({
                    targetPassageIds,
                    retrievedPassageIds: lexical.evidence.map((entry) => String(entry?.passageId || "")),
                });
                const hybridMetrics = computePassageHitMetrics({
                    targetPassageIds,
                    retrievedPassageIds: hybrid.evidence.map((entry) => String(entry?.passageId || "")),
                });
                const delta = classifyBenchmarkDelta({
                    lexical: lexicalMetrics,
                    hybrid: hybridMetrics,
                });

                lexicalRecallValues.push(lexicalMetrics.recallAtK);
                hybridRecallValues.push(hybridMetrics.recallAtK);
                lexicalLatencyValues.push(Number(lexical.latencyMs || 0));
                hybridLatencyValues.push(Number(hybrid.latencyMs || 0));
                if (lexicalMetrics.top1Hit) lexicalTop1HitCount += 1;
                if (hybridMetrics.top1Hit) hybridTop1HitCount += 1;
                if (lexicalMetrics.top3Hit) lexicalTop3HitCount += 1;
                if (hybridMetrics.top3Hit) hybridTop3HitCount += 1;

                if (delta === "improved") {
                    improvedQuestionsCount += 1;
                } else if (delta === "worsened") {
                    worsenedQuestionsCount += 1;
                } else {
                    unchangedQuestionsCount += 1;
                }

                samples.push({
                    topicId: topic._id,
                    topicTitle: String(topic?.title || "Unknown Topic"),
                    questionId: question._id,
                    questionText: questionText.slice(0, 180),
                    lexicalRecallAtK: lexicalMetrics.recallAtK,
                    hybridRecallAtK: hybridMetrics.recallAtK,
                    lexicalTop1Hit: lexicalMetrics.top1Hit,
                    hybridTop1Hit: hybridMetrics.top1Hit,
                    vectorHitCount: Math.max(0, Number(hybrid.vectorHitCount || 0)),
                    lexicalHitCount: Math.max(0, Number(lexical.lexicalHitCount || 0)),
                    targetPassageCount: lexicalMetrics.targetCount,
                    queryHasNumericTokens,
                    delta,
                });
            }
        }

        const sortSampleRows = (
            rows: typeof samples,
            delta: "improved" | "worsened"
        ) => rows
            .filter((row) => row.delta === delta)
            .sort((left, right) => {
                const deltaLeft = left.hybridRecallAtK - left.lexicalRecallAtK;
                const deltaRight = right.hybridRecallAtK - right.lexicalRecallAtK;
                return delta === "improved"
                    ? deltaRight - deltaLeft
                    : deltaLeft - deltaRight;
            })
            .slice(0, 5);

        return {
            benchmark: "stored_mcq_retrieval_ab",
            numericOnly,
            sampledTopicCount: topics.length,
            scannedTopicCount,
            scannedQuestionCount,
            eligibleQuestionCount,
            comparedQuestionCount,
            vectorActiveQuestionCount,
            numericQuestionCount,
            lexical: {
                top1HitRate: toRate(lexicalTop1HitCount, comparedQuestionCount),
                top3HitRate: toRate(lexicalTop3HitCount, comparedQuestionCount),
                averageRecallAtK: average(lexicalRecallValues),
                averageLatencyMs: average(lexicalLatencyValues),
            },
            hybrid: {
                top1HitRate: toRate(hybridTop1HitCount, comparedQuestionCount),
                top3HitRate: toRate(hybridTop3HitCount, comparedQuestionCount),
                averageRecallAtK: average(hybridRecallValues),
                averageLatencyMs: average(hybridLatencyValues),
            },
            delta: {
                top1HitRate: toRate(hybridTop1HitCount, comparedQuestionCount)
                    - toRate(lexicalTop1HitCount, comparedQuestionCount),
                top3HitRate: toRate(hybridTop3HitCount, comparedQuestionCount)
                    - toRate(lexicalTop3HitCount, comparedQuestionCount),
                averageRecallAtK: average(hybridRecallValues) - average(lexicalRecallValues),
                averageLatencyMs: average(hybridLatencyValues) - average(lexicalLatencyValues),
                improvedQuestionsCount,
                worsenedQuestionsCount,
                unchangedQuestionsCount,
            },
            samples: {
                improved: sortSampleRows(samples, "improved"),
                worsened: sortSampleRows(samples, "worsened"),
            },
        };
    },
});

export const diagnoseSemanticRetrievalForTopic = internalAction({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
            topicId: args.topicId,
        });
        if (!topic?.courseId) {
            return {
                topicId: args.topicId,
                found: false,
                reason: "topic_not_found",
            };
        }

        const { index, upload } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
        if (!index || !upload?._id) {
            return {
                topicId: args.topicId,
                found: true,
                ready: false,
                reason: "grounded_index_unavailable",
            };
        }

        const targetPassageIds = Array.isArray(topic?.sourcePassageIds)
            ? topic.sourcePassageIds.map((entry: any) => String(entry || "").trim()).filter(Boolean)
            : [];
        const query = [
            String(topic?.title || ""),
            String(topic?.description || ""),
        ].join(" ").trim();

        const lexical = await retrieveGroundedEvidence({
            index,
            query,
            limit: 18,
            preferFlags: ["table", "formula"],
            debug: true,
        });
        const hybrid = await retrieveGroundedEvidence({
            ctx,
            index,
            query,
            limit: 18,
            preferFlags: ["table", "formula"],
            uploadId: upload._id,
            embeddingBacklogCount: Math.max(
                0,
                Number(upload?.evidencePassageCount || 0) - Number(upload?.embeddedPassageCount || 0)
            ),
            debug: true,
        });

        return {
            topicId: args.topicId,
            found: true,
            ready: true,
            topicTitle: String(topic?.title || "Unknown Topic"),
            query,
            targetPassageIds,
            lexical: {
                retrievalMode: lexical.retrievalMode,
                metrics: computePassageHitMetrics({
                    targetPassageIds,
                    retrievedPassageIds: lexical.evidence.map((entry) => String(entry?.passageId || "")),
                }),
                diagnostics: lexical.diagnostics,
            },
            hybrid: {
                retrievalMode: hybrid.retrievalMode,
                metrics: computePassageHitMetrics({
                    targetPassageIds,
                    retrievedPassageIds: hybrid.evidence.map((entry) => String(entry?.passageId || "")),
                }),
                diagnostics: hybrid.diagnostics,
            },
        };
    },
});

export const getGroundingDiagnostics = internalAction({
    args: {
        topicId: v.optional(v.id("topics")),
        uploadId: v.optional(v.id("uploads")),
    },
    handler: async (ctx, args) => {
        const response: any = {};

        if (args.uploadId) {
            response.upload = await ctx.runQuery((internal as any).grounded.getUploadForGrounded, {
                uploadId: args.uploadId,
            });
            response.evidenceIndexes = await ctx.runQuery((internal as any).grounded.listUploadEvidenceIndexes, {
                uploadId: args.uploadId,
                limit: 20,
            });
        }

        if (args.topicId) {
            const topic = await ctx.runQuery(internal.topics.getTopicWithQuestionsInternal, {
                topicId: args.topicId,
            });
            const rawQuestions = await ctx.runQuery(internal.topics.getRawQuestionsByTopicInternal, {
                topicId: args.topicId,
            });

            response.topic = {
                _id: topic?._id,
                title: topic?.title,
                groundingVersion: (topic as any)?.groundingVersion,
                sourcePassageIds: (topic as any)?.sourcePassageIds || [],
                sourceChunkIds: (topic as any)?.sourceChunkIds || [],
            };
            response.questions = (rawQuestions || []).map((question: any) => ({
                _id: question._id,
                questionType: question.questionType,
                questionText: question.questionText,
                groundingScore: question.groundingScore,
                factualityStatus: question.factualityStatus,
                citationCount: Array.isArray(question.citations) ? question.citations.length : 0,
                sourcePassageIds: question.sourcePassageIds || [],
            }));
        }

        return response;
    },
});
