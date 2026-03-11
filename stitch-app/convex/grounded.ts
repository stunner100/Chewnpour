import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildGroundedEvidenceIndexFromArtifact } from "./lib/groundedEvidenceIndex";
import { retrieveGroundedEvidence } from "./lib/groundedRetrieval";
import { runDeterministicGroundingCheck } from "./lib/groundedVerifier";
import {
    QUESTION_BANK_BACKGROUND_PROFILE,
    calculateQuestionBankTarget,
    resolveEvidenceRichMcqCap,
} from "./lib/questionBankConfig";

type UploadDoc = {
    _id: Id<"uploads">;
    fileName: string;
    status?: string;
    extractionStatus?: string;
    extractionArtifactStorageId?: Id<"_storage">;
    evidenceIndexStorageId?: Id<"_storage">;
    _creationTime?: number;
};

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

const countWords = (value: unknown) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

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
            if (stored && Array.isArray((stored as any)?.passages)) {
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
    const { index } = await loadGroundedEvidenceIndexForTopicSweep(ctx, topic);
    if (!index) return null;

    const evidence = retrieveGroundedEvidence({
        index,
        query: [
            String(topic?.title || ""),
            String(topic?.description || ""),
        ].join(" "),
        limit: 18,
        preferFlags: ["table"],
    });
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

export const listBackfillUploads = internalQuery({
    args: {
        days: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const days = Math.max(1, Math.min(120, Math.floor(Number(args.days || 30))));
        const limit = Math.max(1, Math.min(500, Math.floor(Number(args.limit || 100))));
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
        // No by_uploadId index currently; keep bounded scan for backfill tooling.
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

            await ctx.runMutation(api.uploads.updateUploadStatus, {
                uploadId: args.uploadId,
                status: String(upload.status || "processing"),
                evidenceIndexStorageId: storageId,
                evidenceIndexVersion: index.version,
                evidencePassageCount: index.passageCount,
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
            };
        } catch (error) {
            await ctx.runMutation((internal as any).grounded.insertUploadEvidenceIndexRecord, {
                uploadId: args.uploadId,
                version: "grounded-v1",
                storageId: artifactStorageId,
                passageCount: 0,
                status: "failed",
                errorSummary: toErrorSummary(error),
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
        await ctx.scheduler.runAfter(0, (internal as any).ai.generateQuestionsForTopicInternal, {
            topicId: args.topicId,
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
        await ctx.scheduler.runAfter(0, (internal as any).ai.generateEssayQuestionsForTopicInternal, {
            topicId: args.topicId,
            count: args.count,
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
                const deletionResult = await ctx.runMutation(internal.topics.deleteMcqQuestionsByTopicInternal, {
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
    },
    handler: async (ctx, args) => {
        const topicLimit = Math.max(1, Math.min(20_000, Math.floor(Number(args.limit || 10_000))));
        const maxTopics = Math.max(1, Math.min(2_000, Math.floor(Number(args.maxTopics || 500))));
        const sampleLimit = Math.max(1, Math.min(100, Math.floor(Number(args.sampleLimit || 25))));
        const staleHours = Math.max(1, Math.min(24 * 30, Number(args.staleHours || 6)));
        const minCurrentTarget = Math.max(1, Math.min(100, Math.floor(Number(args.minCurrentTarget || 12))));
        const maxFillRatio = Math.max(0, Math.min(1, Number(args.maxFillRatio || 0.6)));
        const dryRun = args.dryRun === true;
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
                    mcqTargetCount: topic.recalculatedTarget,
                });
                rebasedTopicCount += 1;
                totalTargetReduction += Math.max(0, topic.currentTarget - topic.recalculatedTarget);

                if (topic.usableMcqCount < topic.recalculatedTarget) {
                    await ctx.scheduler.runAfter(0, internal.ai.generateQuestionsForTopicInternal, {
                        topicId: topic.topicId,
                    });
                    scheduledTopicCount += 1;
                }
            }
        }

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
