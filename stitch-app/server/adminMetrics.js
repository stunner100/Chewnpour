import { getPool } from "./db.js";

const RECENT_LIMIT = 25;

const toIso = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toInt = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toCountMap = (rows, key = "status") => {
    const out = {};
    for (const row of rows || []) {
        out[String(row[key] || "unknown")] = toInt(row.count);
    }
    return out;
};

export const getAdminSnapshot = async () => {
    const db = getPool();
    const [
        totalsResult,
        uploadStatusResult,
        courseStatusResult,
        podcastStatusResult,
        examStatusResult,
        dailyUsersResult,
        recentUsersResult,
        recentUploadsResult,
        tutorSessionsResult,
    ] = await Promise.all([
        db.query(`
            SELECT
                (SELECT count(*)::int FROM "user") AS users_total,
                (SELECT count(*)::int FROM "user" WHERE created_at >= NOW() - INTERVAL '1 day') AS users_1d,
                (SELECT count(*)::int FROM "user" WHERE created_at >= NOW() - INTERVAL '7 days') AS users_7d,
                (SELECT count(*)::int FROM profiles WHERE onboarding_completed = TRUE) AS onboarded_users,
                (SELECT count(*)::int FROM uploads) AS uploads_total,
                (SELECT count(*)::int FROM courses) AS courses_total,
                (SELECT count(*)::int FROM topics) AS topics_total,
                (SELECT count(*)::int FROM questions) AS questions_total,
                (SELECT count(*)::int FROM quiz_attempts) AS quiz_attempts_total,
                (SELECT COALESCE(AVG(CASE WHEN total > 0 THEN score::float / total END), 0) FROM quiz_attempts) AS quiz_avg_ratio,
                (SELECT count(*)::int FROM exam_attempts) AS exams_total,
                (SELECT count(*)::int FROM exam_attempts WHERE submitted_at IS NOT NULL) AS exams_submitted,
                (SELECT count(*)::int FROM topic_progress) AS progress_rows,
                (SELECT count(*)::int FROM topic_progress WHERE completed_at IS NOT NULL) AS lessons_completed,
                (SELECT count(*)::int FROM topic_notes) AS notes_total,
                (SELECT count(*)::int FROM topic_podcasts) AS podcasts_total,
                (
                    SELECT count(DISTINCT user_id)::int FROM (
                        SELECT user_id FROM topic_progress
                        WHERE last_studied_at >= NOW() - INTERVAL '7 days'
                        UNION
                        SELECT user_id FROM quiz_attempts
                        WHERE created_at >= NOW() - INTERVAL '7 days'
                        UNION
                        SELECT user_id FROM exam_attempts
                        WHERE created_at >= NOW() - INTERVAL '7 days'
                    ) active_users
                ) AS active_users_7d
        `),
        db.query(
            `SELECT status, count(*)::int AS count FROM uploads GROUP BY status`,
        ),
        db.query(
            `SELECT status, count(*)::int AS count FROM courses GROUP BY status`,
        ),
        db.query(
            `SELECT status, count(*)::int AS count FROM topic_podcasts GROUP BY status`,
        ),
        db.query(
            `SELECT status, count(*)::int AS count FROM exam_attempts GROUP BY status`,
        ),
        db.query(`
            SELECT
                to_char(date_trunc('day', created_at), 'Mon DD') AS label,
                date_trunc('day', created_at) AS day,
                count(*)::int AS value
            FROM "user"
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY 2
            ORDER BY 2
        `),
        db.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                u.created_at,
                p.full_name,
                p.onboarding_completed
            FROM "user" u
            LEFT JOIN profiles p ON p.user_id = u.id
            ORDER BY u.created_at DESC
            LIMIT $1
            `,
            [RECENT_LIMIT],
        ),
        db.query(
            `
            SELECT
                id,
                user_id,
                file_name,
                file_type,
                file_size,
                status,
                processing_step,
                page_count,
                char_count,
                created_at
            FROM uploads
            ORDER BY created_at DESC
            LIMIT $1
            `,
            [RECENT_LIMIT],
        ),
        db.query(`SELECT count(*)::int AS count FROM study_worker_sessions`).catch(() => ({
            rows: [{ count: 0 }],
        })),
    ]);

    const totals = totalsResult.rows[0] || {};
    const quizAvgRatio = Number(totals.quiz_avg_ratio) || 0;

    return {
        generatedAt: new Date().toISOString(),
        overview: {
            usersTotal: toInt(totals.users_total),
            users1d: toInt(totals.users_1d),
            users7d: toInt(totals.users_7d),
            onboardedUsers: toInt(totals.onboarded_users),
            activeUsers7d: toInt(totals.active_users_7d),
            uploadsTotal: toInt(totals.uploads_total),
            coursesTotal: toInt(totals.courses_total),
            topicsTotal: toInt(totals.topics_total),
            tutorSessions: toInt(tutorSessionsResult.rows?.[0]?.count),
            dailyNewUsers: (dailyUsersResult.rows || []).map((row) => ({
                label: String(row.label || ""),
                value: toInt(row.value),
            })),
        },
        learning: {
            quizAttempts: toInt(totals.quiz_attempts_total),
            quizAvgPercent: Math.round(quizAvgRatio * 1000) / 10,
            examsTotal: toInt(totals.exams_total),
            examsSubmitted: toInt(totals.exams_submitted),
            examStatus: toCountMap(examStatusResult.rows),
            progressRows: toInt(totals.progress_rows),
            lessonsCompleted: toInt(totals.lessons_completed),
            notesTotal: toInt(totals.notes_total),
        },
        content: {
            coursesTotal: toInt(totals.courses_total),
            topicsTotal: toInt(totals.topics_total),
            questionsTotal: toInt(totals.questions_total),
            podcastsTotal: toInt(totals.podcasts_total),
            courseStatus: toCountMap(courseStatusResult.rows),
            uploadStatus: toCountMap(uploadStatusResult.rows),
            podcastStatus: toCountMap(podcastStatusResult.rows),
        },
        users: {
            recent: (recentUsersResult.rows || []).map((row) => ({
                id: row.id,
                name: row.full_name || row.name || "",
                email: row.email,
                onboarded: Boolean(row.onboarding_completed),
                createdAt: toIso(row.created_at),
            })),
        },
        uploads: {
            recent: (recentUploadsResult.rows || []).map((row) => ({
                id: row.id,
                userId: row.user_id,
                fileName: row.file_name,
                fileType: row.file_type,
                fileSize: toInt(row.file_size),
                status: row.status,
                processingStep: row.processing_step || "",
                pageCount: row.page_count == null ? null : toInt(row.page_count),
                charCount: row.char_count == null ? null : toInt(row.char_count),
                createdAt: toIso(row.created_at),
            })),
        },
    };
};
