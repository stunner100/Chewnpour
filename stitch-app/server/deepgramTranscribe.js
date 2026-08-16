const DEFAULT_BASE = "https://api.deepgram.com";

export const isDeepgramTranscribeEnabled = () =>
    Boolean(String(process.env.DEEPGRAM_API_KEY || "").trim());

export const isAudioUploadType = ({
    fileType = "",
    contentType = "",
    fileName = "",
} = {}) => {
    const source = `${fileType} ${contentType} ${fileName}`.toLowerCase();
    return /\b(mp3|m4a|wav|webm|ogg|aac|flac|mpeg|audio)\b/.test(source)
        || /\.(mp3|m4a|wav|webm|ogg|aac|flac)\b/.test(source);
};

/**
 * Transcribe audio bytes with Deepgram listen API.
 * Returns { text, skipped, reason?, backend, parser, durationSeconds, warnings }.
 */
export const callDeepgramTranscribe = async ({
    fileBuffer,
    contentType = "audio/mpeg",
    fileName = "audio.mp3",
} = {}) => {
    const apiKey = String(process.env.DEEPGRAM_API_KEY || "").trim();
    if (!apiKey) {
        return {
            text: "",
            skipped: true,
            reason: "missing_deepgram_env",
            backend: "deepgram",
            parser: "listen",
            durationSeconds: null,
            warnings: [],
        };
    }

    const buffer = Buffer.from(fileBuffer || []);
    if (buffer.length === 0) {
        throw new Error("Deepgram error: empty audio buffer");
    }

    const base = String(process.env.DEEPGRAM_API_BASE_URL || DEFAULT_BASE)
        .trim()
        .replace(/\/+$/, "");
    const timeoutMs = Number(process.env.DEEPGRAM_TIMEOUT_MS || 120000) || 120000;
    const model = String(process.env.DEEPGRAM_LISTEN_MODEL || "nova-2").trim() || "nova-2";

    const url = new URL(`${base}/v1/listen`);
    url.searchParams.set("model", model);
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("utterances", "false");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Token ${apiKey}`,
                "Content-Type": contentType || "application/octet-stream",
            },
            body: buffer,
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(
                payload?.err_msg ||
                    payload?.error ||
                    `Deepgram listen failed (${response.status})`,
            );
        }

        const transcript = String(
            payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "",
        ).trim();
        const durationSeconds = Number(payload?.metadata?.duration);
        const warnings = [];
        if (!transcript) {
            warnings.push(`No speech detected in ${fileName || "audio file"}.`);
        }

        return {
            text: transcript,
            skipped: false,
            backend: "deepgram",
            parser: model,
            durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
            warnings,
        };
    } finally {
        clearTimeout(timer);
    }
};
