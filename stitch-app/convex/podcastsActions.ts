"use node";

import { Buffer } from "node:buffer";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const MIMO_API_BASE_URL = "https://api.xiaomimimo.com/v1";
const DEFAULT_HOST_VOICE_MODEL = "aura-2-apollo-en";
const DEFAULT_GUEST_VOICE_MODEL = "aura-2-luna-en";
const DEFAULT_MIMO_HOST_VOICE = "Milo";
const DEFAULT_MIMO_GUEST_VOICE = "Chloe";
const NARRATION_WORDS_PER_MINUTE = 150;
const MAX_TTS_CHARS = 1900; // Deepgram /v1/speak character limit per request.

type TtsProvider = "deepgram" | "mimo";

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

const resolveMimoApiKey = () => {
    const key = String(process.env.MIMO_API_KEY || "").trim();
    if (!key) {
        throw new Error("MIMO_API_KEY is not configured");
    }
    return key;
};

const resolveTtsProvider = (): TtsProvider => {
    const provider = String(process.env.PODCAST_TTS_PROVIDER || "deepgram").trim().toLowerCase();
    if (provider === "mimo") return "mimo";
    return "deepgram";
};

const resolveVoiceModels = (provider: TtsProvider) => {
    const defaultHostVoiceModel =
        provider === "mimo" ? DEFAULT_MIMO_HOST_VOICE : DEFAULT_HOST_VOICE_MODEL;
    const defaultGuestVoiceModel =
        provider === "mimo" ? DEFAULT_MIMO_GUEST_VOICE : DEFAULT_GUEST_VOICE_MODEL;
    const hostVoiceModel = String(process.env.PODCAST_HOST_VOICE_MODEL || "").trim()
        || defaultHostVoiceModel;
    const guestVoiceModel = String(process.env.PODCAST_GUEST_VOICE_MODEL || "").trim()
        || defaultGuestVoiceModel;
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

const synthesizeDeepgramChunk = async (args: {
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

type WavPcmChunk = {
    sampleRate: number;
    numChannels: number;
    bitsPerSample: number;
    pcmData: Uint8Array;
};

const decodeBase64ToUint8Array = (value: string) =>
    new Uint8Array(Buffer.from(value, "base64"));

const synthesizeMimoChunk = async (args: {
    text: string;
    voiceModel: string;
    apiKey: string;
    timeoutMs: number;
}): Promise<WavPcmChunk> => {
    const response = await fetchWithTimeout(
        `${MIMO_API_BASE_URL}/chat/completions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": args.apiKey,
            },
            body: JSON.stringify({
                model: "mimo-v2.5-tts",
                messages: [
                    {
                        role: "user",
                        content:
                            "Warm, clear educational podcast delivery. Keep it conversational and natural.",
                    },
                    {
                        role: "assistant",
                        content: args.text,
                    },
                ],
                audio: {
                    format: "wav",
                    voice: args.voiceModel,
                },
            }),
        },
        args.timeoutMs,
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const details = JSON.stringify(payload || {}).slice(0, 280);
        throw new Error(`MiMo TTS failed (${response.status}): ${details || "no body"}`);
    }

    const audioData = String(payload?.choices?.[0]?.message?.audio?.data || "").trim();
    if (!audioData) {
        throw new Error("MiMo TTS returned an empty audio payload.");
    }

    const wavBytes = decodeBase64ToUint8Array(audioData);
    return parseWavPcmChunk(wavBytes);
};

const concatenateChunks = (chunks: Uint8Array[]): Uint8Array => {
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

const readAscii = (bytes: Uint8Array, start: number, length: number) =>
    Buffer.from(bytes.slice(start, start + length)).toString("ascii");

const readUint16Le = (bytes: Uint8Array, start: number) =>
    bytes[start] | (bytes[start + 1] << 8);

const readUint32Le = (bytes: Uint8Array, start: number) =>
    (bytes[start])
    | (bytes[start + 1] << 8)
    | (bytes[start + 2] << 16)
    | (bytes[start + 3] << 24);

const parseWavPcmChunk = (bytes: Uint8Array): WavPcmChunk => {
    if (bytes.byteLength < 44 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
        throw new Error("MiMo TTS returned an invalid WAV file.");
    }

    let offset = 12;
    let sampleRate = 0;
    let numChannels = 0;
    let bitsPerSample = 0;
    let pcmData: Uint8Array | null = null;

    while (offset + 8 <= bytes.byteLength) {
        const chunkId = readAscii(bytes, offset, 4);
        const chunkSize = readUint32Le(bytes, offset + 4);
        const chunkStart = offset + 8;
        const chunkEnd = chunkStart + chunkSize;
        if (chunkEnd > bytes.byteLength) {
            throw new Error("MiMo TTS returned a truncated WAV chunk.");
        }

        if (chunkId === "fmt ") {
            const audioFormat = readUint16Le(bytes, chunkStart);
            numChannels = readUint16Le(bytes, chunkStart + 2);
            sampleRate = readUint32Le(bytes, chunkStart + 4);
            bitsPerSample = readUint16Le(bytes, chunkStart + 14);
            if (audioFormat !== 1) {
                throw new Error(`MiMo TTS returned unsupported WAV format ${audioFormat}.`);
            }
        } else if (chunkId === "data") {
            pcmData = bytes.slice(chunkStart, chunkEnd);
        }

        offset = chunkEnd + (chunkSize % 2);
    }

    if (!pcmData || !sampleRate || !numChannels || !bitsPerSample) {
        throw new Error("MiMo TTS returned an incomplete WAV payload.");
    }

    return { sampleRate, numChannels, bitsPerSample, pcmData };
};

const encodeWav = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number) => {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    header.set(Buffer.from("RIFF"), 0);
    view.setUint32(4, 36 + pcmData.byteLength, true);
    header.set(Buffer.from("WAVE"), 8);
    header.set(Buffer.from("fmt "), 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    header.set(Buffer.from("data"), 36);
    view.setUint32(40, pcmData.byteLength, true);

    return concatenateChunks([header, pcmData]);
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

            const provider = resolveTtsProvider();
            const { hostVoiceModel, guestVoiceModel } = resolveVoiceModels(provider);
            const timeoutMs = resolveTtsTimeoutMs();

            const turns = parseDialogueTurns(text);
            if (turns.length === 0) {
                throw new Error("Generated podcast script did not contain valid dialogue turns.");
            }

            const chunks = expandTurnsForTts(turns, MAX_TTS_CHARS);
            if (chunks.length === 0) {
                throw new Error("Failed to chunk podcast dialogue for TTS.");
            }

            let merged: Uint8Array;
            let mimeType: string;
            if (provider === "mimo") {
                const apiKey = resolveMimoApiKey();
                const wavChunks: WavPcmChunk[] = [];
                for (const chunk of chunks) {
                    const audio = await synthesizeMimoChunk({
                        text: chunk.text,
                        voiceModel: chunk.speaker === "HOST" ? hostVoiceModel : guestVoiceModel,
                        apiKey,
                        timeoutMs,
                    });
                    wavChunks.push(audio);
                }
                const firstChunk = wavChunks[0];
                for (const chunk of wavChunks) {
                    if (
                        chunk.sampleRate !== firstChunk.sampleRate
                        || chunk.numChannels !== firstChunk.numChannels
                        || chunk.bitsPerSample !== firstChunk.bitsPerSample
                    ) {
                        throw new Error("MiMo TTS returned mismatched WAV formats across dialogue turns.");
                    }
                }
                const mergedPcm = concatenateChunks(wavChunks.map((chunk) => chunk.pcmData));
                merged = encodeWav(
                    mergedPcm,
                    firstChunk.sampleRate,
                    firstChunk.numChannels,
                    firstChunk.bitsPerSample,
                );
                mimeType = "audio/wav";
            } else {
                const apiKey = resolveDeepgramApiKey();
                const baseUrl = resolveDeepgramBaseUrl();
                const audioChunks: Uint8Array[] = [];
                for (const chunk of chunks) {
                    const audio = await synthesizeDeepgramChunk({
                        text: chunk.text,
                        voiceModel: chunk.speaker === "HOST" ? hostVoiceModel : guestVoiceModel,
                        apiKey,
                        baseUrl,
                        timeoutMs,
                    });
                    audioChunks.push(audio);
                }
                merged = concatenateChunks(audioChunks);
                mimeType = "audio/mpeg";
            }

            const blob = new Blob([merged], { type: mimeType });
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
                voiceModel: `${provider}:${hostVoiceModel}|${guestVoiceModel}`,
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
