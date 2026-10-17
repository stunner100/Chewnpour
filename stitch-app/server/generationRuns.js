import { nanoid } from "nanoid";
import { getPool } from "./db.js";

// Records one model call in generation_runs. Best-effort: a failed write is
// logged and never fails the call it describes.
export const recordGenerationRun = async (run) => {
    try {
        await getPool().query(
            `INSERT INTO generation_runs (
                id, purpose, label, user_id, course_id, upload_id, topic_id, provider, model,
                outcome, finish_reason, prompt_tokens, completion_tokens, total_tokens, latency_ms, error
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
                nanoid(),
                String(run.purpose || "unspecified").slice(0, 80),
                run.label ? String(run.label).slice(0, 200) : null,
                run.userId || null,
                run.courseId || null,
                run.uploadId || null,
                run.topicId || null,
                run.provider,
                run.model || null,
                run.outcome,
                run.finishReason || null,
                Number.isFinite(run.promptTokens) ? run.promptTokens : null,
                Number.isFinite(run.completionTokens) ? run.completionTokens : null,
                Number.isFinite(run.totalTokens) ? run.totalTokens : null,
                Math.max(0, Math.round(run.latencyMs || 0)),
                run.error ? String(run.error).slice(0, 500) : null,
            ],
        );
    } catch (error) {
        console.warn("[generationRuns] failed to record model call", { message: error?.message || String(error) });
    }
};
