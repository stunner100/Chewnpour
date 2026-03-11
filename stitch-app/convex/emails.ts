"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { components } from "./_generated/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Hours of inactivity before a "streak at risk" email is sent. */
const STREAK_AT_RISK_THRESHOLD_HOURS = 20;

/** Minimum hours between sending the same email type to a user. */
const EMAIL_COOLDOWN_HOURS = 20;

const BETTER_AUTH_USER_CHUNK_SIZE = 100;

const APP_NAME = "ChewnPour";
const APP_URL = "https://chewnpour.com";

// ---------------------------------------------------------------------------
// Email templates (HTML string literals)
// ---------------------------------------------------------------------------

const baseLayout = (content: string, unsubscribeUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${APP_NAME}</title>
<style>
  body { margin:0; padding:0; background:#f4f4f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .container { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; margin-top:24px; margin-bottom:24px; }
  .header { background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:32px 24px; text-align:center; }
  .header h1 { color:#ffffff; margin:0; font-size:24px; font-weight:700; }
  .body { padding:32px 24px; color:#374151; font-size:15px; line-height:1.6; }
  .body h2 { color:#111827; font-size:20px; margin-top:0; }
  .cta { display:inline-block; background:#6366f1; color:#ffffff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:15px; margin-top:16px; }
  .cta:hover { background:#4f46e5; }
  .stat-card { background:#f9fafb; border-radius:8px; padding:16px; margin:8px 0; }
  .stat-label { font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; font-weight:600; }
  .stat-value { font-size:24px; font-weight:700; color:#111827; }
  .footer { padding:16px 24px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
  .footer a { color:#6b7280; text-decoration:underline; }
</style>
</head>
<body>
<div class="container">
  <div class="header"><h1>${APP_NAME}</h1></div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>You received this email because you have a ${APP_NAME} account.</p>
    <p><a href="${unsubscribeUrl}">Unsubscribe</a> from these emails.</p>
  </div>
</div>
</body>
</html>`;

const streakAtRiskTemplate = (name: string, streakDays: number, unsubscribeUrl: string) =>
    baseLayout(
        `<h2>Your ${streakDays}-day streak is at risk!</h2>
<p>Hey ${name},</p>
<p>You haven't studied in a while and your <strong>${streakDays}-day streak</strong> is about to break. Just a quick quiz or lesson review is all it takes to keep it alive.</p>
<p>Don't let all that hard work go to waste!</p>
<a href="${APP_URL}/dashboard" class="cta">Continue Studying</a>`,
        unsubscribeUrl,
    );

const streakBrokenTemplate = (name: string, previousStreak: number, unsubscribeUrl: string) =>
    baseLayout(
        `<h2>Your streak has ended</h2>
<p>Hey ${name},</p>
<p>Your <strong>${previousStreak}-day streak</strong> has come to an end. But don't worry -- every expert was once a beginner, and every streak starts with Day 1.</p>
<p>Jump back in now and start building a new one!</p>
<a href="${APP_URL}/dashboard" class="cta">Start a New Streak</a>`,
        unsubscribeUrl,
    );

const weeklySummaryTemplate = (
    name: string,
    stats: {
        topicsStudied: number;
        quizzesTaken: number;
        averageScore: number;
        streakDays: number;
        studyHours: number;
    },
    unsubscribeUrl: string,
) =>
    baseLayout(
        `<h2>Your Weekly Study Summary</h2>
<p>Hey ${name}, here's how your week went:</p>
<div style="display:flex;flex-wrap:wrap;gap:8px;">
  <div class="stat-card" style="flex:1;min-width:120px;">
    <div class="stat-label">Topics Studied</div>
    <div class="stat-value">${stats.topicsStudied}</div>
  </div>
  <div class="stat-card" style="flex:1;min-width:120px;">
    <div class="stat-label">Quizzes Taken</div>
    <div class="stat-value">${stats.quizzesTaken}</div>
  </div>
  <div class="stat-card" style="flex:1;min-width:120px;">
    <div class="stat-label">Avg Score</div>
    <div class="stat-value">${stats.averageScore}%</div>
  </div>
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
  <div class="stat-card" style="flex:1;min-width:120px;">
    <div class="stat-label">Current Streak</div>
    <div class="stat-value">${stats.streakDays} days</div>
  </div>
  <div class="stat-card" style="flex:1;min-width:120px;">
    <div class="stat-label">Study Time</div>
    <div class="stat-value">${stats.studyHours.toFixed(1)}h</div>
  </div>
</div>
${stats.topicsStudied === 0 ? '<p>Looks like you took a break this week. No worries -- jump back in and keep the momentum going!</p>' : '<p>Great progress! Keep it up and you will ace your exams.</p>'}
<a href="${APP_URL}/dashboard" class="cta">Keep Studying</a>`,
        unsubscribeUrl,
    );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

/**
 * Send an email via Resend. Gracefully returns false if the API key is not
 * configured so the system keeps working without Resend in development.
 */
const sendEmailViaResend = async (params: {
    to: string;
    subject: string;
    html: string;
}): Promise<boolean> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn("[emails] RESEND_API_KEY not set -- skipping email send.");
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${APP_NAME} <noreply@chewnpour.com>`,
                to: params.to,
                subject: params.subject,
                html: params.html,
            }),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error("[emails] Resend API error", {
                status: response.status,
                body: body.slice(0, 500),
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error("[emails] Failed to send email", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

const buildUnsubscribeUrl = (token: string, emailType: string) =>
    `${APP_URL}/unsubscribe?token=${encodeURIComponent(token)}&type=${encodeURIComponent(emailType)}`;

// ---------------------------------------------------------------------------
// Streak calculation helper (mirrors profiles.ts getUserStats logic)
// ---------------------------------------------------------------------------

interface StreakInfo {
    streakDays: number;
    lastActivityMs: number;
}

const computeStreakFromAttempts = (
    examAttempts: { _creationTime: number }[],
    conceptAttempts: { _creationTime: number }[],
): StreakInfo => {
    const toDayIndex = (ms: number) => Math.floor(ms / DAY_MS);
    const allTimestamps = [
        ...examAttempts.map((a) => a._creationTime),
        ...conceptAttempts.map((a) => a._creationTime),
    ];

    if (allTimestamps.length === 0) {
        return { streakDays: 0, lastActivityMs: 0 };
    }

    const lastActivityMs = Math.max(...allTimestamps);
    const uniqueDays = new Set(allTimestamps.map(toDayIndex));
    const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

    let streakDays = 0;
    const todayIndex = toDayIndex(Date.now());
    if (todayIndex - sortedDays[0] <= 1) {
        streakDays = 1;
        let prev = sortedDays[0];
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === prev - 1) {
                streakDays++;
                prev = sortedDays[i];
            } else {
                break;
            }
        }
    }

    return { streakDays, lastActivityMs };
};

// ---------------------------------------------------------------------------
// Fetch auth users from Better Auth component (mirrors admin.ts pattern)
// ---------------------------------------------------------------------------

const fetchAuthUsersByIds = async (ctx: any, userIds: string[]) => {
    const normalizedIds = Array.from(
        new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean)),
    );
    if (normalizedIds.length === 0) return [];

    const usersById = new Map<string, any>();
    const idChunks = chunkArray(normalizedIds, BETTER_AUTH_USER_CHUNK_SIZE);

    for (const idChunk of idChunks) {
        const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: "user",
            where: [{ field: "id", operator: "in", value: idChunk }],
            paginationOpts: { cursor: null, numItems: idChunk.length },
        });

        const pageRows = Array.isArray(result?.page) ? result.page : [];
        for (const authUser of pageRows) {
            const id = String(authUser?.id || "").trim();
            if (id) usersById.set(id, authUser);
        }
    }

    return normalizedIds
        .map((id) => usersById.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u));
};

// ---------------------------------------------------------------------------
// Internal actions (scheduled by crons)
// ---------------------------------------------------------------------------

/**
 * Check all users with active streaks. If a user hasn't studied in
 * STREAK_AT_RISK_THRESHOLD_HOURS, send a "streak at risk" email.
 * If the streak is fully broken (>24h), send a "streak broken" email.
 */
export const checkStreaksAndNotify = internalAction({
    args: {},
    handler: async (ctx) => {
        // 1. Fetch all profiles
        const profiles: any[] = await ctx.runQuery(internal.emailHelpers.getAllProfilesForEmail, {});
        if (profiles.length === 0) return { processed: 0, sent: 0 };

        // 2. Collect user IDs and fetch auth users for email addresses
        const userIds = profiles.map((p: any) => String(p.userId));
        const authUsers = await fetchAuthUsersByIds(ctx, userIds);
        const authUsersByUserId = new Map(
            authUsers.map((u: any) => [String(u.id).trim(), u]),
        );

        // 3. Fetch recent email logs to enforce cooldown
        const recentLogs: any[] = await ctx.runQuery(internal.emailHelpers.getRecentEmailLogs, {
            emailTypes: ["streak_at_risk", "streak_broken"],
        });
        const cooldownMap = new Map<string, number>();
        for (const log of recentLogs) {
            const key = `${log.userId}:${log.emailType}`;
            cooldownMap.set(key, Math.max(cooldownMap.get(key) || 0, log.sentAt));
        }

        const now = Date.now();
        let sent = 0;

        for (const profile of profiles) {
            const userId = String(profile.userId);
            const authUser = authUsersByUserId.get(userId);
            const email = String(authUser?.email || "").trim();
            if (!email || !email.includes("@")) continue;

            const prefs = profile.emailPreferences ?? {
                streakReminders: true,
                streakBroken: true,
                weeklySummary: true,
            };

            // Fetch exam + concept attempts for this user
            const { examAttempts, conceptAttempts } = await ctx.runQuery(
                internal.emailHelpers.getUserAttempts,
                { userId },
            );

            const streak = computeStreakFromAttempts(examAttempts, conceptAttempts);
            const hoursSinceActivity = streak.lastActivityMs > 0
                ? (now - streak.lastActivityMs) / HOUR_MS
                : Infinity;

            const displayName = profile.fullName || authUser?.name || email.split("@")[0];

            // --- Streak broken ---
            if (
                streak.streakDays === 0 &&
                (profile.streakDays || 0) >= 2 &&
                hoursSinceActivity >= 24 &&
                hoursSinceActivity < 72 &&
                prefs.streakBroken
            ) {
                const cooldownKey = `${userId}:streak_broken`;
                const lastSent = cooldownMap.get(cooldownKey) || 0;
                if (now - lastSent > EMAIL_COOLDOWN_HOURS * HOUR_MS) {
                    const token = await ctx.runMutation(internal.emailHelpers.ensureUnsubscribeToken, { userId });
                    if (token) {
                        const unsubUrl = buildUnsubscribeUrl(token, "streak_broken");
                        const html = streakBrokenTemplate(displayName, profile.streakDays || 0, unsubUrl);
                        const ok = await sendEmailViaResend({
                            to: email,
                            subject: `Your ${profile.streakDays}-day streak has ended -- start a new one!`,
                            html,
                        });
                        if (ok) {
                            await ctx.runMutation(internal.emailHelpers.logEmailSent, {
                                userId,
                                emailType: "streak_broken",
                            });
                            sent++;
                        }
                    }
                }
                continue; // skip at-risk if broken
            }

            // --- Streak at risk ---
            if (
                streak.streakDays >= 1 &&
                hoursSinceActivity >= STREAK_AT_RISK_THRESHOLD_HOURS &&
                hoursSinceActivity < 48 &&
                prefs.streakReminders
            ) {
                const cooldownKey = `${userId}:streak_at_risk`;
                const lastSent = cooldownMap.get(cooldownKey) || 0;
                if (now - lastSent > EMAIL_COOLDOWN_HOURS * HOUR_MS) {
                    const token = await ctx.runMutation(internal.emailHelpers.ensureUnsubscribeToken, { userId });
                    if (token) {
                        const unsubUrl = buildUnsubscribeUrl(token, "streak_reminders");
                        const html = streakAtRiskTemplate(displayName, streak.streakDays, unsubUrl);
                        const ok = await sendEmailViaResend({
                            to: email,
                            subject: `Your ${streak.streakDays}-day streak is at risk!`,
                            html,
                        });
                        if (ok) {
                            await ctx.runMutation(internal.emailHelpers.logEmailSent, {
                                userId,
                                emailType: "streak_at_risk",
                            });
                            sent++;
                        }
                    }
                }
            }
        }

        console.log(`[emails:checkStreaksAndNotify] Processed ${profiles.length} profiles, sent ${sent} emails.`);
        return { processed: profiles.length, sent };
    },
});

/**
 * Send a weekly study summary to all opted-in users.
 */
export const sendWeeklySummary = internalAction({
    args: {},
    handler: async (ctx) => {
        const profiles: any[] = await ctx.runQuery(internal.emailHelpers.getAllProfilesForEmail, {});
        if (profiles.length === 0) return { processed: 0, sent: 0 };

        const userIds = profiles.map((p: any) => String(p.userId));
        const authUsers = await fetchAuthUsersByIds(ctx, userIds);
        const authUsersByUserId = new Map(
            authUsers.map((u: any) => [String(u.id).trim(), u]),
        );

        const now = Date.now();
        const weekAgoMs = now - 7 * DAY_MS;
        let sent = 0;

        for (const profile of profiles) {
            const userId = String(profile.userId);
            const prefs = profile.emailPreferences ?? {
                streakReminders: true,
                streakBroken: true,
                weeklySummary: true,
            };
            if (!prefs.weeklySummary) continue;

            const authUser = authUsersByUserId.get(userId);
            const email = String(authUser?.email || "").trim();
            if (!email || !email.includes("@")) continue;

            // Fetch attempts
            const { examAttempts, conceptAttempts } = await ctx.runQuery(
                internal.emailHelpers.getUserAttempts,
                { userId },
            );

            // Filter to last 7 days
            const recentExams = examAttempts.filter((a: any) => a._creationTime >= weekAgoMs);
            const recentConcepts = conceptAttempts.filter((a: any) => a._creationTime >= weekAgoMs);

            const topicsStudied = new Set([
                ...recentExams.map((a: any) => a.topicId),
                ...recentConcepts.map((a: any) => a.topicId),
            ]).size;

            const quizzesTaken = recentExams.length + recentConcepts.length;

            let totalScore = 0;
            let totalQuestions = 0;
            for (const a of recentExams) {
                totalScore += a.score;
                totalQuestions += a.totalQuestions;
            }
            for (const a of recentConcepts) {
                totalScore += a.score;
                totalQuestions += a.totalQuestions;
            }
            const averageScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

            const streak = computeStreakFromAttempts(examAttempts, conceptAttempts);
            const displayName = profile.fullName || authUser?.name || email.split("@")[0];

            const token = await ctx.runMutation(internal.emailHelpers.ensureUnsubscribeToken, { userId });
            if (!token) continue;

            const unsubUrl = buildUnsubscribeUrl(token, "weekly_summary");
            const html = weeklySummaryTemplate(displayName, {
                topicsStudied,
                quizzesTaken,
                averageScore,
                streakDays: streak.streakDays,
                studyHours: profile.totalStudyHours || 0,
            }, unsubUrl);

            const ok = await sendEmailViaResend({
                to: email,
                subject: `Your ${APP_NAME} Weekly Study Summary`,
                html,
            });

            if (ok) {
                await ctx.runMutation(internal.emailHelpers.logEmailSent, {
                    userId,
                    emailType: "weekly_summary",
                });
                sent++;
            }
        }

        console.log(`[emails:sendWeeklySummary] Processed ${profiles.length} profiles, sent ${sent} emails.`);
        return { processed: profiles.length, sent };
    },
});
