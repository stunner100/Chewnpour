"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const DEFAULT_HOST_VOICE_MODEL = "aura-asteria-en";
const DEFAULT_GUEST_VOICE_MODEL = "aura-luna-en";
const NARRATION_WORDS_PER_MINUTE = 150;
const MAX_TTS_CHARS = 1900; // Deepgram /v1/speak character limit per request.

const resolveDeepgramApiKey = () => {
    const key = String(process.env.DEEPGRAM_API_KEY || "").trim();
    if (!key) {
        throw new Error("DEEPGRAM_API_KEY is not configured");
    }
    return key;
};

const resolveDeepgramBaseUrl = () =>
    String(process.env.DEEPGRAM_API_BASE_URL || "https://api.deepgram.com")
        .trim()
        .replace(/\/+$/, "");

const resolveVoiceModels = () => {
    const hostVoiceModel = String(process.env.PODCAST_HOST_VOICE_MODEL || "").trim()
        || DEFAULT_HOST_VOICE_MODEL;
    const guestVoiceModel = String(process.env.PODCAST_GUEST_VOICE_MODEL || "").trim()
        || DEFAULT_GUEST_VOICE_MODEL;
    return { hostVoiceModel, guestVoiceModel };
};

const resolveTtsTimeoutMs = () => {
    const parsed = Number(process.env.PODCAST_TTS_TIMEOUT_MS || 60_000);
    if (!Number.isFinite(parsed)) return 60_000;
    return Math.max(5_000, Math.min(180_000, Math.round(parsed)));
};

const resolveErrorMessage = (error: unknown, fallback: string): string => {
    const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return message ? `${fallback}: ${message}` : fallback;
};

type SpeakerName = "HOST" | "GUEST";

type DialogueTurn = {
    speaker: SpeakerName;
    text: string;
};

// Split text into chunks small enough for the TTS provider while preferring
// sentence boundaries so each chunk reads cleanly on its own.
const splitTextForTts = (script: string, maxChars: number): string[] => {
    const trimmed = String(script || "").trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxChars) return [trimmed];

    const sentences = trimmed
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);

    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
        if (sentence.length > maxChars) {
            // Force-split a single oversized sentence on word boundaries.
            if (current) {
                chunks.push(current);
                current = "";
            }
            let remaining = sentence;
            while (remaining.length > maxChars) {
                let cut = remaining.lastIndexOf(" ", maxChars);
                if (cut <= 0) cut = maxChars;
                chunks.push(remaining.slice(0, cut).trim());
                remaining = remaining.slice(cut).trim();
            }
            if (remaining) {
                current = remaining;
            }
            continue;
        }
        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length > maxChars) {
            chunks.push(current);
            current = sentence;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
};

const parseDialogueTurns = (script: string): DialogueTurn[] => {
    const turns: DialogueTurn[] = [];
    const speakerPattern = /^(HOST|GUEST)\s*:\s*(.+)$/i;
    let current: DialogueTurn | null = null;

    for (const rawLine of String(script || "").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        const speakerMatch = line.match(speakerPattern);
        if (speakerMatch) {
            if (current?.text) {
                turns.push(current);
            }
            current = {
                speaker: speakerMatch[1].toUpperCase() as SpeakerName,
                text: speakerMatch[2].trim(),
            };
            continue;
        }

        if (current) {
            current.text = `${current.text} ${line}`.trim();
        }
    }

    if (current?.text) {
        turns.push(current);
    }

    return turns.filter((turn) => turn.text.length > 0);
};

const expandTurnsForTts = (turns: DialogueTurn[], maxChars: number) =>
    turns.flatMap((turn) =>
        splitTextForTts(turn.text, maxChars).map((text) => ({
            speaker: turn.speaker,
            text,
        })),
    );

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const synthesizeChunk = async (args: {
    text: string;
    voiceModel: string;
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
}): Promise<Uint8Array> => {
    const endpoint =
        `${args.baseUrl}/v1/speak?model=${encodeURIComponent(args.voiceModel)}&encoding=mp3`;
    const response = await fetchWithTimeout(
        endpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${args.apiKey}`,
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({ text: args.text }),
        },
        args.timeoutMs,
    );

    if (!response.ok || !response.body) {
        const details = await response.text().catch(() => "");
        throw new Error(
            `Deepgram TTS failed (${response.status}): ${details.slice(0, 280) || "no body"}`,
        );
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error("Deepgram TTS returned an empty audio response.");
    }
    return new Uint8Array(arrayBuffer);
};

const concatenateMp3Chunks = (chunks: Uint8Array[]): Uint8Array => {
    if (chunks.length === 0) return new Uint8Array();
    if (chunks.length === 1) return chunks[0];
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return merged;
};

export const kickoff = internalAction({
    args: { podcastId: v.id("topicPodcasts") },
    handler: async (ctx, args) => {
        const row = await ctx.runQuery(internal.podcasts.getPodcastInternal, {
            podcastId: args.podcastId,
        });
        if (!row || row.status !== "pending") return;

        const attemptStartedAt = row.startedAt;
        const runningResult = await ctx.runMutation(internal.podcasts.markRunningInternal, {
            podcastId: args.podcastId,
            expectedStartedAt: attemptStartedAt,
        });
        if (!runningResult?.updated) return;

        try {
            const script = await ctx.runAction(internal.ai.generatePodcastScriptInternal, {
                topicId: row.topicId,
                targetWordCount: row.targetWordCount,
            });

            const text = String(script?.script || "").trim();
            if (!text) {
                throw new Error("Generated podcast script was empty.");
            }

            const apiKey = resolveDeepgramApiKey();
            const baseUrl = resolveDeepgramBaseUrl();
            const { hostVoiceModel, guestVoiceModel } = resolveVoiceModels();
            const timeoutMs = resolveTtsTimeoutMs();

            const turns = parseDialogueTurns(text);
            if (turns.length === 0) {
                throw new Error("Generated podcast script did not contain valid dialogue turns.");
            }

            const chunks = expandTurnsForTts(turns, MAX_TTS_CHARS);
            if (chunks.length === 0) {
                throw new Error("Failed to chunk podcast dialogue for TTS.");
            }

            const audioChunks: Uint8Array[] = [];
            for (const chunk of chunks) {
                const audio = await synthesizeChunk({
                    text: chunk.text,
                    voiceModel: chunk.speaker === "HOST" ? hostVoiceModel : guestVoiceModel,
                    apiKey,
                    baseUrl,
                    timeoutMs,
                });
                audioChunks.push(audio);
            }

            const merged = concatenateMp3Chunks(audioChunks);
            const blob = new Blob([merged], { type: "audio/mpeg" });
            const audioStorageId = await ctx.storage.store(blob);

            const wordCount = Number(script?.wordCount || 0);
            const durationSeconds = Math.max(
                30,
                Math.round((wordCount / NARRATION_WORDS_PER_MINUTE) * 60),
            );

            await ctx.runMutation(internal.podcasts.markReadyInternal, {
                podcastId: args.podcastId,
                audioStorageId,
                script: text,
                scriptWordCount: wordCount,
                durationSeconds,
                voiceModel: `${hostVoiceModel}|${guestVoiceModel}`,
                qualityWarnings: Array.isArray(script?.qualityWarnings)
                    ? script.qualityWarnings
                    : [],
                expectedStartedAt: attemptStartedAt,
            });
        } catch (error) {
            await ctx.runMutation(internal.podcasts.markFailedInternal, {
                podcastId: args.podcastId,
                errorMessage: resolveErrorMessage(error, "Podcast generation failed"),
                expectedStartedAt: attemptStartedAt,
            });
        }
    },
});
