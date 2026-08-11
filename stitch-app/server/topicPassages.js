import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import {
    chunkTextForEmbedding,
    embedTexts,
    isGroundedRetrievalEnabled,
    toPgVectorLiteral,
} from "./embeddings.js";

const DEFAULT_TOP_K = 6;

export const indexTopicPassages = async ({
    topicId,
    courseId = null,
    uploadId = null,
    userId,
    content,
}) => {
    if (!isGroundedRetrievalEnabled()) {
        return { indexed: 0, skipped: true, reason: "retrieval_disabled" };
    }
    const chunks = chunkTextForEmbedding(content);
    if (chunks.length === 0) {
        return { indexed: 0, skipped: true, reason: "empty_content" };
    }

    let embeddings;
    try {
        embeddings = await embedTexts(chunks, { inputType: "document" });
    } catch (error) {
        console.warn("[topicPassages] embed failed", {
            topicId,
            message: error?.message || String(error),
        });
        return { indexed: 0, skipped: true, reason: "embed_failed" };
    }

    if (embeddings.length !== chunks.length) {
        return { indexed: 0, skipped: true, reason: "embed_count_mismatch" };
    }

    const db = getPool();
    await db.query(`DELETE FROM topic_passages WHERE topic_id = $1`, [topicId]);

    let indexed = 0;
    for (let index = 0; index < chunks.length; index += 1) {
        const embedding = embeddings[index];
        if (!Array.isArray(embedding)) continue;
        await db.query(
            `INSERT INTO topic_passages (
                id, topic_id, course_id, upload_id, user_id, chunk_index, content, embedding
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector)`,
            [
                nanoid(),
                topicId,
                courseId,
                uploadId,
                userId,
                index,
                chunks[index],
                toPgVectorLiteral(embedding),
            ],
        );
        indexed += 1;
    }

    return { indexed, skipped: false };
};

export const retrievePassagesForTopic = async ({
    topicId,
    userId,
    query,
    k = DEFAULT_TOP_K,
}) => {
    if (!isGroundedRetrievalEnabled()) {
        return { passages: [], skipped: true, reason: "retrieval_disabled" };
    }
    const cleaned = String(query || "").trim();
    if (!cleaned) {
        return { passages: [], skipped: true, reason: "empty_query" };
    }

    let queryEmbedding;
    try {
        const [embedding] = await embedTexts([cleaned], { inputType: "query" });
        queryEmbedding = embedding;
    } catch (error) {
        console.warn("[topicPassages] query embed failed", {
            topicId,
            message: error?.message || String(error),
        });
        return { passages: [], skipped: true, reason: "embed_failed" };
    }

    if (!Array.isArray(queryEmbedding)) {
        return { passages: [], skipped: true, reason: "embed_failed" };
    }

    const db = getPool();
    const limit = Math.max(1, Math.min(20, Number(k) || DEFAULT_TOP_K));
    const result = await db.query(
        `SELECT id, content, chunk_index,
                1 - (embedding <=> $1::vector) AS score
         FROM topic_passages
         WHERE topic_id = $2 AND user_id = $3
         ORDER BY embedding <=> $1::vector
         LIMIT $4`,
        [toPgVectorLiteral(queryEmbedding), topicId, userId, limit],
    );

    return {
        passages: result.rows.map((row) => ({
            id: row.id,
            content: row.content,
            chunkIndex: Number(row.chunk_index || 0),
            score: Number(row.score || 0),
        })),
        skipped: false,
    };
};
