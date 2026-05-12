"use node";

import { Buffer } from "node:buffer";

export type AudioTranscriptSegment = {
    index: number;
    text: string;
    startSeconds?: number;
    endSeconds?: number;
};

export type AudioTranscriptionResponse = {
    text: string;
    segments: AudioTranscriptSegment[];
    metadata: Record<string, unknown>;
};

const DEFAULT_DEEPGRAM_BASE_URL = "https://api.deepgram.com";
const DEFAULT_TRANSCRIPTION_MODEL = "nova-2";
const DEFAULT_TIMEOUT_MS = 180_000;

const sanitizeText = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const resolveDeepgramApiKey = () => {
    const key = String(process.env.DEEPGRAM_API_KEY || "").trim();
    if (!key) {
        throw new Error("DEEPGRAM_API_KEY is not configured for recording transcription.");
    }
    return key;
};

const resolveDeepgramBaseUrl = () =>
    String(process.env.DEEPGRAM_API_BASE_URL || DEFAULT_DEEPGRAM_BASE_URL)
        .trim()
        .replace(/\/+$/, "");

const resolveDeepgramTranscriptionModel = () =>
    String(process.env.DEEPGRAM_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL)
        .trim()
        || DEFAULT_TRANSCRIPTION_MODEL;

const resolveDeepgramTranscriptionTimeoutMs = () => {
    const parsed = Number(process.env.DEEPGRAM_TRANSCRIPTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
    return Math.max(10_000, Math.min(600_000, Math.round(parsed)));
};

const extractAlternative = (payload: any) =>
    payload?.results?.channels?.[0]?.alternatives?.[0] || null;

const normalizeParagraphSegments = (alternative: any): AudioTranscriptSegment[] => {
    const rawParagraphs = alternative?.paragraphs?.paragraphs;
    if (!Array.isArray(rawParagraphs)) return [];

    return rawParagraphs
        .map((paragraph: any, index: number) => ({
            index,
            text: sanitizeText(String(paragraph?.text || "")),
            startSeconds: Number.isFinite(Number(paragraph?.start))
                ? Number(paragraph.start)
                : undefined,
            endSeconds: Number.isFinite(Number(paragraph?.end))
                ? Number(paragraph.end)
                : undefined,
        }))
        .filter((segment) => Boolean(segment.text));
};

export const callDeepgramAudioTranscription = async (args: {
    fileName: string;
    contentType: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
}): Promise<AudioTranscriptionResponse> => {
    const apiKey = resolveDeepgramApiKey();
    const baseUrl = resolveDeepgramBaseUrl();
    const model = resolveDeepgramTranscriptionModel();
    const timeoutMs = args.timeoutMs || resolveDeepgramTranscriptionTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const searchParams = new URLSearchParams({
        model,
        smart_format: "true",
        punctuate: "true",
        paragraphs: "true",
        utterances: "false",
    });
    const endpoint = `${baseUrl}/v1/listen?${searchParams.toString()}`;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Token ${apiKey}`,
                "Content-Type": args.contentType,
                Accept: "application/json",
            },
            body: Buffer.from(args.fileBuffer),
            signal: controller.signal,
        });

        const responseText = await response.text();
        let payload: any = null;
        try {
            payload = responseText ? JSON.parse(responseText) : null;
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const message = payload?.err_msg || payload?.message || responseText || response.statusText;
            throw new Error(`Deepgram transcription failed (${response.status}): ${String(message).slice(0, 300)}`);
        }

        const alternative = extractAlternative(payload);
        const transcript = sanitizeText(String(alternative?.transcript || ""));
        if (!transcript) {
            throw new Error("Deepgram transcription returned an empty transcript.");
        }

        const paragraphSegments = normalizeParagraphSegments(alternative);
        const segments = paragraphSegments.length > 0
            ? paragraphSegments
            : [{ index: 0, text: transcript }];

        return {
            text: transcript,
            segments,
            metadata: {
                provider: "deepgram",
                model,
                fileName: args.fileName,
                durationSeconds: payload?.metadata?.duration,
                requestId: payload?.metadata?.request_id,
            },
        };
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`Deepgram transcription timed out after ${timeoutMs}ms.`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};
