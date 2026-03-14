const VOYAGE_EMBEDDINGS_API_KEY = String(process.env.VOYAGE_API_KEY || "").trim();
const VOYAGE_EMBEDDINGS_BASE_URL = String(
    process.env.VOYAGE_BASE_URL || "https://api.voyageai.com/v1"
).trim().replace(/\/+$/, "");
const VOYAGE_EMBEDDINGS_MODEL = String(
    process.env.VOYAGE_EMBEDDINGS_MODEL || "voyage-large-2"
).trim();
const VOYAGE_EMBEDDINGS_TIMEOUT_MS = (() => {
    const parsed = Number(process.env.VOYAGE_EMBEDDINGS_TIMEOUT_MS || 20_000);
    if (!Number.isFinite(parsed)) return 20_000;
    return Math.max(2_000, Math.min(60_000, Math.floor(parsed)));
})();

export const VOYAGE_EMBEDDING_DIMENSIONS = 1536;
export const VOYAGE_EMBEDDINGS_VERSION = `${VOYAGE_EMBEDDINGS_MODEL}-${VOYAGE_EMBEDDING_DIMENSIONS}-v1`;
type VoyageEmbeddingInputType = "document" | "query";

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

const parseEmbeddingsPayload = (payload: any) => {
    if (Array.isArray(payload?.data)) {
        return payload.data.map((item: any) =>
            Array.isArray(item?.embedding) ? item.embedding.map((value: any) => Number(value)) : []
        );
    }
    if (Array.isArray(payload?.embeddings)) {
        return payload.embeddings.map((embedding: any) =>
            Array.isArray(embedding) ? embedding.map((value: any) => Number(value)) : []
        );
    }
    return [];
};

const fetchEmbeddings = async (inputs: string[], inputType: VoyageEmbeddingInputType) => {
    if (!VOYAGE_EMBEDDINGS_API_KEY) {
        throw new Error("VOYAGE_API_KEY environment variable not set.");
    }

    const sanitizedInputs = inputs.map(sanitizeEmbeddingInput);
    if (sanitizedInputs.length === 0) {
        return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VOYAGE_EMBEDDINGS_TIMEOUT_MS);

    try {
        const response = await fetch(`${VOYAGE_EMBEDDINGS_BASE_URL}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${VOYAGE_EMBEDDINGS_API_KEY}`,
            },
            body: JSON.stringify({
                input: sanitizedInputs,
                model: VOYAGE_EMBEDDINGS_MODEL,
                input_type: inputType,
                truncation: true,
                output_dtype: "float",
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            throw new Error(`Voyage embeddings API error: ${response.status} ${errorText}`.trim());
        }

        const payload = await response.json();
        const embeddings = parseEmbeddingsPayload(payload);
        if (embeddings.length !== sanitizedInputs.length) {
            throw new Error(
                `Voyage embeddings API returned ${embeddings.length} embeddings; expected ${sanitizedInputs.length}.`
            );
        }

        for (const embedding of embeddings) {
            if (embedding.length !== VOYAGE_EMBEDDING_DIMENSIONS) {
                throw new Error(
                    `Voyage embeddings API returned ${embedding.length} dimensions; expected ${VOYAGE_EMBEDDING_DIMENSIONS}.`
                );
            }
        }

        return embeddings;
    } finally {
        clearTimeout(timeout);
    }
};

export const isVoyageEmbeddingsConfigured = () => Boolean(VOYAGE_EMBEDDINGS_API_KEY);

export const embedTexts = async (
    inputs: string[],
    options?: { batchSize?: number; inputType?: VoyageEmbeddingInputType }
) => {
    const sanitizedInputs = inputs.map(sanitizeEmbeddingInput);
    const batches = chunk(sanitizedInputs, Math.max(1, Math.min(64, Number(options?.batchSize || 16))));
    const embeddings: number[][] = [];
    const inputType = options?.inputType || "document";

    for (const batch of batches) {
        const batchEmbeddings = await fetchEmbeddings(batch, inputType);
        embeddings.push(...batchEmbeddings);
    }

    return {
        embeddings,
        model: VOYAGE_EMBEDDINGS_VERSION,
        dimensions: VOYAGE_EMBEDDING_DIMENSIONS,
    };
};

export const embedText = async (input: string, options?: { inputType?: VoyageEmbeddingInputType }) => {
    const embeddings = await fetchEmbeddings([input], options?.inputType || "query");
    return {
        embedding: embeddings[0] || [],
        model: VOYAGE_EMBEDDINGS_VERSION,
        dimensions: VOYAGE_EMBEDDING_DIMENSIONS,
    };
};
