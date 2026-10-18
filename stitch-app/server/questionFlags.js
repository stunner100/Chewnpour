import { nanoid } from "nanoid";
import { getPool } from "./db.js";

export const FLAG_REASONS = ["wrong_answer", "unclear", "not_in_notes", "other"];
const MAX_NOTE_LENGTH = 500;
const ADMIN_LIST_LIMIT = 100;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

/** A student reports one of their own questions. Re-reporting updates it. */
export const flagQuestion = async ({ userId, questionId, reason, note = "" }) => {
    if (!FLAG_REASONS.includes(reason)) throw badRequest("Choose what is wrong with the question");
    const db = getPool();
    const owned = await db.query(
        `SELECT 1 FROM questions WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [String(questionId || ""), userId],
    );
    if (!owned.rowCount) {
        throw Object.assign(new Error("Question not found"), { status: 404 });
    }
    await db.query(
        `INSERT INTO question_flags (id, user_id, question_id, reason, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, question_id) DO UPDATE
         SET reason = EXCLUDED.reason,
             note = EXCLUDED.note,
             status = 'open',
             resolved_by = NULL,
             resolved_at = NULL,
             created_at = NOW()`,
        [nanoid(), userId, questionId, reason, String(note || "").trim().slice(0, MAX_NOTE_LENGTH)],
    );
    return { flagged: true };
};

export const listOpenQuestionFlags = async () => {
    const db = getPool();
    const result = await db.query(
        `SELECT f.id, f.reason, f.note, f.created_at,
                q.id AS question_id, q.prompt, q.options, q.correct_index, q.explanation,
                t.title AS topic_title, c.title AS course_title,
                u.email AS user_email
         FROM question_flags f
         INNER JOIN questions q ON q.id = f.question_id
         LEFT JOIN topics t ON t.id = q.topic_id
         LEFT JOIN courses c ON c.id = q.course_id
         LEFT JOIN "user" u ON u.id = f.user_id
         WHERE f.status = 'open'
         ORDER BY f.created_at DESC
         LIMIT $1`,
        [ADMIN_LIST_LIMIT],
    );
    return result.rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        note: row.note || "",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        questionId: row.question_id,
        prompt: row.prompt,
        options: Array.isArray(row.options) ? row.options : [],
        correctIndex: Number(row.correct_index),
        explanation: row.explanation || "",
        topicTitle: row.topic_title || "",
        courseTitle: row.course_title || "",
        userEmail: row.user_email || "",
    }));
};

/**
 * Admin outcome: "dismissed" keeps the question, "removed" deletes it (which
 * also clears its review rows and flags through the foreign keys).
 */
export const resolveQuestionFlag = async ({ adminId, flagId, outcome }) => {
    if (outcome !== "dismissed" && outcome !== "removed") throw badRequest("Unknown outcome");
    const db = getPool();
    const flag = await db.query(
        `UPDATE question_flags
         SET status = $2, resolved_by = $3, resolved_at = NOW()
         WHERE id = $1 AND status = 'open'
         RETURNING question_id`,
        [String(flagId || ""), outcome, adminId],
    );
    if (!flag.rowCount) {
        throw Object.assign(new Error("Report not found or already resolved"), { status: 404 });
    }
    if (outcome === "removed") {
        await db.query(`DELETE FROM questions WHERE id = $1`, [flag.rows[0].question_id]);
    }
    return { resolved: true, outcome };
};
