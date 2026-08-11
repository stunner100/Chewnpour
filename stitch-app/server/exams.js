import { nanoid } from "nanoid";
import { getPool } from "./db.js";

const DEFAULT_QUESTION_LIMIT = 20;
const SECONDS_PER_QUESTION = 60;
const MAX_DURATION_SECONDS = 45 * 60;
const GRACE_SECONDS = 15;

const toPlayableQuestion = (row) => {
    if (!row) return null;
    let options = row.options;
    if (typeof options === "string") {
        try {
            options = JSON.parse(options);
        } catch {
            options = [];
        }
    }
    if (!Array.isArray(options)) options = [];
    return {
        id: row.id,
        topicId: row.topic_id,
        courseId: row.course_id,
        prompt: row.prompt,
        options,
        sortOrder: Number(row.sort_order || 0),
    };
};

const parseOptions = (raw) => {
    let options = raw;
    if (typeof options === "string") {
        try {
            options = JSON.parse(options);
        } catch {
            options = [];
        }
    }
    return Array.isArray(options) ? options : [];
};

const toReviewItems = (orderedQuestions, answers = {}) =>
    orderedQuestions.map((row) => {
        const options = parseOptions(row.options);
        const selectedRaw = answers?.[row.id];
        const selectedIndex =
            selectedRaw == null || selectedRaw === ""
                ? null
                : Number(selectedRaw);
        const correctIndex = Number(row.correct_index);
        const isCorrect =
            Number.isFinite(selectedIndex) && selectedIndex === correctIndex;
        return {
            questionId: row.id,
            prompt: row.prompt,
            options,
            selectedIndex: Number.isFinite(selectedIndex) ? selectedIndex : null,
            correctIndex: Number.isFinite(correctIndex) ? correctIndex : null,
            isCorrect,
        };
    });


const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const getCourseOwnedByUser = async (userId, courseId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM courses WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [courseId, userId],
    );
    return result.rows[0] || null;
};

export const startExamForCourse = async ({
    userId,
    courseId,
    questionLimit = DEFAULT_QUESTION_LIMIT,
}) => {
    const course = await getCourseOwnedByUser(userId, courseId);
    if (!course) {
        const error = new Error("Course not found");
        error.status = 404;
        throw error;
    }

    const db = getPool();
    const questionsResult = await db.query(
        `SELECT q.*
         FROM questions q
         INNER JOIN topics t ON t.id = q.topic_id
         WHERE q.course_id = $1
           AND q.user_id = $2
           AND COALESCE(jsonb_array_length(q.options), 0) >= 2
         ORDER BY t.sort_order ASC, q.sort_order ASC, q.id ASC`,
        [courseId, userId],
    );

    if (questionsResult.rows.length === 0) {
        const error = new Error(
            "This course has no quiz-ready questions yet. Open a topic quiz first or re-process the upload.",
        );
        error.status = 400;
        throw error;
    }

    const limit = Math.max(
        1,
        Math.min(
            Number(questionLimit) || DEFAULT_QUESTION_LIMIT,
            questionsResult.rows.length,
            DEFAULT_QUESTION_LIMIT,
        ),
    );
    const selected = shuffle(questionsResult.rows).slice(0, limit);
    const questionIds = selected.map((row) => row.id);
    const durationSeconds = Math.min(
        MAX_DURATION_SECONDS,
        Math.max(SECONDS_PER_QUESTION, questionIds.length * SECONDS_PER_QUESTION),
    );
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const examId = nanoid();

    await db.query(
        `INSERT INTO exam_attempts (
            id, user_id, course_id, question_ids, answers, total_questions,
            started_at, ends_at, status
         ) VALUES ($1,$2,$3,$4::jsonb,'{}'::jsonb,$5,$6,$7,'in_progress')`,
        [
            examId,
            userId,
            courseId,
            JSON.stringify(questionIds),
            questionIds.length,
            startedAt.toISOString(),
            endsAt.toISOString(),
        ],
    );

    return {
        id: examId,
        courseId,
        courseTitle: course.title,
        status: "in_progress",
        startedAt: startedAt.getTime(),
        endsAt: endsAt.getTime(),
        durationSeconds,
        totalQuestions: questionIds.length,
        questions: selected.map(toPlayableQuestion),
    };
};

export const getExamAttemptForUser = async (userId, examId) => {
    const db = getPool();
    const attemptResult = await db.query(
        `SELECT ea.*, c.title AS course_title
         FROM exam_attempts ea
         INNER JOIN courses c ON c.id = ea.course_id
         WHERE ea.id = $1 AND ea.user_id = $2
         LIMIT 1`,
        [examId, userId],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) {
        const error = new Error("Exam not found");
        error.status = 404;
        throw error;
    }

    const questionIds = Array.isArray(attempt.question_ids)
        ? attempt.question_ids
        : JSON.parse(attempt.question_ids || "[]");

    const questionsResult = await db.query(
        `SELECT * FROM questions
         WHERE user_id = $1 AND id = ANY($2::text[])`,
        [userId, questionIds],
    );
    const byId = new Map(questionsResult.rows.map((row) => [row.id, row]));
    const ordered = questionIds.map((id) => byId.get(id)).filter(Boolean);

    const payload = {
        id: attempt.id,
        courseId: attempt.course_id,
        courseTitle: attempt.course_title,
        status: attempt.status,
        startedAt: attempt.started_at
            ? new Date(attempt.started_at).getTime()
            : null,
        endsAt: attempt.ends_at ? new Date(attempt.ends_at).getTime() : null,
        submittedAt: attempt.submitted_at
            ? new Date(attempt.submitted_at).getTime()
            : null,
        totalQuestions: Number(attempt.total_questions || ordered.length),
        durationSeconds: attempt.ends_at && attempt.started_at
            ? Math.max(
                0,
                Math.round(
                    (new Date(attempt.ends_at).getTime() -
                        new Date(attempt.started_at).getTime()) /
                        1000,
                ),
            )
            : null,
        questions: ordered.map(toPlayableQuestion),
    };

    if (attempt.status === "submitted" || attempt.status === "expired") {
        payload.score = attempt.score == null ? null : Number(attempt.score);
        payload.correctCount = Number(attempt.correct_count || 0);
        payload.answers =
            typeof attempt.answers === "object" && attempt.answers
                ? attempt.answers
                : {};
        payload.review = toReviewItems(ordered, payload.answers);
    }

    return payload;
};

export const submitExamAttempt = async ({ userId, examId, answers = {} }) => {
    const db = getPool();
    const attemptResult = await db.query(
        `SELECT * FROM exam_attempts WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [examId, userId],
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) {
        const error = new Error("Exam not found");
        error.status = 404;
        throw error;
    }
    if (attempt.status === "submitted") {
        return getExamAttemptForUser(userId, examId);
    }

    const now = Date.now();
    const endsAtMs = attempt.ends_at
        ? new Date(attempt.ends_at).getTime()
        : now;
    if (now > endsAtMs + GRACE_SECONDS * 1000) {
        await db.query(
            `UPDATE exam_attempts
             SET status = 'expired', updated_at = NOW()
             WHERE id = $1 AND user_id = $2 AND status = 'in_progress'`,
            [examId, userId],
        );
        const error = new Error("Exam time is up. This attempt can no longer be submitted.");
        error.status = 400;
        error.code = "EXAM_EXPIRED";
        throw error;
    }

    const questionIds = Array.isArray(attempt.question_ids)
        ? attempt.question_ids
        : JSON.parse(attempt.question_ids || "[]");
    const questionsResult = await db.query(
        `SELECT id, correct_index FROM questions
         WHERE user_id = $1 AND id = ANY($2::text[])`,
        [userId, questionIds],
    );
    const correctById = new Map(
        questionsResult.rows.map((row) => [row.id, Number(row.correct_index)]),
    );

    let correctCount = 0;
    const normalizedAnswers = {};
    for (const questionId of questionIds) {
        const raw = answers?.[questionId];
        const selected =
            raw == null || raw === ""
                ? null
                : Number(raw);
        normalizedAnswers[questionId] = Number.isFinite(selected) ? selected : null;
        if (
            Number.isFinite(selected) &&
            selected === correctById.get(questionId)
        ) {
            correctCount += 1;
        }
    }

    const total = questionIds.length || 1;
    const score = Math.round((correctCount / total) * 1000) / 10;

    await db.query(
        `UPDATE exam_attempts
         SET answers = $3::jsonb,
             score = $4,
             correct_count = $5,
             submitted_at = NOW(),
             status = 'submitted',
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [
            examId,
            userId,
            JSON.stringify(normalizedAnswers),
            score,
            correctCount,
        ],
    );

    return getExamAttemptForUser(userId, examId);
};
