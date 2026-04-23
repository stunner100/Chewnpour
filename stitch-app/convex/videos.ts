import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveAuthUserId } from "./lib/examSecurity";

const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_ASPECT_RATIO = "9:16";
const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 1280;

const MAX_CONCURRENT_VIDEO_JOBS = Number(process.env.MAX_CONCURRENT_VIDEO_JOBS ?? 5);
const STUCK_JOB_MS = 20 * 60 * 1000;
const SOURCE_SNIPPET_MAX_CHARS = 800;

type VideoStatus = "pending" | "running" | "ready" | "failed";

const isFeatureEnabled = () =>
    String(process.env.VIDEO_GEN_ENABLED ?? "").toLowerCase() === "true";

const extractTopicSnippet = (topic: any): { title: string; snippet: string } => {
    const title = String(topic?.title ?? "this concept");
    const candidates: string[] = [];
    if (typeof topic?.content === "string") candidates.push(topic.content);
    if (typeof topic?.description === "string") candidates.push(topic.description);
    if (Array.isArray(topic?.structuredLearningObjectives)) {
        candidates.push(topic.structuredLearningObjectives.join(". "));
    }
    if (Array.isArray(topic?.contentGraph?.keyPoints)) {
        candidates.push(topic.contentGraph.keyPoints.join(". "));
    }
    const snippet = candidates.find((candidate) => candidate && candidate.trim().length > 0) ?? "";
    return { title, snippet };
};

const buildPrompt = (topicTitle: string, sourceSnippet: string) => {
    const trimmed = sourceSnippet.trim().slice(0, SOURCE_SNIPPET_MAX_CHARS);
    return [
        "Create a short, classroom-style explainer clip that visually illustrates the following concept.",
        "No on-screen text. Calm, educational tone. Clear subject framing.",
        `Concept: ${topicTitle}.`,
        trimmed ? `Key ideas: ${trimmed}` : "",
    ]
        .filter(Boolean)
        .join(" ");
};

// ── Internal helpers (used by the Node-runtime action in videosActions.ts) ──

export const getVideoInternal = internalQuery({
    args: { videoId: v.id("topicVideos") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.videoId);
    },
});

export const markRunningInternal = internalMutation({
    args: {
        videoId: v.id("topicVideos"),
        providerJobId: v.string(),
        pollingUrl: v.optional(v.string()),
        providerStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.videoId, {
            status: "running",
            providerJobId: args.providerJobId,
            pollingUrl: args.pollingUrl,
            providerStatus: args.providerStatus,
            updatedAt: Date.now(),
        });
    },
});

export const markFailedInternal = internalMutation({
    args: {
        videoId: v.id("topicVideos"),
        errorMessage: v.string(),
        providerStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.videoId, {
            status: "failed",
            errorMessage: args.errorMessage,
            providerStatus: args.providerStatus,
            updatedAt: Date.now(),
        });
    },
});

export const markReadyInternal = internalMutation({
    args: {
        videoId: v.id("topicVideos"),
        videoStorageId: v.id("_storage"),
        providerUrl: v.optional(v.string()),
        costUsd: v.optional(v.number()),
        tokenCount: v.optional(v.number()),
        providerStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.videoId, {
            status: "ready",
            videoStorageId: args.videoStorageId,
            providerUrl: args.providerUrl,
            costUsd: args.costUsd,
            tokenCount: args.tokenCount,
            providerStatus: args.providerStatus,
            updatedAt: Date.now(),
        });
    },
});

export const recordPollAttemptInternal = internalMutation({
    args: {
        videoId: v.id("topicVideos"),
        providerStatus: v.string(),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.videoId);
        if (!row) return;
        await ctx.db.patch(args.videoId, {
            pollAttempts: (row.pollAttempts ?? 0) + 1,
            providerStatus: args.providerStatus,
            updatedAt: Date.now(),
        });
    },
});

export const sweepStuckJobsInternal = internalMutation({
    args: {},
    handler: async (ctx) => {
        const cutoff = Date.now() - STUCK_JOB_MS;
        const stuck = await ctx.db
            .query("topicVideos")
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

// ── Public mutation: user clicks "Generate explainer video" ────────────────

export const requestTopicVideo = mutation({
    args: {
        topicId: v.id("topics"),
        durationSeconds: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        if (!isFeatureEnabled()) {
            throw new ConvexError({
                code: "FEATURE_DISABLED",
                message: "Video generation is not enabled in this environment.",
            });
        }

        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) {
            throw new ConvexError({
                code: "UNAUTHENTICATED",
                message: "You must be signed in to generate a video.",
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
            .query("topicVideos")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId),
            )
            .collect();
        const active = userTopicRows.find(
            (row) => row.status === "pending" || row.status === "running",
        );
        if (active) {
            throw new ConvexError({
                code: "VIDEO_IN_FLIGHT",
                message: "A video is already being generated for this topic.",
            });
        }

        // Global concurrency safety.
        const [pendingRows, runningRows] = await Promise.all([
            ctx.db
                .query("topicVideos")
                .withIndex("by_status_startedAt", (q) => q.eq("status", "pending"))
                .collect(),
            ctx.db
                .query("topicVideos")
                .withIndex("by_status_startedAt", (q) => q.eq("status", "running"))
                .collect(),
        ]);
        if (pendingRows.length + runningRows.length >= MAX_CONCURRENT_VIDEO_JOBS) {
            throw new ConvexError({
                code: "VIDEO_CAPACITY_EXCEEDED",
                message: "Too many videos are generating right now. Try again shortly.",
            });
        }

        const duration = Math.max(
            2,
            Math.min(10, args.durationSeconds ?? DEFAULT_DURATION_SECONDS),
        );
        const { title, snippet } = extractTopicSnippet(topic);
        const promptText = buildPrompt(title, snippet);
        const now = Date.now();

        const videoId = await ctx.db.insert("topicVideos", {
            userId,
            topicId: args.topicId,
            status: "pending",
            promptText,
            sourceSnippet: snippet.slice(0, SOURCE_SNIPPET_MAX_CHARS),
            durationSeconds: duration,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            aspectRatio: DEFAULT_ASPECT_RATIO,
            pollAttempts: 0,
            startedAt: now,
            createdAt: now,
            updatedAt: now,
        });

        await ctx.scheduler.runAfter(0, internal.videosActions.kickoff, { videoId });
        return videoId;
    },
});

// ── Frontend queries ───────────────────────────────────────────────────────

export const listTopicVideos = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return [];

        const rows = await ctx.db
            .query("topicVideos")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", userId).eq("topicId", args.topicId),
            )
            .collect();

        rows.sort((a, b) => b.createdAt - a.createdAt);

        return await Promise.all(
            rows.map(async (row) => ({
                _id: row._id,
                status: row.status as VideoStatus,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                durationSeconds: row.durationSeconds,
                errorMessage: row.errorMessage,
                videoUrl: row.videoStorageId
                    ? await ctx.storage.getUrl(row.videoStorageId)
                    : null,
            })),
        );
    },
});

export const getTopicVideo = query({
    args: { videoId: v.id("topicVideos") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) return null;
        const row = await ctx.db.get(args.videoId);
        if (!row || row.userId !== userId) return null;
        return {
            _id: row._id,
            status: row.status as VideoStatus,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            durationSeconds: row.durationSeconds,
            errorMessage: row.errorMessage,
            videoUrl: row.videoStorageId
                ? await ctx.storage.getUrl(row.videoStorageId)
                : null,
        };
    },
});
