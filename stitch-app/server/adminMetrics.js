import { getPool } from "./db.js";
import { adminSourcesFor } from "./adminAccess.js";
import { loadDashboardAdminIds } from "./adminMembers.js";

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

const SNAPSHOT_TTL_MS = 30_000;
const USER_SEARCH_LIMIT = 50;
const DAILY_WINDOW_DAYS = 14;

// The pool is usually a single connection, so every round trip runs serially.
// Keep the snapshot to a few grouped queries and reuse it briefly.
let cachedSnapshot = null;

const toCountMaps = (rows) => {
    const out = {};
    for (const row of rows || []) {
        const bucket = String(row.kind || "unknown");
        out[bucket] ||= {};
        out[bucket][String(row.status || "unknown")] = toInt(row.count);
    }
    return out;
};

/**
 * One bar per day for the last DAILY_WINDOW_DAYS days (UTC), including days
 * with no sign-ups.
 */
export const fillDailySeries = (rows, { days = DAILY_WINDOW_DAYS, now = new Date() } = {}) => {
    const byDay = new Map();
    for (const row of rows || []) {
        const key = toIso(row.day)?.slice(0, 10);
        if (key) byDay.set(key, toInt(row.value));
    }
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const series = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(today - offset * 86_400_000);
        const key = date.toISOString().slice(0, 10);
        series.push({
            label: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }),
            value: byDay.get(key) || 0,
        });
    }
    return series;
};

/**
 * A student is "active" when they did something: studied a lesson, took a
 * quiz or exam, sent the tutor a message, did a live oral review, or uploaded
 * material. Signing in alone doesn't count.
 */
export const ACTIVITY_CTE = `
    activity AS (
        SELECT user_id, last_studied_at AS at FROM topic_progress
        WHERE last_studied_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT user_id, created_at FROM quiz_attempts WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT user_id, created_at FROM exam_attempts WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT user_id, created_at FROM topic_chat_messages
        WHERE role = 'user' AND created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT user_id, created_at FROM live_tutor_sessions WHERE created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT user_id, created_at FROM uploads WHERE created_at >= NOW() - INTERVAL '30 days'
    )
`;

// Daily new sign-ups and daily active students in one round trip.
export const DAILY_SERIES_SQL = `
    WITH ${ACTIVITY_CTE},
    window_start AS (
        SELECT date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - make_interval(days => $1) AS at
    )
    SELECT 'new' AS kind, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS value
    FROM "user" WHERE created_at >= (SELECT at FROM window_start)
    GROUP BY 2
    UNION ALL
    SELECT 'active', to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), count(DISTINCT user_id)::int
    FROM activity WHERE at >= (SELECT at FROM window_start)
    GROUP BY 2
`;

export const clearAdminSnapshotCache = () => {
    cachedSnapshot = null;
};

export const STATUS_BREAKDOWN_SQL = `
    SELECT 'uploads' AS kind, status, count(*)::int AS count FROM uploads GROUP BY status
    UNION ALL
    SELECT 'courses', status, count(*)::int FROM courses GROUP BY status
    UNION ALL
    SELECT 'podcasts', status, count(*)::int FROM topic_podcasts GROUP BY status
    UNION ALL
    SELECT 'exams',
        CASE WHEN status = 'in_progress' AND ends_at < NOW() THEN 'expired' ELSE status END,
        count(*)::int
    FROM exam_attempts
    GROUP BY 2
`;

// What a student has actually done, replacing the retired onboarding flag.
// "Studied" means opening a lesson (any topic_progress row with activity);
// "quizzed" counts a topic quiz or a submitted timed exam.
const STUDIED_LESSON_SQL = (userColumn) => `EXISTS (
    SELECT 1 FROM topic_progress tp
    WHERE tp.user_id = ${userColumn}
      AND (tp.last_studied_at IS NOT NULL OR tp.completed_at IS NOT NULL)
)`;
const TOOK_QUIZ_SQL = (userColumn) => `(
    EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.user_id = ${userColumn})
    OR EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.user_id = ${userColumn} AND ea.submitted_at IS NOT NULL)
)`;
const UPLOADED_SQL = (userColumn) => `EXISTS (SELECT 1 FROM uploads up WHERE up.user_id = ${userColumn})`;
const USER_MILESTONE_COLUMNS = `
    ${UPLOADED_SQL("u.id")} AS has_uploaded,
    ${STUDIED_LESSON_SQL("u.id")} AS has_studied,
    ${TOOK_QUIZ_SQL("u.id")} AS has_quizzed`;

export const getAdminSnapshot = async ({ fresh = false } = {}) => {
    if (!fresh && cachedSnapshot && Date.now() - cachedSnapshot.at < SNAPSHOT_TTL_MS) {
        return cachedSnapshot.value;
    }
    const value = await loadAdminSnapshot();
    cachedSnapshot = { at: Date.now(), value };
    return value;
};

const loadAdminSnapshot = async () => {
    const db = getPool();
    const [
        totalsResult,
        statusResult,
        dailySeriesResult,
        recentUsersResult,
        recentUploadsResult,
        dashboardAdminIds,
    ] = await Promise.all([
        db.query(`
            WITH ${ACTIVITY_CTE}
            SELECT
                (SELECT count(DISTINCT user_id)::int FROM activity WHERE at >= NOW() - INTERVAL '1 day') AS active_1d,
                (SELECT count(DISTINCT user_id)::int FROM activity WHERE at >= NOW() - INTERVAL '7 days') AS active_7d,
                (SELECT count(DISTINCT user_id)::int FROM activity) AS active_30d,
                (SELECT count(*)::int FROM "user") AS users_total,
                (SELECT count(*)::int FROM "user" WHERE created_at >= NOW() - INTERVAL '1 day') AS users_1d,
                (SELECT count(*)::int FROM "user" WHERE created_at >= NOW() - INTERVAL '7 days') AS users_7d,
                (SELECT count(*)::int FROM "user" u WHERE ${UPLOADED_SQL("u.id")}) AS uploaded_users,
                (SELECT count(*)::int FROM "user" u WHERE ${STUDIED_LESSON_SQL("u.id")}) AS studied_users,
                (SELECT count(*)::int FROM "user" u WHERE ${TOOK_QUIZ_SQL("u.id")}) AS quizzed_users,
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
                (SELECT count(*)::int FROM (SELECT DISTINCT user_id, topic_id FROM topic_chat_messages) chats) AS tutor_conversations,
                (SELECT count(DISTINCT user_id)::int FROM topic_chat_messages) AS tutor_users,
                (SELECT count(*)::int FROM live_tutor_sessions) AS live_sessions_total,
                (SELECT count(*)::int FROM live_tutor_sessions WHERE created_at >= NOW() - INTERVAL '7 days') AS live_sessions_7d,
                (SELECT count(*)::int FROM live_tutor_sessions WHERE outcome = 'completed') AS live_sessions_completed,
                (SELECT count(DISTINCT user_id)::int FROM live_tutor_sessions) AS live_tutor_users,
                (SELECT count(*)::int FROM "user" WHERE created_at >= NOW() - INTERVAL '30 days') AS users_30d
        `),
        db.query(STATUS_BREAKDOWN_SQL),
        db.query(DAILY_SERIES_SQL, [DAILY_WINDOW_DAYS - 1]),
        db.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                u.created_at,
                u.email_verified,
                p.full_name,
                ${USER_MILESTONE_COLUMNS}
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
        loadDashboardAdminIds(),
    ]);

    const statusMaps = toCountMaps(statusResult.rows);
    const totals = totalsResult.rows[0] || {};
    const quizAvgRatio = Number(totals.quiz_avg_ratio) || 0;

    return {
        generatedAt: new Date().toISOString(),
        overview: {
            usersTotal: toInt(totals.users_total),
            users1d: toInt(totals.users_1d),
            users7d: toInt(totals.users_7d),
            users30d: toInt(totals.users_30d),
            uploadedUsers: toInt(totals.uploaded_users),
            studiedUsers: toInt(totals.studied_users),
            quizzedUsers: toInt(totals.quizzed_users),
            active1d: toInt(totals.active_1d),
            active7d: toInt(totals.active_7d),
            active30d: toInt(totals.active_30d),
            uploadsTotal: toInt(totals.uploads_total),
            coursesTotal: toInt(totals.courses_total),
            topicsTotal: toInt(totals.topics_total),
            tutorConversations: toInt(totals.tutor_conversations),
            tutorUsers: toInt(totals.tutor_users),
            liveSessionsTotal: toInt(totals.live_sessions_total),
            liveSessions7d: toInt(totals.live_sessions_7d),
            liveSessionsCompleted: toInt(totals.live_sessions_completed),
            liveTutorUsers: toInt(totals.live_tutor_users),
            dailyNewUsers: fillDailySeries(dailySeriesResult.rows.filter((row) => row.kind === "new")),
            dailyActiveUsers: fillDailySeries(dailySeriesResult.rows.filter((row) => row.kind === "active")),
        },
        learning: {
            quizAttempts: toInt(totals.quiz_attempts_total),
            quizAvgPercent: Math.round(quizAvgRatio * 1000) / 10,
            examsTotal: toInt(totals.exams_total),
            examsSubmitted: toInt(totals.exams_submitted),
            examStatus: statusMaps.exams || {},
            progressRows: toInt(totals.progress_rows),
            lessonsCompleted: toInt(totals.lessons_completed),
            notesTotal: toInt(totals.notes_total),
        },
        content: {
            coursesTotal: toInt(totals.courses_total),
            topicsTotal: toInt(totals.topics_total),
            questionsTotal: toInt(totals.questions_total),
            podcastsTotal: toInt(totals.podcasts_total),
            courseStatus: statusMaps.courses || {},
            uploadStatus: statusMaps.uploads || {},
            podcastStatus: statusMaps.podcasts || {},
        },
        users: {
            recent: (recentUsersResult.rows || []).map((row) => toAdminUser(row, dashboardAdminIds)),
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


const toAdminUser = (row, dashboardAdminIds = new Set()) => {
    const emailVerified = row.email_verified === true;
    return {
        id: row.id,
        name: row.full_name || row.name || "",
        email: row.email,
        emailVerified,
        activity: {
            uploaded: row.has_uploaded === true,
            studied: row.has_studied === true,
            quizzed: row.has_quizzed === true,
        },
        isAdmin: adminSourcesFor({ email: row.email, id: row.id, emailVerified }, dashboardAdminIds).length > 0,
        createdAt: toIso(row.created_at),
    };
};

export const searchAdminUsers = async (query) => {
    const term = String(query || "").trim().slice(0, 120);
    if (!term) return [];
    const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const result = await getPool().query(
        `
        SELECT u.id, u.name, u.email, u.created_at, u.email_verified, p.full_name,
            ${USER_MILESTONE_COLUMNS}
        FROM "user" u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.email ILIKE $1 OR u.name ILIKE $1 OR p.full_name ILIKE $1
        ORDER BY u.created_at DESC
        LIMIT $2
        `,
        [pattern, USER_SEARCH_LIMIT],
    );
    const dashboardAdminIds = await loadDashboardAdminIds();
    return result.rows.map((row) => toAdminUser(row, dashboardAdminIds));
};
