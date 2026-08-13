const DEFAULT_BASE = "https://api.deepgram.com";
const DEFAULT_MODEL = "aura-2-thalia-en";
const DEFAULT_MAX_CHARS = 900;

export const isDeepgramSpeakEnabled = () =>
    Boolean(String(process.env.DEEPGRAM_API_KEY || "").trim());

export const getDeepgramSpeakMaxChars = () => {
    const parsed = Number(process.env.DEEPGRAM_MAX_TEXT_CHARS || DEFAULT_MAX_CHARS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHARS;
};

/**
 * Synthesize speech with Deepgram Aura TTS.
 * Returns { buffer, contentType } or throws.
 */
export const callDeepgramSpeak = async (text, options = {}) => {
    const apiKey = String(process.env.DEEPGRAM_API_KEY || "").trim();
    if (!apiKey) {
        const error = new Error("Voice playback is not configured.");
        error.status = 503;
        throw error;
    }

    const spoken = String(text || "").replace(/\s+/g, " ").trim();
    if (!spoken) {
        const error = new Error("No lesson text to read.");
        error.status = 400;
        throw error;
    }

    const maxChars = getDeepgramSpeakMaxChars();
    if (spoken.length > maxChars) {
        const error = new Error("Lesson chunk is too long to read aloud.");
        error.status = 400;
        throw error;
    }

    const base = String(process.env.DEEPGRAM_API_BASE_URL || DEFAULT_BASE)
        .trim()
        .replace(/\/+$/, "");
    const timeoutMs = Number(process.env.DEEPGRAM_TIMEOUT_MS || 20000) || 20000;
    const model = String(
        options.model || process.env.DEEPGRAM_VOICE_MODEL || DEFAULT_MODEL,
    ).trim() || DEFAULT_MODEL;

    const url = new URL(`${base}/v1/speak`);
    url.searchParams.set("model", model);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Token ${apiKey}`,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({ text: spoken }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const error = new Error(
                payload?.err_msg ||
                    payload?.error ||
                    `Voice synthesis failed (${response.status})`,
            );
            error.status = response.status >= 400 && response.status < 600
                ? response.status
                : 502;
            throw error;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length === 0) {
            throw new Error("Voice synthesis returned empty audio.");
        }
        const contentType = String(response.headers.get("content-type") || "audio/mpeg")
            .split(";")[0]
            .trim() || "audio/mpeg";
        return { buffer, contentType };
    } catch (error) {
        if (error?.name === "AbortError") {
            const timeoutError = new Error("Voice is taking too long. Tap Play again.");
            timeoutError.status = 504;
            throw timeoutError;
        }
        const raw = String(error?.message || error?.cause?.message || "");
        if (/terminated|fetch failed|econnreset|und_err|network/i.test(raw)) {
            const wrapped = new Error("Voice is taking too long. Tap Play again.");
            wrapped.status = 504;
            throw wrapped;
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
};
