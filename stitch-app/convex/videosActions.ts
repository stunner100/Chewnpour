"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const MODEL_ID = "bytedance/seedance-2.0";

const DEFAULT_RESOLUTION = "720p";
const DEFAULT_ASPECT_RATIO = "9:16";

const POLL_MAX_ATTEMPTS = 30;
const POLL_BACKOFF_SECONDS = [15, 30, 60];

type VideoStatus = "pending" | "running" | "ready" | "failed";

const requireApiKey = () => {
    const key = process.env.OPENROUTER_VIDEO_API_KEY;
    if (!key) {
        throw new Error("OPENROUTER_VIDEO_API_KEY is not configured");
    }
    return key;
};

const attributionHeaders = () => {
    const headers: Record<string, string> = {};
    const referer = process.env.OPENROUTER_HTTP_REFERER;
    const title = process.env.OPENROUTER_X_TITLE ?? "Stitch (staging)";
    if (referer) headers["HTTP-Referer"] = referer;
    if (title) headers["X-Title"] = title;
    return headers;
};

const mapProviderStatus = (providerStatus: string | undefined | null): VideoStatus => {
    switch ((providerStatus ?? "").toLowerCase()) {
        case "pending":
            return "pending";
        case "in_progress":
            return "running";
        case "completed":
            return "ready";
        case "failed":
        case "cancelled":
        case "expired":
            return "failed";
        default:
            return "running";
    }
};

const computeTokenCount = (width: number, height: number, durationSeconds: number) =>
    Math.round((width * height * durationSeconds * 24) / 1024);

const nextBackoffMs = (attempt: number) => {
    const idx = Math.min(attempt, POLL_BACKOFF_SECONDS.length) - 1;
    return POLL_BACKOFF_SECONDS[Math.max(0, idx)] * 1000;
};

const resolveErrorMessage = (error: unknown, fallback: string) => {
    const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return message ? `${fallback}: ${message}` : fallback;
};

export const kickoff = internalAction({
    args: { videoId: v.id("topicVideos") },
    handler: async (ctx, args) => {
        const row = await ctx.runQuery(internal.videos.getVideoInternal, { videoId: args.videoId });
        if (!row || row.status !== "pending") return;
        try {
            const apiKey = requireApiKey();
            const body = {
                model: MODEL_ID,
                prompt: row.promptText,
                duration: row.durationSeconds,
                resolution: DEFAULT_RESOLUTION,
                aspect_ratio: row.aspectRatio ?? DEFAULT_ASPECT_RATIO,
                generate_audio: false,
            };

            let response: Response;
            try {
                response = await fetch(OPENROUTER_VIDEOS_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        ...attributionHeaders(),
                    },
                    body: JSON.stringify(body),
                });
            } catch (error) {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Network error submitting video job: ${String(
                        error instanceof Error ? error.message : error,
                    )}`,
                });
                return;
            }

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Submit failed (${response.status}): ${text.slice(0, 400)}`,
                });
                return;
            }

            const payload = (await response.json().catch(() => null)) as
                | { id?: string; polling_url?: string; status?: string }
                | null;
            if (!payload?.id) {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: "Submit response missing job id.",
                });
                return;
            }

            await ctx.runMutation(internal.videos.markRunningInternal, {
                videoId: args.videoId,
                providerJobId: payload.id,
                pollingUrl: payload.polling_url,
                providerStatus: payload.status,
            });

            await ctx.scheduler.runAfter(POLL_BACKOFF_SECONDS[0] * 1000, internal.videosActions.poll, {
                videoId: args.videoId,
            });
        } catch (error) {
            await ctx.runMutation(internal.videos.markFailedInternal, {
                videoId: args.videoId,
                errorMessage: resolveErrorMessage(error, "Unexpected kickoff failure"),
            });
        }
    },
});

export const poll = internalAction({
    args: { videoId: v.id("topicVideos") },
    handler: async (ctx, args) => {
        const row = await ctx.runQuery(internal.videos.getVideoInternal, { videoId: args.videoId });
        if (!row) return;
        if (row.status !== "running") return;
        if (!row.providerJobId) {
            await ctx.runMutation(internal.videos.markFailedInternal, {
                videoId: args.videoId,
                errorMessage: "Missing provider job id during poll.",
            });
            return;
        }
        try {
            const apiKey = requireApiKey();
            const attempt = (row.pollAttempts ?? 0) + 1;

            if (attempt > POLL_MAX_ATTEMPTS) {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Timed out after ${POLL_MAX_ATTEMPTS} poll attempts.`,
                });
                return;
            }

            const pollUrl = row.pollingUrl || `${OPENROUTER_VIDEOS_URL}/${row.providerJobId}`;
            let response: Response;
            try {
                response = await fetch(pollUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        ...attributionHeaders(),
                    },
                });
            } catch (error) {
                await ctx.runMutation(internal.videos.recordPollAttemptInternal, {
                    videoId: args.videoId,
                    providerStatus: `network_error:${String(
                        error instanceof Error ? error.message : error,
                    ).slice(0, 80)}`,
                });
                await ctx.scheduler.runAfter(nextBackoffMs(attempt), internal.videosActions.poll, {
                    videoId: args.videoId,
                });
                return;
            }

            if (!response.ok) {
                const text = await response.text().catch(() => "");
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Poll failed (${response.status}): ${text.slice(0, 400)}`,
                });
                return;
            }

            const payload = (await response.json().catch(() => null)) as
                | {
                    id?: string;
                    status?: string;
                    generation_id?: string;
                    unsigned_urls?: string[];
                    usage?: { cost?: number | null };
                    error?: string;
                }
                | null;

            const providerStatus = String(payload?.status ?? "");
            const mapped = mapProviderStatus(providerStatus);

            if (mapped === "failed") {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: payload?.error || `Provider status: ${providerStatus || "unknown"}`,
                    providerStatus,
                });
                return;
            }

            if (mapped !== "ready") {
                await ctx.runMutation(internal.videos.recordPollAttemptInternal, {
                    videoId: args.videoId,
                    providerStatus,
                });
                await ctx.scheduler.runAfter(nextBackoffMs(attempt), internal.videosActions.poll, {
                    videoId: args.videoId,
                });
                return;
            }

            // Ready — download via authenticated /content endpoint (not unsigned_urls).
            const contentUrl = `${OPENROUTER_VIDEOS_URL}/${row.providerJobId}/content?index=0`;
            let contentResponse: Response;
            try {
                contentResponse = await fetch(contentUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        ...attributionHeaders(),
                    },
                });
            } catch (error) {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Download network error: ${String(
                        error instanceof Error ? error.message : error,
                    )}`,
                    providerStatus,
                });
                return;
            }

            if (!contentResponse.ok) {
                const text = await contentResponse.text().catch(() => "");
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: `Download failed (${contentResponse.status}): ${text.slice(0, 400)}`,
                    providerStatus,
                });
                return;
            }

            const contentType = contentResponse.headers.get("content-type") || "video/mp4";
            const arrayBuffer = await contentResponse.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                await ctx.runMutation(internal.videos.markFailedInternal, {
                    videoId: args.videoId,
                    errorMessage: "Downloaded video was empty.",
                    providerStatus,
                });
                return;
            }

            const blob = new Blob([new Uint8Array(arrayBuffer)], { type: contentType });
            const storageId = await ctx.storage.store(blob);

            const tokenCount = computeTokenCount(row.width, row.height, row.durationSeconds);
            const costFromProvider =
                typeof payload?.usage?.cost === "number" ? payload.usage.cost : undefined;

            await ctx.runMutation(internal.videos.markReadyInternal, {
                videoId: args.videoId,
                videoStorageId: storageId,
                providerUrl: Array.isArray(payload?.unsigned_urls) ? payload.unsigned_urls[0] : undefined,
                costUsd: costFromProvider,
                tokenCount,
                providerStatus,
            });
        } catch (error) {
            await ctx.runMutation(internal.videos.markFailedInternal, {
                videoId: args.videoId,
                errorMessage: resolveErrorMessage(error, "Unexpected poll failure"),
            });
        }
    },
});
