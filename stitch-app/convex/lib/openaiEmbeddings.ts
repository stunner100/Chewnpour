const OPENAI_EMBEDDINGS_API_KEY = String(process.env.OPENAI_EMBEDDINGS_API_KEY || "").trim();
const OPENAI_EMBEDDINGS_BASE_URL = String(
    process.env.OPENAI_EMBEDDINGS_BASE_URL || "https://api.openai.com/v1"
).trim().replace(/\/+$/, "");
const OPENAI_EMBEDDINGS_MODEL = String(
    process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small"
).trim();
const OPENAI_EMBEDDINGS_TIMEOUT_MS = (() => {
    const parsed = Number(process.env.OPENAI_EMBEDDINGS_TIMEOUT_MS || 20_000);
    if (!Number.isFinite(parsed)) return 20_000;
    return Math.max(2_000, Math.min(60_000, Math.floor(parsed)));
})();

export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
export const OPENAI_EMBEDDINGS_VERSION = "openai-text-embedding-3-small-v1";

const sanitizeEmbeddingInput = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8_000);

const chunk = <T>(items: T[], size: number) => {
    const normalizedSize = Math.max(1, Math.floor(Number(size || 1)));
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += normalizedSize) {
        chunks.push(items.slice(index, index + normalizedSize));
    }
    return chunks;
};

const fetchEmbeddingsBatch = async (inputs: string[]) => {
    if (!OPENAI_EMBEDDINGS_API_KEY) {
        throw new Error("OPENAI_EMBEDDINGS_API_KEY environment variable not set.");
    }

    const sanitizedInputs = inputs.map(sanitizeEmbeddingInput);
    if (sanitizedInputs.length === 0) {
        return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_EMBEDDINGS_TIMEOUT_MS);

    try {
        const response = await fetch(`${OPENAI_EMBEDDINGS_BASE_URL}/embeddings`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_EMBEDDINGS_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: OPENAI_EMBEDDINGS_MODEL,
                input: sanitizedInputs,
                encoding_format: "float",
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`OpenAI embeddings API error: ${response.status} ${errorText}`.trim());
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        if (rows.length !== sanitizedInputs.length) {
            throw new Error("OpenAI embeddings API returned an unexpected embedding count.");
        }

        return rows.map((row: any) => {
            const embedding = Array.isArray(row?.embedding) ? row.embedding : [];
            if (embedding.length !== OPENAI_EMBEDDING_DIMENSIONS) {
                throw new Error(
                    `OpenAI embeddings API returned ${embedding.length} dimensions; expected ${OPENAI_EMBEDDING_DIMENSIONS}.`
                );
            }
            return embedding.map((value: any) => Number(value));
        });
    } finally {
        clearTimeout(timeout);
    }
};

export const isOpenAiEmbeddingsConfigured = () => Boolean(OPENAI_EMBEDDINGS_API_KEY);

export const embedTexts = async (inputs: string[], options?: { batchSize?: number }) => {
    const sanitizedInputs = inputs.map(sanitizeEmbeddingInput);
    const batches = chunk(sanitizedInputs, Math.max(1, Math.min(32, Number(options?.batchSize || 16))));
    const embeddings: number[][] = [];

    for (const batch of batches) {
        const batchEmbeddings = await fetchEmbeddingsBatch(batch);
        embeddings.push(...batchEmbeddings);
    }

    return {
        embeddings,
        model: OPENAI_EMBEDDINGS_MODEL,
        dimensions: OPENAI_EMBEDDING_DIMENSIONS,
    };
};

export const embedText = async (input: string) => {
    const result = await embedTexts([input], { batchSize: 1 });
    return {
        embedding: result.embeddings[0] || [],
        model: result.model,
        dimensions: result.dimensions,
    };
};
