import { getPool } from "./db.js";
import { dueCutoff, nextReviewState } from "./reviewSchedule.js";

const REVIEW_SESSION_SIZE = 10;

const toMs = (value) => (value == null ? null : new Date(value).getTime());

const loadReviewRows = async (db, userId, questionIds) => {
    const result = await db.query(
        `SELECT question_id, box, due_at, lapses
         FROM question_reviews
         WHERE user_id = $1 AND question_id = ANY($2::text[])`,
        [userId, questionIds],
    );
    return new Map(
        result.rows.map((row) => [
            row.question_id,
            { box: Number(row.box), dueAt: toMs(row.due_at), lapses: Number(row.lapses) },
        ]),
    );
};

const saveReviewRows = async (db, userId, updates) => {
    if (!updates.length) return;
    await db.query(
        `INSERT INTO question_reviews (
            user_id, question_id, box, due_at, lapses, last_reviewed_at, updated_at
         )
         SELECT $1, x.question_id, x.box, x.due_at, x.lapses, NOW(), NOW()
         FROM unnest($2::text[], $3::smallint[], $4::timestamptz[], $5::int[])
           AS x(question_id, box, due_at, lapses)
         ON CONFLICT (user_id, question_id) DO UPDATE
         SET box = EXCLUDED.box,
             due_at = EXCLUDED.due_at,
             lapses = EXCLUDED.lapses,
             last_reviewed_at = NOW(),
             updated_at = NOW()`,
        [
            userId,
            updates.map((item) => item.questionId),
            updates.map((item) => item.box),
            updates.map((item) => (item.dueAt == null ? null : new Date(item.dueAt))),
            updates.map((item) => item.lapses),
        ],
    );
};

/**
 * Feed graded answers into the review schedule. Callers pass only answered
 * questions the user owns; skipped questions are not evidence of a miss.
 */
export const recordReviewOutcomes = async (userId, outcomes = [], now = Date.now()) => {
    const latest = new Map();
    for (const outcome of outcomes) {
        const questionId = String(outcome?.questionId || "");
        if (questionId) latest.set(questionId, Boolean(outcome.isCorrect));
    }
    if (!userId || latest.size === 0) return [];

    const db = getPool();
    const existing = await loadReviewRows(db, userId, [...latest.keys()]);
    const updates = [];
    for (const [questionId, isCorrect] of latest) {
        const next = nextReviewState(existing.get(questionId) || null, isCorrect, now);
        if (next) updates.push({ questionId, ...next });
    }
    await saveReviewRows(db, userId, updates);
    return updates;
};

export const getReviewQueueForUser = async (userId, now = Date.now()) => {
    const db = getPool();
    const cutoff = new Date(dueCutoff(now));
    const [summaryResult, questionsResult, topicsResult] = await Promise.all([
        db.query(
            `SELECT
                COUNT(*) FILTER (WHERE due_at < $2)::int AS due_count,
                COUNT(*) FILTER (WHERE due_at >= $2)::int AS upcoming_count,
                MIN(due_at) FILTER (WHERE due_at >= $2) AS next_due_at
             FROM question_reviews
             WHERE user_id = $1 AND due_at IS NOT NULL`,
            [userId, cutoff],
        ),
        db.query(
            `SELECT
                q.id, q.prompt, q.options, q.topic_id, q.course_id,
                t.title AS topic_title,
                c.title AS course_title
             FROM question_reviews qr
             INNER JOIN questions q ON q.id = qr.question_id AND q.user_id = qr.user_id
             LEFT JOIN topics t ON t.id = q.topic_id
             LEFT JOIN courses c ON c.id = q.course_id
             WHERE qr.user_id = $1 AND qr.due_at < $2
             ORDER BY qr.due_at ASC, qr.lapses DESC, qr.question_id ASC
             LIMIT $3`,
            [userId, cutoff, REVIEW_SESSION_SIZE],
        ),
        db.query(
            `SELECT q.topic_id, t.title AS topic_title, COUNT(*)::int AS due_count
             FROM question_reviews qr
             INNER JOIN questions q ON q.id = qr.question_id AND q.user_id = qr.user_id
             LEFT JOIN topics t ON t.id = q.topic_id
             WHERE qr.user_id = $1 AND qr.due_at < $2
             GROUP BY q.topic_id, t.title
             ORDER BY due_count DESC, t.title ASC
             LIMIT 3`,
            [userId, cutoff],
        ),
    ]);

    const summary = summaryResult.rows[0] || {};
    return {
        dueCount: Number(summary.due_count || 0),
        upcomingCount: Number(summary.upcoming_count || 0),
        nextDueAt: toMs(summary.next_due_at),
        sessionSize: REVIEW_SESSION_SIZE,
        topics: topicsResult.rows.map((row) => ({
            topicId: row.topic_id,
            topicTitle: row.topic_title || "Untitled topic",
            dueCount: Number(row.due_count || 0),
        })),
        // No correct index here: answers are graded one at a time on the server.
        questions: questionsResult.rows.map((row) => ({
            id: row.id,
            prompt: row.prompt,
            options: Array.isArray(row.options) ? row.options : [],
            topicId: row.topic_id,
            courseId: row.course_id,
            topicTitle: row.topic_title || "",
            courseTitle: row.course_title || "",
        })),
    };
};

export const answerReviewQuestion = async ({ userId, questionId, selectedIndex, now = Date.now() }) => {
    const db = getPool();
    const result = await db.query(
        `SELECT id, correct_index, explanation
         FROM questions
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [String(questionId || ""), userId],
    );
    const question = result.rows[0];
    if (!question) {
        const error = new Error("Question not found");
        error.status = 404;
        throw error;
    }
    const selected = Number(selectedIndex);
    if (!Number.isInteger(selected) || selected < 0) {
        const error = new Error("selectedIndex is required");
        error.status = 400;
        throw error;
    }

    const correctIndex = Number(question.correct_index);
    const isCorrect = selected === correctIndex;
    const [update] = await recordReviewOutcomes(userId, [{ questionId: question.id, isCorrect }], now);
    return {
        questionId: question.id,
        isCorrect,
        correctIndex,
        explanation: question.explanation || "",
        box: update ? update.box : null,
        nextDueAt: update ? update.dueAt : null,
        graduated: Boolean(update && update.dueAt == null),
    };
};
