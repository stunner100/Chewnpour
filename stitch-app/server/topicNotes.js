import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import { getTopicForUser } from "./courses.js";
import { normalizeActivityKind } from "./resumeTarget.js";

const TOPIC_ACTIVITY_KINDS = new Set(["lesson", "quiz", "podcast"]);

const normalizeTopicActivityKind = (value, fallback = "lesson") => {
    const kind = normalizeActivityKind(value, fallback);
    return TOPIC_ACTIVITY_KINDS.has(kind) ? kind : fallback;
};

const toClientNote = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        topicId: row.topic_id,
        content: row.content || "",
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    };
};

const toClientProgress = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        topicId: row.topic_id,
        courseId: row.course_id || null,
        completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
        lastStudiedAt: row.last_studied_at
            ? new Date(row.last_studied_at).getTime()
            : null,
        lastActivityKind: normalizeTopicActivityKind(row.last_activity_kind, "lesson"),
        termsStarred: Array.isArray(row.terms_starred) ? row.terms_starred : [],
        lessonChecks:
            row.lesson_checks && typeof row.lesson_checks === "object" && !Array.isArray(row.lesson_checks)
                ? row.lesson_checks
                : {},
        bestScore:
            row.best_score == null || Number.isNaN(Number(row.best_score))
                ? null
                : Number(row.best_score),
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

export const getTopicNoteForUser = async (userId, topicId) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    if (!topicPayload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const db = getPool();
    const result = await db.query(
        `SELECT * FROM topic_notes
         WHERE user_id = $1 AND topic_id = $2
         LIMIT 1`,
        [userId, topicId],
    );
    return toClientNote(result.rows[0] || null);
};

export const saveTopicNoteForUser = async (userId, topicId, content) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    if (!topicPayload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const normalized = String(content ?? "");
    const db = getPool();
    const existing = await db.query(
        `SELECT id FROM topic_notes
         WHERE user_id = $1 AND topic_id = $2
         LIMIT 1`,
        [userId, topicId],
    );

    if (existing.rows[0]) {
        const updated = await db.query(
            `UPDATE topic_notes
             SET content = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [normalized, existing.rows[0].id],
        );
        return toClientNote(updated.rows[0]);
    }

    const inserted = await db.query(
        `INSERT INTO topic_notes (id, user_id, topic_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [nanoid(), userId, topicId, normalized],
    );
    return toClientNote(inserted.rows[0]);
};

export const getTopicProgressForUser = async (userId, topicId) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    if (!topicPayload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const db = getPool();
    const result = await db.query(
        `SELECT * FROM topic_progress
         WHERE user_id = $1 AND topic_id = $2
         LIMIT 1`,
        [userId, topicId],
    );
    return toClientProgress(result.rows[0] || null);
};

export const upsertTopicProgressForUser = async (userId, topicId, patch = {}) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    if (!topicPayload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const courseId = topicPayload.topic.courseId || null;
    const db = getPool();
    const existing = await db.query(
        `SELECT * FROM topic_progress
         WHERE user_id = $1 AND topic_id = $2
         LIMIT 1`,
        [userId, topicId],
    );

    const nextTerms = Array.isArray(patch.termsStarred)
        ? patch.termsStarred
        : existing.rows[0]?.terms_starred || [];
    const nextLessonChecks =
        patch.lessonChecks && typeof patch.lessonChecks === "object" && !Array.isArray(patch.lessonChecks)
            ? patch.lessonChecks
            : existing.rows[0]?.lesson_checks && typeof existing.rows[0].lesson_checks === "object"
                ? existing.rows[0].lesson_checks
                : {};
    const nextCompletedAt =
        patch.completedAt === undefined
            ? existing.rows[0]?.completed_at || null
            : patch.completedAt
                ? new Date(Number(patch.completedAt) || Date.now())
                : null;
    const nextLastStudiedAt = patch.lastStudiedAt
        ? new Date(Number(patch.lastStudiedAt) || Date.now())
        : new Date();
    const nextActivityKind = normalizeTopicActivityKind(
        patch.lastActivityKind,
        normalizeTopicActivityKind(existing.rows[0]?.last_activity_kind, "lesson"),
    );
    const nextBestScore =
        patch.bestScore === undefined
            ? existing.rows[0]?.best_score ?? null
            : (() => {
                const incoming = Number.isFinite(Number(patch.bestScore))
                    ? Number(patch.bestScore)
                    : null;
                const previous =
                    existing.rows[0]?.best_score == null
                        ? null
                        : Number(existing.rows[0].best_score);
                if (incoming == null) return previous;
                if (previous == null) return incoming;
                return Math.max(previous, incoming);
            })();

    if (existing.rows[0]) {
        const updated = await db.query(
            `UPDATE topic_progress
             SET course_id = $1,
                 completed_at = $2,
                 last_studied_at = $3,
                 last_activity_kind = $4,
                 terms_starred = $5::jsonb,
                 lesson_checks = $6::jsonb,
                 best_score = $7,
                 updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [
                courseId,
                nextCompletedAt,
                nextLastStudiedAt,
                nextActivityKind,
                JSON.stringify(nextTerms),
                JSON.stringify(nextLessonChecks),
                nextBestScore,
                existing.rows[0].id,
            ],
        );
        return toClientProgress(updated.rows[0]);
    }

    const inserted = await db.query(
        `INSERT INTO topic_progress (
            id, user_id, topic_id, course_id, completed_at, last_studied_at, last_activity_kind, terms_starred, lesson_checks, best_score
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
         RETURNING *`,
        [
            nanoid(),
            userId,
            topicId,
            courseId,
            nextCompletedAt,
            nextLastStudiedAt,
            nextActivityKind,
            JSON.stringify(nextTerms),
            JSON.stringify(nextLessonChecks),
            nextBestScore,
        ],
    );
    return toClientProgress(inserted.rows[0]);
};
