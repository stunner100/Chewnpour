import { Buffer } from "node:buffer";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { getTopicForUser } from "./courses.js";
import { callDeepgramSpeak } from "./deepgramSpeak.js";

const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
};

const readJsonBody = async (req) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
        return req.body;
    }
    if (typeof req.body === "string" && req.body.trim()) {
        return JSON.parse(req.body);
    }
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) return {};
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
};

export const friendlyVoiceErrorMessage = (error) => {
    const raw = String(error?.message || error?.cause?.message || error || "").trim();
    if (/terminated|fetch failed|network|econnreset|und_err|aborted|timed out/i.test(raw)) {
        return "Voice is taking too long. Tap Play again.";
    }
    return raw || "Could not read this lesson aloud.";
};

export const handleTopicVoiceRequest = async (req, res) => {
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "POST") {
        res.setHeader("Allow", "POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    }

    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    const user = session?.user || null;
    if (!user?.id) {
        return sendJson(res, 401, { error: "Unauthorized" });
    }

    const body = await readJsonBody(req);
    const topicId = String(body.topicId || "").trim();
    if (!topicId) {
        return sendJson(res, 400, { error: "topicId is required" });
    }

    const topic = await getTopicForUser(user.id, topicId);
    if (!topic) {
        return sendJson(res, 404, { error: "Topic not found" });
    }

    const { buffer, contentType } = await callDeepgramSpeak(body.text || body.content || "");
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType || "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
};
