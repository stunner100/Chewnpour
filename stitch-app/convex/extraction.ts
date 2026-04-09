"use node";

import { Blob } from "node:buffer";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
    type ExtractionBackendId,
    runDocumentExtractionPipeline,
    type DocumentExtractionResult,
    type ExtractionParserId,
    type ExtractionPassTrace,
} from "./lib/documentExtractionPipeline";

const EXTRACTION_PIPELINE_V2 = ["1", "true", "yes", "on"].includes(
    String(process.env.EXTRACTION_PIPELINE_V2 || "true").trim().toLowerCase()
);

const FOREGROUND_MAX_DURATION_MS = 180_000;
const BACKGROUND_MAX_DURATION_MS = 300_000;
const CONTENT_LOSS_WEAK_PAGE_THRESHOLD = 0.05;
const CONTENT_LOSS_PAGE_PRESENCE_THRESHOLD = 0.98;
const CONTENT_LOSS_PAGE_PRESENCE_SCANNED_THRESHOLD = 0.95;

type UploadDoc = {
    _id: Id<"uploads">;
    fileName: string;
    fileType?: string;
    fileUrl?: string;
    fileSize?: number;
    status?: string;
    storageId?: Id<"_storage">;
    extractionQualityScore?: number;
    extractionCoverage?: number;
};

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const topicKeywords = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map((item) => item.trim())
                .filter((item) => item.length >= 4)
        )
    );

const buildTopicRecoveredSnippet = (source: string, title: string, description?: string) => {
    const text = sanitizeText(source);
    if (!text) return "";

    const chunkSize = 3000;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) return "";

    const keywords = topicKeywords(`${title || ""} ${description || ""}`).slice(0, 10);
    const scored = chunks.map((chunk, index) => {
        const lower = chunk.toLowerCase();
        const score = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0);
        return { chunk, index, score };
    });

    const selected = scored
        .sort((a, b) => (b.score - a.score) || (a.index - b.index))
        .slice(0, 4)
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.chunk.trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 12_000)
        .trim();

    return selected || chunks.slice(0, 2).join("\n\n").slice(0, 12_000).trim();
};

const stripRecoveredSections = (content: string) =>
    String(content || "")
        .replace(/\n{0,2}##\s+Recovered Content[\s\S]*$/i, "")
        .replace(/\n{0,2}##\s+Recovered Content \(Improved Extraction\)[\s\S]*$/i, "")
        .trim();

const getPrimaryExtractionBackend = (fileType?: string): ExtractionBackendId => {
    const normalized = String(fileType || "").toLowerCase();
    if (normalized === "pptx" || normalized === "docx") {
        return "markitdown";
    }
    return "datalab";
};

const didUseFallbackBackend = (fileType?: string, backend?: ExtractionBackendId | null) =>
    Boolean(backend && backend !== getPrimaryExtractionBackend(fileType));

const createArtifactStorageRecord = async (ctx: any, artifact: unknown): Promise<Id<"_storage">> => {
    const blob = new Blob([JSON.stringify(artifact)], { type: "application/json" });
    return await ctx.storage.store(blob);
};

const toErrorSummary = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

const getUploadForExtraction = async (ctx: any, uploadId: Id<"uploads">): Promise<UploadDoc> => {
    const upload = await ctx.runQuery(internal.extractionState.getUploadForExtraction, {
        uploadId,
    });
    if (!upload) {
        throw new Error("Upload not found");
    }
    if (!upload.storageId) {
        throw new Error("Upload file storage record missing");
    }
    return upload as UploadDoc;
};

const runExtraction = async (
    ctx: any,
    upload: UploadDoc,
    mode: "foreground" | "background",
    backend?: ExtractionBackendId,
    parser?: ExtractionParserId | null
): Promise<DocumentExtractionResult> => {
    const fileUrl = await ctx.storage.getUrl(upload.storageId as Id<"_storage">);
    if (!fileUrl) {
        throw new Error("Could not resolve upload storage URL");
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Could not download upload file: ${response.status}`);
    }

    const fileBuffer = await response.arrayBuffer();
    return await runDocumentExtractionPipeline({
        uploadId: String(upload._id),
        fileName: upload.fileName,
        fileType: String(upload.fileType || "").toLowerCase(),
        fileBuffer,
        mode,
        maxDurationMs: mode === "foreground" ? FOREGROUND_MAX_DURATION_MS : BACKGROUND_MAX_DURATION_MS,
        backend,
        parser,
    });
};

const recordDocumentExtraction = async (ctx: any, args: {
    uploadId: Id<"uploads">;
    result: DocumentExtractionResult;
    artifactStorageId: Id<"_storage">;
    startedAt: number;
    finishedAt: number;
    errorSummary?: string;
}) => {
    await ctx.runMutation((internal as any).extractionState.insertDocumentExtraction, {
        uploadId: args.uploadId,
        version: args.result.artifact.version,
        status: args.result.strictPass ? "complete" : "provisional",
        qualityScore: args.result.qualityScore,
        coverage: args.result.coverage,
        providerTrace: args.result.providerTrace,
        backend: args.result.backend,
        parser: args.result.parser,
        winner: true,
        artifactStorageId: args.artifactStorageId,
        startedAt: args.startedAt,
        finishedAt: args.finishedAt,
        errorSummary: args.errorSummary,
    });
};

const recordFailedDocumentExtraction = async (ctx: any, args: {
    uploadId: Id<"uploads">;
    startedAt: number;
    finishedAt: number;
    errorSummary: string;
    providerTrace?: ExtractionPassTrace[];
    qualityScore?: number;
    coverage?: number;
    backend?: ExtractionBackendId;
    parser?: ExtractionParserId | null;
}) => {
    await ctx.runMutation((internal as any).extractionState.insertDocumentExtraction, {
        uploadId: args.uploadId,
        version: "v2",
        status: "failed",
        qualityScore: Number(args.qualityScore || 0),
        coverage: Number(args.coverage || 0),
        providerTrace: Array.isArray(args.providerTrace) ? args.providerTrace : [],
        backend: args.backend || "datalab",
        parser: args.parser || undefined,
        winner: false,
        startedAt: args.startedAt,
        finishedAt: args.finishedAt,
        errorSummary: args.errorSummary,
    });
};

const logExtractionTelemetry = (args: {
    mode: "foreground" | "background";
    upload: UploadDoc;
    result: DocumentExtractionResult;
}) => {
    const metrics = args.result.artifact?.metrics;
    const pagePresenceThreshold = metrics?.scannedLikely
        ? CONTENT_LOSS_PAGE_PRESENCE_SCANNED_THRESHOLD
        : CONTENT_LOSS_PAGE_PRESENCE_THRESHOLD;

    console.info("[Extraction] pipeline_completed", {
        mode: args.mode,
        uploadId: String(args.upload._id),
        fileType: String(args.upload.fileType || ""),
        fileName: args.upload.fileName,
        fileSize: Number(args.upload.fileSize || 0),
        backend: args.result.backend,
        parser: args.result.parser,
        pageCount: Number(args.result.pageCount || metrics?.expectedPageCount || 0),
        qualityScore: Number(args.result.qualityScore || 0),
        coverage: Number(args.result.coverage || 0),
        provisional: Boolean(args.result.provisional),
        strictPass: Boolean(args.result.strictPass),
    });

    for (const trace of args.result.providerTrace || []) {
        console.info("[Extraction] provider_pass", {
            mode: args.mode,
            uploadId: String(args.upload._id),
            fileType: String(args.upload.fileType || ""),
            backend: args.result.backend,
            parser: args.result.parser,
            providerPass: trace.pass,
            status: trace.status,
            latencyMs: Number(trace.latencyMs || 0),
            chars: Number(trace.chars || 0),
            pageCount: Number(trace.pageCount || 0),
            error: trace.error,
        });
    }

    if (
        metrics &&
        (
            Number(metrics.weakPageRatio || 0) > CONTENT_LOSS_WEAK_PAGE_THRESHOLD
            || Number(metrics.pagePresenceRatio || 0) < pagePresenceThreshold
        )
    ) {
        console.warn("[Extraction] content_loss_suspected", {
            mode: args.mode,
            uploadId: String(args.upload._id),
            fileType: String(args.upload.fileType || ""),
            pageCount: Number(metrics.expectedPageCount || 0),
            pagePresenceRatio: Number(metrics.pagePresenceRatio || 0),
            weakPageRatio: Number(metrics.weakPageRatio || 0),
            tableRecoveryRatio: Number(metrics.tableRecoveryRatio || 0),
            formulaMarkerLoss: Number(metrics.formulaMarkerLoss || 0),
            qualityScore: Number(metrics.qualityScore || 0),
            coverage: Number(metrics.coverage || 0),
            provisional: Boolean(metrics.provisional),
        });
    }
};

const markUploadExtraction = async (ctx: any, args: {
    uploadId: Id<"uploads">;
    status: "running" | "provisional" | "complete" | "failed";
    uploadStatus?: "processing" | "ready" | "error";
    qualityScore?: number;
    coverage?: number;
    provisional?: boolean;
    backend?: ExtractionBackendId;
    parser?: ExtractionParserId | null;
    fallbackUsed?: boolean;
    replacementReason?: string;
    artifactStorageId?: Id<"_storage">;
    warnings?: string[];
}) => {
    await ctx.runMutation((api as any).uploads.updateUploadStatus, {
        uploadId: args.uploadId,
        status: args.uploadStatus || (args.status === "failed" ? "error" : "processing"),
        extractionStatus: args.status,
        extractionVersion: "v2",
        provisionalExtraction: args.provisional,
        extractionQualityScore: args.qualityScore,
        extractionCoverage: args.coverage,
        extractionBackend: args.backend,
        extractionParser: args.parser || undefined,
        extractionFallbackUsed: args.fallbackUsed,
        extractionReplacementReason: args.replacementReason,
        extractionArtifactStorageId: args.artifactStorageId,
        extractionWarnings: args.warnings,
    });
};

const buildEvidenceIndexForUpload = async (ctx: any, args: {
    uploadId: Id<"uploads">;
    artifactStorageId?: Id<"_storage">;
}) => {
    try {
        await ctx.runAction((internal as any).grounded.buildEvidenceIndex, {
            uploadId: args.uploadId,
            artifactStorageId: args.artifactStorageId,
        });
    } catch (error) {
        console.warn("[Grounded] evidence_index_build_failed", {
            uploadId: String(args.uploadId),
            artifactStorageId: args.artifactStorageId ? String(args.artifactStorageId) : "",
            message: error instanceof Error ? error.message : String(error),
        });
    }
};

export const runForegroundExtraction = internalAction({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        if (!EXTRACTION_PIPELINE_V2) {
            throw new Error("EXTRACTION_PIPELINE_V2 is disabled");
        }

        const upload = await getUploadForExtraction(ctx, args.uploadId);
        const startedAt = Date.now();

        await markUploadExtraction(ctx, {
            uploadId: args.uploadId,
            status: "running",
            uploadStatus: "processing",
            provisional: false,
            qualityScore: 0,
            coverage: 0,
            fallbackUsed: false,
            warnings: [],
        });

        let result: DocumentExtractionResult | null = null;
        let artifactStorageId: Id<"_storage"> | undefined;

        try {
            result = await runExtraction(ctx, upload, "foreground");
            artifactStorageId = await createArtifactStorageRecord(ctx, result.artifact);
            const finishedAt = Date.now();

            logExtractionTelemetry({
                mode: "foreground",
                upload,
                result,
            });

            await recordDocumentExtraction(ctx, {
                uploadId: args.uploadId,
                result,
                artifactStorageId,
                startedAt,
                finishedAt,
            });

            await markUploadExtraction(ctx, {
                uploadId: args.uploadId,
                status: result.strictPass ? "complete" : "provisional",
                uploadStatus: "processing",
                provisional: result.provisional,
                qualityScore: result.qualityScore,
                coverage: result.coverage,
                backend: result.backend,
                parser: result.parser,
                fallbackUsed: didUseFallbackBackend(upload.fileType, result.backend),
                artifactStorageId,
                warnings: result.warnings,
            });

            // Schedule evidence index build non-blocking — it isn't needed
            // until retrieval during topic generation, and ai.ts has a
            // fallback that rebuilds from the artifact if the index isn't
            // ready yet.
            ctx.scheduler.runAfter(0, (internal as any).grounded.buildEvidenceIndex, {
                uploadId: args.uploadId,
                artifactStorageId,
            });

            return {
                text: result.text,
                qualityScore: result.qualityScore,
                coverage: result.coverage,
                provisional: result.provisional,
                strictPass: result.strictPass,
                warnings: result.warnings,
                artifactStorageId,
                providerTrace: result.providerTrace,
                backend: result.backend,
                parser: result.parser,
                fallbackRecommendation: result.fallbackRecommendation,
            };
        } catch (error) {
            const finishedAt = Date.now();
            const errorSummary = toErrorSummary(error);

            await recordFailedDocumentExtraction(ctx, {
                uploadId: args.uploadId,
                startedAt,
                finishedAt,
                errorSummary,
                providerTrace: result?.providerTrace,
                qualityScore: result?.qualityScore,
                coverage: result?.coverage,
                backend: result?.backend,
                parser: result?.parser,
            });

            await markUploadExtraction(ctx, {
                uploadId: args.uploadId,
                status: "failed",
                uploadStatus: "error",
                provisional: false,
                qualityScore: Number(result?.qualityScore || 0),
                coverage: Number(result?.coverage || 0),
                backend: result?.backend,
                parser: result?.parser,
                fallbackUsed: didUseFallbackBackend(upload.fileType, result?.backend),
                artifactStorageId,
                warnings: result?.warnings || [],
            });

            console.error("[Extraction] foreground_failed", {
                uploadId: String(args.uploadId),
                fileType: String(upload.fileType || ""),
                fileName: upload.fileName,
                error: errorSummary,
            });
            throw error;
        }
    },
});

export const benchmarkUploadExtraction = internalAction({
    args: {
        uploadId: v.id("uploads"),
        mode: v.optional(v.union(v.literal("foreground"), v.literal("background"))),
        backend: v.optional(v.union(v.literal("markitdown"), v.literal("datalab"), v.literal("azure"), v.literal("llamaparse"))),
        parser: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const upload = await getUploadForExtraction(ctx, args.uploadId);
        const mode = args.mode === "background" ? "background" : "foreground";
        const startedAt = Date.now();
        const result = await runExtraction(
            ctx,
            upload,
            mode,
            args.backend as ExtractionBackendId | undefined,
            (args.parser || undefined) as ExtractionParserId | undefined
        );
        const finishedAt = Date.now();

        logExtractionTelemetry({
            mode,
            upload,
            result,
        });

        return {
            uploadId: args.uploadId,
            fileName: upload.fileName,
            fileType: String(upload.fileType || ""),
            fileSize: Number(upload.fileSize || 0),
            mode,
            backend: result.backend,
            parser: result.parser,
            durationMs: finishedAt - startedAt,
            qualityScore: result.qualityScore,
            coverage: result.coverage,
            strictPass: result.strictPass,
            provisional: result.provisional,
            warnings: result.warnings,
            pageCount: result.pageCount,
            extractedChars: String(result.text || "").length,
            providerTrace: result.providerTrace,
            metrics: result.artifact?.metrics,
            fallbackRecommendation: result.fallbackRecommendation,
        };
    },
});

export const applyExtractionUpgrade = internalAction({
    args: {
        uploadId: v.id("uploads"),
        courseId: v.id("courses"),
        extractedText: v.string(),
        qualityScore: v.number(),
        coverage: v.number(),
        artifactStorageId: v.optional(v.id("_storage")),
    },
    handler: async (ctx, args) => {
        const upload = await ctx.runQuery(internal.extractionState.getUploadForExtraction, {
            uploadId: args.uploadId,
        });
        const stableUploadStatus = upload?.status === "ready" ? "ready" : "processing";
        const coursePayload = await ctx.runQuery(api.courses.getCourseWithTopics, {
            courseId: args.courseId,
        });

        if (!coursePayload || !Array.isArray(coursePayload.topics)) {
            return { updatedTopics: 0, replaced: 0, appended: 0, skipped: 0 };
        }

        const topics = [...coursePayload.topics].sort((a: any, b: any) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));

        let replaced = 0;
        let appended = 0;
        let skipped = 0;

        for (const topic of topics) {
            const topicAttemptState = await ctx.runQuery(
                internal.extractionState.getTopicAttemptState,
                { topicId: topic._id }
            );
            const hasAttempts = Boolean(topicAttemptState?.hasAttempts);
            const snippet = buildTopicRecoveredSnippet(
                args.extractedText,
                String(topic.title || ""),
                String(topic.description || "")
            );

            if (!snippet) {
                skipped += 1;
                continue;
            }

            const baseContent = stripRecoveredSections(String(topic.content || ""));
            let nextContent = baseContent;

            if (!hasAttempts) {
                nextContent = sanitizeText([
                    `## ${String(topic.title || "Recovered Topic")}`,
                    String(topic.description || "").trim(),
                    "## Recovered Content",
                    snippet,
                ].filter(Boolean).join("\n\n"));
                replaced += 1;
            } else {
                nextContent = sanitizeText([
                    baseContent,
                    "## Recovered Content (Improved Extraction)",
                    snippet,
                ].filter(Boolean).join("\n\n"));
                appended += 1;
            }

            await ctx.runMutation(internal.extractionState.patchTopicContent, {
                topicId: topic._id,
                content: nextContent,
            });
        }

        await ctx.runMutation(api.uploads.updateUploadStatus, {
            uploadId: args.uploadId,
            status: stableUploadStatus,
            extractionStatus: "complete",
            provisionalExtraction: false,
            extractionQualityScore: args.qualityScore,
            extractionCoverage: args.coverage,
            extractionVersion: "v2",
            extractionArtifactStorageId: args.artifactStorageId,
        });

        return {
            updatedTopics: replaced + appended,
            replaced,
            appended,
            skipped,
        };
    },
});

export const runBackgroundReprocess = internalAction({
    args: {
        uploadId: v.id("uploads"),
        courseId: v.id("courses"),
        backend: v.optional(v.union(v.literal("markitdown"), v.literal("datalab"), v.literal("azure"), v.literal("llamaparse"))),
        parser: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (!EXTRACTION_PIPELINE_V2) {
            return { skipped: true, reason: "pipeline_disabled" };
        }

        const upload = await getUploadForExtraction(ctx, args.uploadId);
        const stableUploadStatus = upload.status === "ready" ? "ready" : "processing";
        const startedAt = Date.now();

        let result: DocumentExtractionResult | null = null;
        let artifactStorageId: Id<"_storage"> | undefined;

        try {
            result = await runExtraction(
                ctx,
                upload,
                "background",
                args.backend as ExtractionBackendId | undefined,
                (args.parser || undefined) as ExtractionParserId | undefined
            );
            artifactStorageId = await createArtifactStorageRecord(ctx, result.artifact);
            const finishedAt = Date.now();

            logExtractionTelemetry({
                mode: "background",
                upload,
                result,
            });

            await recordDocumentExtraction(ctx, {
                uploadId: args.uploadId,
                result,
                artifactStorageId,
                startedAt,
                finishedAt,
            });

            await markUploadExtraction(ctx, {
                uploadId: args.uploadId,
                status: result.strictPass ? "complete" : "provisional",
                uploadStatus: stableUploadStatus,
                provisional: result.provisional,
                qualityScore: result.qualityScore,
                coverage: result.coverage,
                backend: result.backend,
                parser: result.parser,
                fallbackUsed: didUseFallbackBackend(upload.fileType, result.backend),
                artifactStorageId,
                warnings: result.warnings,
            });

            await buildEvidenceIndexForUpload(ctx, {
                uploadId: args.uploadId,
                artifactStorageId,
            });

            if (result.strictPass) {
                await ctx.runAction(internal.extraction.applyExtractionUpgrade, {
                    uploadId: args.uploadId,
                    courseId: args.courseId,
                    extractedText: result.text,
                    qualityScore: result.qualityScore,
                    coverage: result.coverage,
                    artifactStorageId,
                });
            }

            return {
                skipped: false,
                strictPass: result.strictPass,
                provisional: result.provisional,
                qualityScore: result.qualityScore,
                coverage: result.coverage,
                warnings: result.warnings,
                artifactStorageId,
                backend: result.backend,
                parser: result.parser,
                fallbackRecommendation: result.fallbackRecommendation,
            };
        } catch (error) {
            const finishedAt = Date.now();
            const errorSummary = toErrorSummary(error);

            await recordFailedDocumentExtraction(ctx, {
                uploadId: args.uploadId,
                startedAt,
                finishedAt,
                errorSummary,
                providerTrace: result?.providerTrace,
                qualityScore: result?.qualityScore,
                coverage: result?.coverage,
                backend: result?.backend,
                parser: result?.parser,
            });

            await markUploadExtraction(ctx, {
                uploadId: args.uploadId,
                status: "failed",
                uploadStatus: "error",
                provisional: false,
                qualityScore: Number(result?.qualityScore || 0),
                coverage: Number(result?.coverage || 0),
                backend: result?.backend,
                parser: result?.parser,
                fallbackUsed: didUseFallbackBackend(upload.fileType, result?.backend),
                artifactStorageId,
                warnings: result?.warnings || [],
            });

            console.error("[Extraction] background_reprocess_failed", {
                uploadId: String(args.uploadId),
                fileType: String(upload.fileType || ""),
                fileName: upload.fileName,
                error: errorSummary,
            });
            throw error;
        }
    },
});

export const getExtractionDiagnostics = internalAction({
    args: {
        uploadId: v.id("uploads"),
    },
    handler: async (ctx, args) => {
        const upload = await ctx.runQuery(internal.extractionState.getUploadForExtraction, {
            uploadId: args.uploadId,
        });
        const history = await ctx.runQuery(internal.extractionState.listDocumentExtractions, {
            uploadId: args.uploadId,
            limit: 10,
        });

        const entries = history.map((entry) => ({
            _id: entry._id,
            uploadId: entry.uploadId,
            version: entry.version,
            status: entry.status,
            qualityScore: entry.qualityScore,
            coverage: entry.coverage,
            providerTrace: entry.providerTrace,
            backend: entry.backend,
            parser: entry.parser,
            winner: entry.winner,
            baselineBackend: entry.baselineBackend,
            baselineQualityScore: entry.baselineQualityScore,
            baselineCoverage: entry.baselineCoverage,
            comparisonReason: entry.comparisonReason,
            artifactStorageId: entry.artifactStorageId,
            startedAt: entry.startedAt,
            finishedAt: entry.finishedAt,
            errorSummary: entry.errorSummary,
        }));

        return {
            upload,
            entries,
        };
    },
});
