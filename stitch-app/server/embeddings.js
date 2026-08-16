const DEFAULT_VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_MODEL = "voyage-large-2";
const DEFAULT_DIMS = 1536;

export const isGroundedRetrievalEnabled = () => {
    const flagged = String(process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED || "")
        .trim()
        .toLowerCase();
    const enabledFlag = flagged === "1" || flagged === "true" || flagged === "yes";
    const apiKey = String(process.env.VOYAGE_API_KEY || "").trim();
    return enabledFlag && Boolean(apiKey);
};

export const getEmbeddingDimensions = () =>
    Number(process.env.VOYAGE_EMBEDDING_DIMS || DEFAULT_DIMS) || DEFAULT_DIMS;

/**
 * Embed one or more texts with Voyage.
 * Returns float[][] aligned with input order.
 */
export const embedTexts = async (texts, { inputType = "document" } = {}) => {
    const apiKey = String(process.env.VOYAGE_API_KEY || "").trim();
    if (!apiKey) {
        throw new Error("VOYAGE_API_KEY is not configured");
    }
    const inputs = (Array.isArray(texts) ? texts : [texts])
        .map((text) => String(text || "").trim())
        .filter(Boolean);
    if (inputs.length === 0) return [];

    const model = String(process.env.VOYAGE_EMBEDDINGS_MODEL || DEFAULT_MODEL).trim();
    const timeoutMs =
        Number(process.env.VOYAGE_EMBEDDINGS_TIMEOUT_MS || 20000) || 20000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(DEFAULT_VOYAGE_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input: inputs,
                input_type: inputType,
            }),
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(
                payload?.detail ||
                    payload?.error ||
                    `Voyage embeddings failed (${response.status})`,
            );
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        return data
            .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
            .map((row) => row.embedding)
            .filter((embedding) => Array.isArray(embedding));
    } finally {
        clearTimeout(timer);
    }
};

export const toPgVectorLiteral = (embedding) => {
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("embedding must be a non-empty array");
    }
    return `[${embedding.map((value) => Number(value) || 0).join(",")}]`;
};

/**
 * Split topic content into overlapping chunks for embedding.
 */
export const chunkTextForEmbedding = (rawText, {
    maxChars = 1200,
    overlap = 150,
} = {}) => {
    const text = String(rawText || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    if (text.length <= maxChars) return [text];

    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(text.length, start + maxChars);
        if (end < text.length) {
            const slice = text.slice(start, end);
            const breakAt = Math.max(
                slice.lastIndexOf(". "),
                slice.lastIndexOf("? "),
                slice.lastIndexOf("! "),
                slice.lastIndexOf("; "),
            );
            if (breakAt > Math.floor(maxChars * 0.4)) {
                end = start + breakAt + 1;
            }
        }
        const chunk = text.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= text.length) break;
        start = Math.max(0, end - overlap);
    }
    return chunks;
};
