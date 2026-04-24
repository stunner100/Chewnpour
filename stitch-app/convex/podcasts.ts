import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { resolveAuthUserId } from "./lib/examSecurity";

const DEFAULT_TARGET_WORD_COUNT = 1200;
const DEFAULT_VOICE_MODEL = "aura-asteria-en";

const MAX_CONCURRENT_PODCAST_JOBS = Number(process.env.MAX_CONCURRENT_PODCAST_JOBS ?? 5);
const STUCK_JOB_MS = 15 * 60 * 1000;

type PodcastStatus = "pending" | "running" | "ready" | "failed";

const isFeatureEnabled = () =>
    String(process.env.PODCAST_GEN_ENABLED ?? "").toLowerCase() === "true";

const resolveVoiceModel = () => {
    const configured = String(process.env.PODCAST_VOICE_MODEL ?? "").trim();
    return configured || DEFAULT_VOICE_MODEL;
};

const isPodcastInFlight = (row: { status?: string }) =>
    row.status === "pending" || row.status === "running";

const assertPodcastCapacityAvailable = async (ctx: MutationCtx) => {
    const [pendingRows, runningRows] = await Promise.all([
        ctx.db
            .query("topicPodcasts")
            .withIndex("by_status_startedAt", (q) => q.eq("status", "pending"))
            .collect(),
        ctx.db
            .query("topicPodcasts")
            .withIndex("by_status_startedAt", (q) => q.eq("status", "running"))
            .collect(),
    ]);
    if (pendingRows.length + runningRows.length >= MAX_CONCURRENT_PODCAST_JOBS) {
        throw new ConvexError({
            code: "PODCAST_CAPACITY_EXCEEDED",
            message: "Too many podcasts are generating right now. Try again shortly.",
        });
    }
};

const consumePodcastGenerationCredit = async (ctx: MutationCtx, userId: string) => {
    await ctx.runMutation(api.subscriptions.consumeVoiceGenerationCreditOrThrow, {
        userId,
    });
};

// ── Internal helpers (used by the Node-runtime action in podcastsActions.ts) ──

export const getPodcastInternal = internalQuery({
    args: { podcastId: v.id("topicPodcasts") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.podcastId);
    },
});

export const markRunningInternal = internalMutation({
    args: {
        podcastId: v.id("topicPodcasts"),
        expectedStartedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.podcastId);
        if (!row || row.status !== "pending" || row.startedAt !== args.expectedStartedAt) {
            return { updated: false };
        }
        await ctx.db.patch(args.podcastId, {
            status: "running",
            updatedAt: Date.now(),
        });
        return { updated: true };
    },
});

export const markFailedInternal = internalMutation({
    args: {
        podcastId: v.id("topicPodcasts"),
        errorMessage: v.string(),
        expectedStartedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        if (typeof args.expectedStartedAt === "number") {
            const row = await ctx.db.get(args.podcastId);
            if (!row || row.startedAt !== args.expectedStartedAt || row.status !== "running") {
                return { updated: false };
            }
        }
        await ctx.db.patch(args.podcastId, {
            status: "failed",
            errorMessage: args.errorMessage,
            updatedAt: Date.now(),
        });
        return { updated: true };
    },
});

export const markReadyInternal = internalMutation({
    args: {
        podcastId: v.id("topicPodcasts"),
        audioStorageId: v.id("_storage"),
        script: v.string(),
        scriptWordCount: v.number(),
        durationSeconds: v.number(),
        voiceModel: v.string(),
        qualityWarnings: v.optional(v.array(v.string())),
        expectedStartedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.podcastId);
        if (!row || row.status !== "running" || row.startedAt !== args.expectedStartedAt) {
            return { updated: false };
        }
        await ctx.db.patch(args.podcastId, {
            status: "ready",
            audioStorageId: args.audioStorageId,
            script: args.script,
            scriptWordCount: args.scriptWordCount,
            durationSeconds: args.durationSeconds,
            voiceModel: args.voiceModel,
            qualityWarnings: Array.isArray(args.qualityWarnings) ? args.qualityWarnings : [],
            updatedAt: Date.now(),
        });
        return { updated: true };
    },
});

export const sweepStuckPodcastsInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const cutoff = Date.now() - STUCK_JOB_MS;
        const stuck = await ctx.db
            .query("topicPodcasts")
            .withIndex("by_status_startedAt", (q) =>
                q.eq("status", "running").lt("startedAt", cutoff),
            )
            .collect();
        for (const row of stuck) {
            await ctx.db.patch(row._id, {
                status: "failed",
                errorMessage: `Stuck in "running" for more than ${Math.round(STUCK_JOB_MS / 60000)} minutes.`,
                updatedAt: Date.now(),
            });
        }
        return { sweptCount: stuck.length };
    },
});

// ── Public mutation: user clicks "Generate podcast" ────────────────────────

export const requestTopicPodcast = mutation({
    args: {
        topicId: v.id("topics"),
        targetWordCount: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<any> => {
        if (!isFeatureEnabled()) {
            throw new ConvexError({
                code: "FEATURE_DISABLED",
                message: "Podcast generation is not enabled in this environment.",
            });
        }

        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) {
            throw new ConvexError({
                code: "UNAUTHENTICATED",
                message: "You must be signed in to generate a podcast.",
            });
        }

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new ConvexError({ code: "TOPIC_NOT_FOUND", message: "Topic not found." });
        }
        const course = await ctx.db.get(topic.courseId);
        if (!course || course.userId !== userId) {
            throw new ConvexError({ code: "UNAUTHORIZED", message: "You do not have access to this topic." });
        }

        // One in-flight job per user+topic.
        const userTopicRows = await ctx.db
            .query("topicPodcasts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId),
            )
            .collect();
        const active = userTopicRows.find(isPodcastInFlight);
        if (active) {
            throw new ConvexError({
                code: "PODCAST_IN_FLIGHT",
                message: "A podcast is already being generated for this topic.",
            });
        }

        // Global concurrency safety.
        await assertPodcastCapacityAvailable(ctx);

        // Gate against the shared voice-generation quota. Throws on exceeded.
        await consumePodcastGenerationCredit(ctx, userId);

        const targetWordCount = Math.max(
            400,
            Math.min(2000, Math.round(Number(args.targetWordCount ?? DEFAULT_TARGET_WORD_COUNT))),
        );
        const now = Date.now();

        const podcastId = await ctx.db.insert("topicPodcasts", {
            userId,
            topicId: args.topicId,
            status: "pending",
            voiceModel: resolveVoiceModel(),
            targetWordCount,
            startedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.podcastsActions.kickoff, { podcastId });
        return podcastId;
    },
});

// ── Frontend queries ───────────────────────────────────────────────────────

const serializeRow = async (ctx: any, row: any) => ({
    _id: row._id,
    status: row.status as PodcastStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    durationSeconds: row.durationSeconds ?? null,
    scriptWordCount: row.scriptWordCount ?? null,
    voiceModel: row.voiceModel ?? null,
    errorMessage: row.errorMessage ?? null,
    audioUrl: row.audioStorageId
        ? await ctx.storage.getUrl(row.audioStorageId)
        : null,
    qualityWarnings: Array.isArray(row.qualityWarnings) ? row.qualityWarnings : [],
});

export const listTopicPodcasts = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return [];

        const rows = await ctx.db
            .query("topicPodcasts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId),
            )
            .collect();

        rows.sort((a, b) => b.createdAt - a.createdAt);

        return await Promise.all(rows.map((row) => serializeRow(ctx, row)));
    },
});

export const getTopicPodcast = query({
    args: { podcastId: v.id("topicPodcasts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return null;
        const row = await ctx.db.get(args.podcastId);
        if (!row || row.userId !== userId) return null;
        return await serializeRow(ctx, row);
    },
});

// Re-queue a failed podcast. Resets the row to "pending" and reschedules kickoff.
export const retryTopicPodcast = mutation({
    args: { podcastId: v.id("topicPodcasts") },
    handler: async (ctx, args) => {
        if (!isFeatureEnabled()) {
            throw new ConvexError({
                code: "FEATURE_DISABLED",
                message: "Podcast generation is not enabled in this environment.",
            });
        }
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) {
            throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });
        }
        const row = await ctx.db.get(args.podcastId);
        if (!row || row.userId !== userId) {
            throw new ConvexError({ code: "PODCAST_NOT_FOUND", message: "Podcast not found." });
        }
        if (row.status !== "failed") {
            return { success: false, status: row.status };
        }

        const userTopicRows = await ctx.db
            .query("topicPodcasts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", row.topicId),
            )
            .collect();
        const active = userTopicRows.find(isPodcastInFlight);
        if (active) {
            throw new ConvexError({
                code: "PODCAST_IN_FLIGHT",
                message: "A podcast is already being generated for this topic.",
            });
        }

        await assertPodcastCapacityAvailable(ctx);
        await consumePodcastGenerationCredit(ctx, userId);

        const now = Date.now();
        await ctx.db.patch(args.podcastId, {
            status: "pending",
            errorMessage: undefined,
            startedAt: now,
            updatedAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.podcastsActions.kickoff, {
            podcastId: args.podcastId,
        });
        return { success: true, status: "pending" };
    },
});
