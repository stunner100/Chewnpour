const GEMINI_EMBEDDINGS_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_EMBEDDINGS_BASE_URL = String(
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"
).trim().replace(/\/+$/, "");
const GEMINI_EMBEDDINGS_MODEL = String(
    process.env.GEMINI_EMBEDDINGS_MODEL || "gemini-embedding-001"
).trim();
const GEMINI_EMBEDDINGS_TIMEOUT_MS = (() => {
    const parsed = Number(process.env.GEMINI_EMBEDDINGS_TIMEOUT_MS || 20_000);
    if (!Number.isFinite(parsed)) return 20_000;
    return Math.max(2_000, Math.min(60_000, Math.floor(parsed)));
})();

export const GEMINI_EMBEDDING_DIMENSIONS = 1536;
export const GEMINI_EMBEDDINGS_VERSION = "gemini-embedding-001-1536-v1";
type GeminiEmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

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

const fetchEmbedding = async (input: string, taskType: GeminiEmbeddingTaskType) => {
    if (!GEMINI_EMBEDDINGS_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }

    const sanitizedInput = sanitizeEmbeddingInput(input);
    if (!sanitizedInput) {
        return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_EMBEDDINGS_TIMEOUT_MS);

    try {
        const response = await fetch(
            `${GEMINI_EMBEDDINGS_BASE_URL}/models/${encodeURIComponent(
                GEMINI_EMBEDDINGS_MODEL
            )}:embedContent?key=${encodeURIComponent(GEMINI_EMBEDDINGS_API_KEY)}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: `models/${GEMINI_EMBEDDINGS_MODEL}`,
                    content: {
                        parts: [{ text: sanitizedInput }],
                    },
                    taskType,
                    outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
                }),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`Gemini embeddings API error: ${response.status} ${errorText}`.trim());
        }

        const payload = await response.json();
        const embedding = Array.isArray(payload?.embedding?.values) ? payload.embedding.values : [];
        if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
            throw new Error(
                `Gemini embeddings API returned ${embedding.length} dimensions; expected ${GEMINI_EMBEDDING_DIMENSIONS}.`
            );
        }

        return embedding.map((value: any) => Number(value));
    } finally {
        clearTimeout(timeout);
    }
};

export const isGeminiEmbeddingsConfigured = () => Boolean(GEMINI_EMBEDDINGS_API_KEY);

export const embedTexts = async (
    inputs: string[],
    options?: { batchSize?: number; taskType?: GeminiEmbeddingTaskType }
) => {
    const sanitizedInputs = inputs.map(sanitizeEmbeddingInput);
    const batches = chunk(sanitizedInputs, Math.max(1, Math.min(16, Number(options?.batchSize || 8))));
    const embeddings: number[][] = [];
    const taskType = options?.taskType || "RETRIEVAL_DOCUMENT";

    for (const batch of batches) {
        const batchEmbeddings = await Promise.all(batch.map((input) => fetchEmbedding(input, taskType)));
        embeddings.push(...batchEmbeddings);
    }

    return {
        embeddings,
        model: GEMINI_EMBEDDINGS_MODEL,
        dimensions: GEMINI_EMBEDDING_DIMENSIONS,
    };
};

export const embedText = async (input: string, options?: { taskType?: GeminiEmbeddingTaskType }) => {
    const embedding = await fetchEmbedding(input, options?.taskType || "RETRIEVAL_QUERY");
    return {
        embedding,
        model: GEMINI_EMBEDDINGS_MODEL,
        dimensions: GEMINI_EMBEDDING_DIMENSIONS,
    };
};
