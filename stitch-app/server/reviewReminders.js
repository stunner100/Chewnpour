import { nanoid } from "nanoid";
import { Resend } from "resend";
import { getPool } from "./db.js";
import { dueCutoff } from "./reviewSchedule.js";
import {
    REMINDER_KIND,
    buildReviewReminderEmail,
    signUnsubscribeToken,
} from "./reviewReminderEmail.js";

// Daily cron: email students who have spaced reviews due or an exam within a
// week. At most one reminder every ~2 days, never to someone who studied in
// the last 20 hours, and only while their "review reminders" setting is on.
const MIN_HOURS_BETWEEN = 44;
const RECENT_ACTIVITY_HOURS = 20;
const EXAM_WINDOW_DAYS = 7;
const BATCH_SIZE = 100;
const DEFAULT_LIMIT = 500;
const TEST_EMAIL = /(@example\.com|@chewnpour\.test|\+qa-)/i;

const appUrl = () =>
    String(process.env.PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://www.chewnpour.com").replace(/\/+$/, "");

export const loadReminderRecipients = async ({ now = Date.now(), limit = DEFAULT_LIMIT } = {}) => {
    const db = getPool();
    const today = new Date(Math.floor(now / 86400000) * 86400000).toISOString().slice(0, 10);
    const result = await db.query(
        `WITH due AS (
            SELECT user_id, COUNT(*)::int AS due_count
            FROM question_reviews
            WHERE due_at < $1
            GROUP BY user_id
         ),
         exams AS (
            SELECT DISTINCT ON (user_id) user_id, title, exam_date
            FROM courses
            WHERE exam_date >= $2::date AND exam_date <= $2::date + $3::int
            ORDER BY user_id, exam_date ASC
         )
         SELECT u.id, u.email, u.name,
                COALESCE(due.due_count, 0) AS due_count,
                exams.title AS exam_course_title,
                (exams.exam_date - $2::date) AS exam_days_left
         FROM "user" u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN due ON due.user_id = u.id
         LEFT JOIN exams ON exams.user_id = u.id
         WHERE (due.due_count > 0 OR exams.user_id IS NOT NULL)
           AND COALESCE((p.study_preferences->>'dailyReminders')::boolean, true)
           AND NOT EXISTS (
               SELECT 1 FROM email_sends e
               WHERE e.user_id = u.id AND e.kind = $4
                 AND e.sent_at > NOW() - ($5::int * INTERVAL '1 hour')
           )
           AND NOT EXISTS (
               SELECT 1 FROM question_reviews r
               WHERE r.user_id = u.id AND r.last_reviewed_at > NOW() - ($6::int * INTERVAL '1 hour')
           )
           AND NOT EXISTS (
               SELECT 1 FROM quiz_attempts a
               WHERE a.user_id = u.id AND a.created_at > NOW() - ($6::int * INTERVAL '1 hour')
           )
         ORDER BY exams.exam_date ASC NULLS LAST, due.due_count DESC NULLS LAST
         LIMIT $7`,
        [new Date(dueCutoff(now)), today, EXAM_WINDOW_DAYS, REMINDER_KIND, MIN_HOURS_BETWEEN, RECENT_ACTIVITY_HOURS, limit],
    );
    const recipients = result.rows
        .filter((row) => row.email && !TEST_EMAIL.test(row.email))
        .map((row) => ({
            userId: row.id,
            email: row.email,
            name: row.name || "",
            dueCount: Number(row.due_count || 0),
            examCourseTitle: row.exam_course_title || "",
            examDaysLeft: row.exam_days_left == null ? null : Number(row.exam_days_left),
            topics: [],
        }));
    if (!recipients.length) return recipients;

    const topics = await db.query(
        `SELECT qr.user_id, t.title, COUNT(*)::int AS due_count
         FROM question_reviews qr
         INNER JOIN questions q ON q.id = qr.question_id
         INNER JOIN topics t ON t.id = q.topic_id
         WHERE qr.user_id = ANY($1::text[]) AND qr.due_at < $2
         GROUP BY qr.user_id, t.title
         ORDER BY due_count DESC, t.title ASC`,
        [recipients.map((item) => item.userId), new Date(dueCutoff(now))],
    );
    const byUser = new Map(recipients.map((item) => [item.userId, item]));
    for (const row of topics.rows) {
        const recipient = byUser.get(row.user_id);
        if (recipient && recipient.topics.length < 3) {
            recipient.topics.push({ title: row.title || "Untitled topic", dueCount: Number(row.due_count) });
        }
    }
    return recipients;
};

/**
 * Sends one reminder batch. With dryRun (the default unless
 * REVIEW_REMINDERS_ENABLED=true) it only reports who would get an email.
 */
export const runReviewReminders = async ({
    now = Date.now(),
    dryRun = String(process.env.REVIEW_REMINDERS_ENABLED || "").trim() !== "true",
    limit = DEFAULT_LIMIT,
} = {}) => {
    const recipients = await loadReminderRecipients({ now, limit });
    if (dryRun) {
        return { dryRun: true, eligible: recipients.length, sent: 0 };
    }

    const secret = String(process.env.BETTER_AUTH_SECRET || "").trim();
    const from = String(process.env.RESEND_FROM || "").trim();
    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!secret || !from || !apiKey) {
        throw new Error("Review reminders need BETTER_AUTH_SECRET, RESEND_API_KEY and RESEND_FROM");
    }
    const resend = new Resend(apiKey);
    const db = getPool();
    const base = appUrl();
    let sent = 0;
    const failures = [];

    for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
        const batch = recipients.slice(index, index + BATCH_SIZE);
        const messages = batch.map((recipient) => {
            const unsubscribeUrl = `${base}/unsubscribe?type=review_reminders&token=${encodeURIComponent(signUnsubscribeToken(recipient.userId, secret))}`;
            const email = buildReviewReminderEmail(recipient, { appUrl: base, unsubscribeUrl });
            return {
                from,
                to: [recipient.email],
                subject: email.subject,
                text: email.text,
                html: email.html,
                headers: {
                    "List-Unsubscribe": `<${unsubscribeUrl}>`,
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
            };
        });
        const { data, error } = await resend.batch.send(messages);
        if (error) {
            failures.push(error.message || String(error));
            continue;
        }
        const ids = Array.isArray(data?.data) ? data.data.map((item) => item?.id || null) : [];
        await db.query(
            `INSERT INTO email_sends (id, user_id, kind, provider_id)
             SELECT x.id, x.user_id, $1, x.provider_id
             FROM unnest($2::text[], $3::text[], $4::text[]) AS x(id, user_id, provider_id)`,
            [
                REMINDER_KIND,
                batch.map(() => nanoid()),
                batch.map((recipient) => recipient.userId),
                batch.map((_, i) => ids[i] || null),
            ],
        );
        sent += batch.length;
    }

    return { dryRun: false, eligible: recipients.length, sent, failures };
};

/** One-click unsubscribe: turns the review reminder setting off. */
export const disableReviewReminders = async (userId) => {
    const db = getPool();
    await db.query(
        `INSERT INTO profiles (user_id, study_preferences)
         VALUES ($1, '{"dailyReminders": false}'::jsonb)
         ON CONFLICT (user_id) DO UPDATE
         SET study_preferences = COALESCE(profiles.study_preferences, '{}'::jsonb) || '{"dailyReminders": false}'::jsonb,
             updated_at = NOW()`,
        [userId],
    );
    return { unsubscribed: true };
};
