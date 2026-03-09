import { httpAction } from "./_generated/server";
import { verifyVoiceStreamToken } from "./lib/voiceStreamToken";

const DEEPGRAM_API_BASE_URL = String(process.env.DEEPGRAM_API_BASE_URL || "https://api.deepgram.com")
    .trim()
    .replace(/\/+$/, "");
const DEEPGRAM_API_KEY = String(process.env.DEEPGRAM_API_KEY || "").trim();
const DEEPGRAM_TIMEOUT_MS = (() => {
    const parsed = Number(process.env.DEEPGRAM_TIMEOUT_MS || 45000);
    if (!Number.isFinite(parsed)) return 45000;
    return Math.max(3000, Math.min(120000, Math.round(parsed)));
})();

const buildErrorResponse = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
        },
    });

export const streamTopicVoiceHttp = httpAction(async (_ctx, request) => {
    const requestUrl = new URL(request.url);
    const token = String(requestUrl.searchParams.get("token") || "").trim();
    const verification = await verifyVoiceStreamToken(token);
    if (!verification.ok) {
        return buildErrorResponse(401, "Invalid or expired voice token.");
    }

    if (!DEEPGRAM_API_KEY) {
        return buildErrorResponse(503, "AI voice provider is not configured.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);

    try {
        const { model, text } = verification.payload;
        const endpoint =
            `${DEEPGRAM_API_BASE_URL}/v1/speak?model=${encodeURIComponent(model)}&encoding=mp3`;
        const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${DEEPGRAM_API_KEY}`,
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({ text }),
            signal: controller.signal,
        });

        if (!upstream.ok || !upstream.body) {
            const details = await upstream.text().catch(() => "");
            const errorMessage = details ? details.slice(0, 280) : "No response body";
            console.warn("[VoiceMode] streamTopicVoiceHttp_upstream_failed", {
                status: upstream.status,
                message: errorMessage,
            });
            return buildErrorResponse(502, "AI voice generation failed.");
        }

        const headers = new Headers();
        headers.set("content-type", upstream.headers.get("content-type") || "audio/mpeg");
        headers.set("cache-control", "no-store, max-age=0");
        headers.set("access-control-allow-origin", "*");
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) {
            headers.set("content-length", contentLength);
        }

        return new Response(upstream.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        if (controller.signal.aborted) {
            return buildErrorResponse(504, "AI voice request timed out.");
        }
        const message = error instanceof Error ? error.message : String(error || "");
        console.warn("[VoiceMode] streamTopicVoiceHttp_failed", {
            message,
        });
        return buildErrorResponse(502, "AI voice generation failed.");
    } finally {
        clearTimeout(timeoutId);
    }
});
