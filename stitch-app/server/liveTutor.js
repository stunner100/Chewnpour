import process from "node:process";
import { GoogleGenAI } from "@google/genai";
import { nanoid } from "nanoid";
import { getTopicForUser } from "./courses.js";
import { getPool } from "./db.js";
import { lessonSectionsOf } from "./tutorTools.js";

export const LIVE_TUTOR_MAX_EXCERPT = 1200;
export const DEFAULT_GEMINI_LIVE_MODEL = "gemini-3.8-live";
// Ephemeral tokens are only accepted on v1alpha in the current JS SDK.
export const GEMINI_LIVE_API_VERSION = "v1alpha";
export const LIVE_TUTOR_VOICE = "Kore";
export const LIVE_TUTOR_QUESTION_TARGET = 5;
// Gemini bills audio by the minute and the product is free, so each student
// gets a bounded number of short sessions.
export const LIVE_TUTOR_SESSION_MINUTES = 15;
export const DEFAULT_LIVE_TUTOR_HOURLY_LIMIT = 6;
export const DEFAULT_LIVE_TUTOR_DAILY_LIMIT = 15;
export const LIVE_TUTOR_OUTCOMES = ["completed", "ended-early", "disconnected", "error"];

const SKIP_TITLE_PATTERN = /^(quick check|word bank|glossary|self-check|review questions)\b/i;

export const LIVE_TUTOR_CONNECT_CONFIG = {
    responseModalities: ["AUDIO"],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: {
        voiceConfig: {
            prebuiltVoiceConfig: { voiceName: LIVE_TUTOR_VOICE },
        },
    },
};

const flagEnabled = (value, fallback = "false") => {
    const flag = String(value ?? fallback).trim().toLowerCase();
    return !["0", "false", "no", "off", ""].includes(flag);
};

export const isLiveTutorEnabled = () => {
    if (!flagEnabled(process.env.LIVE_TUTOR_ENABLED, "false")) return false;
    return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
};

export const getGeminiLiveModel = () =>
    String(process.env.GEMINI_LIVE_MODEL || DEFAULT_GEMINI_LIVE_MODEL).trim() ||
    DEFAULT_GEMINI_LIVE_MODEL;

const positiveInt = (value, fallback) => {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getLiveTutorLimits = (env = process.env) => ({
    hourly: positiveInt(env.LIVE_TUTOR_HOURLY_LIMIT, DEFAULT_LIVE_TUTOR_HOURLY_LIMIT),
    daily: positiveInt(env.LIVE_TUTOR_DAILY_LIMIT, DEFAULT_LIVE_TUTOR_DAILY_LIMIT),
});

/** Decide whether a student may start another session given recent usage. */
export const checkLiveTutorQuota = ({ hourCount = 0, dayCount = 0, limits = getLiveTutorLimits() } = {}) => {
    if (dayCount >= limits.daily) {
        return {
            allowed: false,
            message: `You've used today's ${limits.daily} oral reviews. Try again tomorrow, or practise with the written quiz.`,
        };
    }
    if (hourCount >= limits.hourly) {
        return {
            allowed: false,
            message: `You've started ${limits.hourly} oral reviews this hour. Take a short break and try again later.`,
        };
    }
    return { allowed: true };
};

export const buildLiveTutorPrompt = ({ title, lesson } = {}) => {
    const lessonTitle = String(title || "Untitled lesson").trim() || "Untitled lesson";
    const sections = lessonSectionsOf({ lesson });
    const lines = [
        "You are ChewnPour's live oral tutor.",
        "Speak and transcribe only in English. Stay in English for the whole review.",
        "RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH.",
        "If you hear Spanish or any other language, treat it as background noise, not a language switch.",
        `The learner just finished this lesson. Ask exactly ${LIVE_TUTOR_QUESTION_TARGET} short spoken questions, one at a time.`,
        "Wait for their spoken answer before asking the next question.",
        "Correct mistakes briefly and encouragingly. Do not lecture the whole lesson.",
        "After the final answer, deliver a 20-second recap on its own that starts with 'Recap:' and invites them to take the written quiz below.",
        "",
        `LESSON TITLE: ${lessonTitle}`,
        "",
        "LESSON SECTIONS:",
    ];

    for (const section of sections) {
        const sectionTitle = String(section.title || "").trim();
        if (!sectionTitle || SKIP_TITLE_PATTERN.test(sectionTitle)) continue;
        lines.push(`- ${sectionTitle}`);
        const excerpt = String(section.content || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, LIVE_TUTOR_MAX_EXCERPT);
        if (excerpt) lines.push(`  Excerpt: ${excerpt}`);
    }

    return lines.join("\n");
};

export const mintLiveTutorSession = async ({ title, lesson } = {}) => {
    const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
        const error = new Error("Live tutor is not enabled");
        error.status = 503;
        throw error;
    }

    const model = getGeminiLiveModel();
    const prompt = buildLiveTutorPrompt({ title, lesson });
    const expireTime = new Date(Date.now() + LIVE_TUTOR_SESSION_MINUTES * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

    const client = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
    });

    try {
        const token = await client.authTokens.create({
            config: {
                uses: 1,
                expireTime,
                newSessionExpireTime,
                liveConnectConstraints: {
                    model,
                    config: {
                        ...LIVE_TUTOR_CONNECT_CONFIG,
                        systemInstruction: { parts: [{ text: prompt }] },
                    },
                },
                httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
            },
        });

        const name = String(token?.name || "").trim();
        if (!name) {
            const error = new Error("Failed to mint live tutor token");
            error.status = 502;
            throw error;
        }

        return {
            token: name,
            model,
            expiresAt: expireTime,
            apiVersion: GEMINI_LIVE_API_VERSION,
            connectConfig: LIVE_TUTOR_CONNECT_CONFIG,
            questionTarget: LIVE_TUTOR_QUESTION_TARGET,
        };
    } catch (error) {
        console.warn("[liveTutor] token mint failed", {
            message: error?.message || String(error),
        });
        if (error?.status) throw error;
        const wrapped = new Error("Failed to mint live tutor token");
        wrapped.status = 502;
        throw wrapped;
    }
};

const tooManyError = (message) => {
    const error = new Error(message);
    error.status = 429;
    error.code = "LIVE_TUTOR_LIMIT";
    return error;
};

/**
 * Reserve a session slot under a per-user lock so parallel requests can't
 * slip past the limit. The slot is released if minting fails.
 */
const reserveLiveTutorSession = async ({ userId, topicId, model }) => {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`live-tutor:${userId}`]);
        const usage = await client.query(
            `SELECT
                count(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour')::int AS hour_count,
                count(*)::int AS day_count
             FROM live_tutor_sessions
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 day'`,
            [userId],
        );
        const quota = checkLiveTutorQuota({
            hourCount: usage.rows[0]?.hour_count || 0,
            dayCount: usage.rows[0]?.day_count || 0,
        });
        if (!quota.allowed) {
            await client.query("ROLLBACK");
            throw tooManyError(quota.message);
        }
        const id = nanoid();
        await client.query(
            `INSERT INTO live_tutor_sessions (id, user_id, topic_id, model) VALUES ($1, $2, $3, $4)`,
            [id, userId, topicId, model],
        );
        await client.query("COMMIT");
        return id;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

export const createLiveTutorSession = async ({ userId, topicId }) => {
    if (!isLiveTutorEnabled()) {
        const error = new Error("Live tutor is not enabled");
        error.status = 503;
        throw error;
    }

    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const sessionId = await reserveLiveTutorSession({
        userId,
        topicId: payload.topic.id || topicId,
        model: getGeminiLiveModel(),
    });
    try {
        const session = await mintLiveTutorSession({
            title: payload.topic.title,
            lesson: payload.topic.lesson,
        });
        return { ...session, sessionId };
    } catch (error) {
        await getPool()
            .query(`DELETE FROM live_tutor_sessions WHERE id = $1`, [sessionId])
            .catch(() => {});
        throw error;
    }
};

/** Record how a session ended (client-reported; only the owner can update). */
export const endLiveTutorSession = async ({ userId, sessionId, outcome, answered }) => {
    const safeOutcome = LIVE_TUTOR_OUTCOMES.includes(outcome) ? outcome : "error";
    const safeAnswered = Math.max(0, Math.min(50, Math.floor(Number(answered) || 0)));
    const result = await getPool().query(
        `UPDATE live_tutor_sessions
         SET ended_at = COALESCE(ended_at, NOW()), outcome = $3, answered = $4
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [String(sessionId || ""), userId, safeOutcome, safeAnswered],
    );
    if (!result.rowCount) {
        const error = new Error("Live tutor session not found");
        error.status = 404;
        throw error;
    }
    return { ended: true };
};
