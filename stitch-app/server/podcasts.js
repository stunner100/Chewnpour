import { Buffer } from "node:buffer";
import process from "node:process";
import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import { getTopicForUser } from "./courses.js";
import {
    callDeepgramSpeak,
    getDeepgramSpeakMaxChars,
    isDeepgramSpeakEnabled,
} from "./deepgramSpeak.js";
import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import {
    createSignedDownloadUrl,
    getStorageBucket,
    uploadObject,
} from "./supabase.js";

const DEFAULT_HOST_VOICE = "aura-2-apollo-en";
const DEFAULT_GUEST_VOICE = "aura-2-luna-en";
const MAX_SCRIPT_WORDS = 700;
const WORDS_PER_MINUTE = 150;
const SIGNED_URL_TTL_SEC = 60 * 60;

const resolveHostVoice = () =>
    String(process.env.PODCAST_HOST_VOICE_MODEL || DEFAULT_HOST_VOICE).trim() ||
    DEFAULT_HOST_VOICE;
const resolveGuestVoice = () =>
    String(process.env.PODCAST_GUEST_VOICE_MODEL || DEFAULT_GUEST_VOICE).trim() ||
    DEFAULT_GUEST_VOICE;

const countWords = (value) =>
    String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

const splitTextForTts = (script, maxChars) => {
    const trimmed = String(script || "").trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxChars) return [trimmed];

    const chunks = [];
    let remaining = trimmed;
    while (remaining.length > maxChars) {
        let splitIndex = remaining.lastIndexOf(". ", maxChars);
        if (splitIndex < Math.floor(maxChars * 0.4)) {
            splitIndex = remaining.lastIndexOf(" ", maxChars);
        }
        if (splitIndex <= 0) splitIndex = maxChars;
        const includePeriod = remaining[splitIndex] === ".";
        const chunk = remaining
            .slice(0, splitIndex + (includePeriod ? 1 : 0))
            .trim();
        if (chunk) chunks.push(chunk);
        remaining = remaining.slice(splitIndex + (includePeriod ? 1 : 0)).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
};

const parseDialogueTurns = (script) => {
    const turns = [];
    const speakerPattern = /^(HOST|GUEST)\s*:\s*(.+)$/i;
    let current = null;

    for (const rawLine of String(script || "").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const speakerMatch = line.match(speakerPattern);
        if (speakerMatch) {
            if (current?.text) turns.push(current);
            current = {
                speaker: speakerMatch[1].toUpperCase(),
                text: speakerMatch[2].trim(),
            };
            continue;
        }
        if (current) {
            current.text = `${current.text} ${line}`.trim();
        }
    }
    if (current?.text) turns.push(current);
    return turns.filter((turn) => turn.text.length > 0);
};

const capScriptTurns = (turns) => {
    const capped = [];
    let words = 0;
    for (const turn of turns) {
        const turnWords = countWords(turn.text);
        if (words + turnWords > MAX_SCRIPT_WORDS && capped.length >= 2) break;
        if (words + turnWords > MAX_SCRIPT_WORDS) {
            const allowed = Math.max(20, MAX_SCRIPT_WORDS - words);
            const sliced = String(turn.text)
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, allowed)
                .join(" ");
            if (sliced) capped.push({ ...turn, text: sliced });
            break;
        }
        capped.push(turn);
        words += turnWords;
    }
    return capped;
};

const buildFallbackScript = (topic) => {
    const title = String(topic?.title || "this lesson").trim();
    const content = String(topic?.content || "")
        .replace(/[#>*_`]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, MAX_SCRIPT_WORDS - 20)
        .join(" ");
    const chunks = splitTextForTts(content || `Let's review ${title}.`, 420);
    return chunks
        .map((chunk, index) => {
            const speaker = index % 2 === 0 ? "HOST" : "GUEST";
            const opener =
                index === 0
                    ? `Today we are studying ${title}. `
                    : "";
            return `${speaker}: ${opener}${chunk}`;
        })
        .join("\n");
};

const generatePodcastScript = async (topic) => {
    const fallback = buildFallbackScript(topic);
    if (!isCourseAiEnabled()) return fallback;

    try {
        const llm = await callCourseLlmChat({
            messages: [
                {
                    role: "system",
                    content:
                        "You write short educational podcast scripts. " +
                        "Return only lines that start with HOST: or GUEST:. " +
                        "Keep it conversational, accurate to the lesson, and under 700 words.",
                },
                {
                    role: "user",
                    content:
                        `LESSON TITLE: ${topic.title || ""}\n` +
                        `LESSON:\n"""\n${String(topic.content || "").slice(0, 8000)}\n"""`,
                },
            ],
            temperature: 0.4,
            maxTokens: 1800,
        });
        const parsed = parseDialogueTurns(llm?.text || "");
        if (parsed.length >= 2) return llm.text;
        return fallback;
    } catch (error) {
        console.warn("[podcasts] script LLM failed; using fallback", {
            message: error?.message || String(error),
        });
        return fallback;
    }
};

const toClientPodcast = async (row) => {
    if (!row) return null;
    let audioUrl = "";
    if (row.status === "ready" && row.storage_path) {
        try {
            const signed = await createSignedDownloadUrl({
                path: row.storage_path,
                expiresIn: SIGNED_URL_TTL_SEC,
            });
            audioUrl = signed.signedUrl;
        } catch (error) {
            console.warn("[podcasts] signed URL failed", {
                message: error?.message || String(error),
            });
        }
    }
    return {
        id: row.id,
        _id: row.id,
        topicId: row.topic_id,
        courseId: row.course_id,
        topicTitle: row.topic_title || row.topicTitle || "",
        courseTitle: row.course_title || row.courseTitle || "",
        status: row.status,
        durationSeconds: Number(row.duration_seconds || 0),
        scriptWordCount: Number(row.script_word_count || 0),
        voiceModel: row.voice_model || "",
        audioUrl,
        errorMessage: row.status === "failed" ? "Podcast is not ready yet." : "",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

export const listPodcastsForUser = async (userId, { topicId, limit = 20 } = {}) => {
    const db = getPool();
    const params = [userId];
    let topicFilter = "";
    if (topicId) {
        params.push(topicId);
        topicFilter = `AND p.topic_id = $${params.length}`;
    }
    params.push(Math.min(50, Math.max(1, Number(limit) || 20)));
    const result = await db.query(
        `SELECT
            p.*,
            t.title AS topic_title,
            c.title AS course_title
         FROM topic_podcasts p
         LEFT JOIN topics t ON t.id = p.topic_id
         LEFT JOIN courses c ON c.id = p.course_id
         WHERE p.user_id = $1
           ${topicFilter}
         ORDER BY p.created_at DESC
         LIMIT $${params.length}`,
        params,
    );
    return Promise.all(result.rows.map((row) => toClientPodcast(row)));
};

const markPodcast = async (id, fields) => {
    const db = getPool();
    const assignments = ["updated_at = NOW()"];
    const values = [];
    Object.entries(fields).forEach(([key, value]) => {
        values.push(value);
        assignments.push(`${key} = $${values.length}`);
    });
    values.push(id);
    const result = await db.query(
        `UPDATE topic_podcasts
         SET ${assignments.join(", ")}
         WHERE id = $${values.length}
         RETURNING *`,
        values,
    );
    return result.rows[0] || null;
};

export const generatePodcastForTopic = async ({ userId, topicId, force = false }) => {
    if (!isDeepgramSpeakEnabled()) {
        const error = new Error("Voice playback is not configured.");
        error.status = 503;
        throw error;
    }

    const payload = await getTopicForUser(userId, topicId);
    const topic = payload?.topic;
    const course = payload?.course;
    if (!topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const hostVoice = resolveHostVoice();
    const guestVoice = resolveGuestVoice();
    const db = getPool();
    const existing = await db.query(
        `SELECT
            p.*,
            t.title AS topic_title,
            c.title AS course_title
         FROM topic_podcasts p
         LEFT JOIN topics t ON t.id = p.topic_id
         LEFT JOIN courses c ON c.id = p.course_id
         WHERE p.user_id = $1
           AND p.topic_id = $2
           AND p.status IN ('ready', 'pending', 'running', 'failed')
         ORDER BY p.created_at DESC
         LIMIT 1`,
        [userId, topic.id],
    );
    const current = existing.rows[0];
    if (current?.status === "pending" || current?.status === "running") {
        return toClientPodcast(current);
    }
    if (!force && current?.status === "ready") {
        return toClientPodcast(current);
    }

    let id = current?.id || nanoid();
    let row = current;
    if (current?.status === "ready" || current?.status === "failed") {
        row = await markPodcast(id, {
            status: "running",
            started_at: new Date().toISOString(),
            error_message: null,
        });
    } else {
        const insert = await db.query(
            `INSERT INTO topic_podcasts (
                id, user_id, topic_id, course_id, status, started_at
             ) VALUES ($1, $2, $3, $4, 'running', NOW())
             RETURNING *`,
            [id, userId, topic.id, course?.id || topic.courseId || null],
        );
        row = insert.rows[0];
        id = row.id;
    }

    try {
        const script = await generatePodcastScript(topic);
        const turns = capScriptTurns(parseDialogueTurns(script));
        if (turns.length === 0) {
            throw new Error("Could not write a podcast script for this lesson.");
        }

        const maxChars = Math.min(getDeepgramSpeakMaxChars(), 800);
        const audioChunks = [];
        for (const turn of turns) {
            const pieces = splitTextForTts(turn.text, maxChars);
            const model = turn.speaker === "GUEST" ? guestVoice : hostVoice;
            for (const piece of pieces) {
                const spoken = await callDeepgramSpeak(piece, { model });
                audioChunks.push(spoken.buffer);
            }
        }
        if (audioChunks.length === 0) {
            throw new Error("Voice synthesis returned no audio.");
        }

        const audioBuffer = Buffer.concat(audioChunks);
        const storagePath = `${userId}/podcasts/${id}.mp3`;
        const uploaded = await uploadObject({
            path: storagePath,
            body: audioBuffer,
            contentType: "audio/mpeg",
        });
        const spokenScript = turns
            .map((turn) => `${turn.speaker}: ${turn.text}`)
            .join("\n");
        const wordCount = countWords(spokenScript);
        const durationSeconds = Math.max(
            1,
            Math.round((wordCount / WORDS_PER_MINUTE) * 60),
        );

        row = await markPodcast(id, {
            status: "ready",
            script: spokenScript,
            script_word_count: wordCount,
            duration_seconds: durationSeconds,
            voice_model: `deepgram:${hostVoice}|${guestVoice}`,
            storage_bucket: uploaded.bucket || getStorageBucket(),
            storage_path: uploaded.path,
            error_message: null,
        });
        row.topic_title = topic.title;
        row.course_title = course?.title || "";
        return toClientPodcast(row);
    } catch (error) {
        await markPodcast(id, {
            status: "failed",
            error_message: String(error?.message || error || "generation failed").slice(0, 500),
        });
        const wrapped = new Error(
            /terminated|timed out|fetch failed/i.test(String(error?.message || ""))
                ? "Podcast is taking too long. Tap Generate again."
                : "Could not generate this podcast. Try again shortly.",
        );
        wrapped.status = Number(error?.status) || 502;
        throw wrapped;
    }
};
