import { fromNodeHeaders } from "better-auth/node";
import { Buffer } from "node:buffer";
import { auth } from "./auth.js";
import {
    disableCourseShare,
    enableCourseShare,
    ensureCourseFromUpload,
    getCourseForUser,
    getPublicCourseByShareToken,
    getQuizAttemptForUser,
    getQuizForTopic,
    getTopicForUser,
    listCoursesForUser,
    submitQuizAttempt,
} from "./courses.js";
import { getPool } from "./db.js";
import {
    askTopicTutor,
    clearTopicChat,
    listTopicChatMessages,
} from "./topicChat.js";
import {
    getTopicNoteForUser,
    getTopicProgressForUser,
    saveTopicNoteForUser,
    upsertTopicProgressForUser,
} from "./topicNotes.js";
import {
    explainTopicSelection,
    reExplainTopicContent,
} from "./topicExplain.js";

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

const requireSessionUser = async (req) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    return session?.user || null;
};

const parsePath = (url = "", prefix) => {
    const pathname = String(url || "").split("?")[0];
    return pathname.replace(prefix, "").split("/").filter(Boolean);
};

const getUploadRowText = async (userId, uploadId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT id, file_name, extracted_text, status
         FROM uploads
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [uploadId, userId],
    );
    return result.rows[0] || null;
};

export const handleCoursesRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parsePath(req.url || "", /^\/api\/courses\/?/);
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 0 && method === "GET") {
            const courses = await listCoursesForUser(user.id);
            return sendJson(res, 200, { courses });
        }

        if (parts.length === 1 && parts[0] === "from-upload" && method === "POST") {
            const body = await readJsonBody(req);
            const uploadId = String(body.uploadId || "").trim();
            if (!uploadId) {
                return sendJson(res, 400, { error: "uploadId is required" });
            }
            const upload = await getUploadRowText(user.id, uploadId);
            if (!upload) {
                return sendJson(res, 404, { error: "Upload not found" });
            }
            if (upload.status !== "ready") {
                return sendJson(res, 400, { error: "Upload is not ready yet" });
            }
            const course = await ensureCourseFromUpload({
                userId: user.id,
                uploadId: upload.id,
                fileName: upload.file_name,
                extractedText: upload.extracted_text || "",
            });
            return sendJson(res, 200, { course });
        }

        if (parts.length === 1 && method === "GET") {
            const course = await getCourseForUser(user.id, parts[0]);
            if (!course) {
                return sendJson(res, 404, { error: "Course not found" });
            }
            return sendJson(res, 200, { course });
        }

        if (parts.length === 2 && parts[1] === "share" && method === "POST") {
            const course = await enableCourseShare(user.id, parts[0]);
            if (!course) {
                return sendJson(res, 404, { error: "Course not found" });
            }
            return sendJson(res, 200, { course });
        }

        if (parts.length === 2 && parts[1] === "share" && method === "DELETE") {
            const course = await disableCourseShare(user.id, parts[0]);
            if (!course) {
                return sendJson(res, 404, { error: "Course not found" });
            }
            return sendJson(res, 200, { course });
        }

        res.setHeader("Allow", "GET, POST, DELETE");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/courses]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Course request failed",
        });
    }
};

export const handleTopicsRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parsePath(req.url || "", /^\/api\/topics\/?/);
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 1 && method === "GET") {
            const payload = await getTopicForUser(user.id, parts[0]);
            if (!payload?.topic) {
                return sendJson(res, 404, { error: "Topic not found" });
            }
            return sendJson(res, 200, payload);
        }

        if (parts.length === 2 && parts[1] === "quiz" && method === "GET") {
            const quiz = await getQuizForTopic(user.id, parts[0]);
            if (!quiz?.topic) {
                return sendJson(res, 404, { error: "Topic not found" });
            }
            return sendJson(res, 200, quiz);
        }

        if (parts.length === 2 && parts[1] === "quiz" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await submitQuizAttempt({
                userId: user.id,
                topicId: parts[0],
                answers: body.answers || [],
            });
            try {
                const { upsertTopicProgressForUser } = await import("./topicNotes.js");
                await upsertTopicProgressForUser(user.id, parts[0], {
                    lastStudiedAt: Date.now(),
                    bestScore: result.percent,
                });
            } catch (progressError) {
                console.warn("[api/topics] quiz progress upsert failed", {
                    message: progressError?.message || String(progressError),
                });
            }
            return sendJson(res, 200, { attempt: result });
        }

        if (parts.length === 2 && parts[1] === "chat" && method === "GET") {
            const messages = await listTopicChatMessages(user.id, parts[0]);
            return sendJson(res, 200, { messages });
        }

        if (parts.length === 2 && parts[1] === "chat" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await askTopicTutor({
                userId: user.id,
                topicId: parts[0],
                question: body.question || body.content,
                persona: body.persona,
            });
            return sendJson(res, 200, result);
        }

        if (parts.length === 2 && parts[1] === "chat" && method === "DELETE") {
            const result = await clearTopicChat(user.id, parts[0]);
            return sendJson(res, 200, result);
        }

        if (parts.length === 2 && parts[1] === "notes" && method === "GET") {
            const note = await getTopicNoteForUser(user.id, parts[0]);
            return sendJson(res, 200, { note });
        }

        if (parts.length === 2 && parts[1] === "notes" && method === "PUT") {
            const body = await readJsonBody(req);
            const note = await saveTopicNoteForUser(
                user.id,
                parts[0],
                body.content ?? "",
            );
            return sendJson(res, 200, { note });
        }

        if (parts.length === 2 && parts[1] === "progress" && method === "GET") {
            const progress = await getTopicProgressForUser(user.id, parts[0]);
            return sendJson(res, 200, { progress });
        }

        if (parts.length === 2 && parts[1] === "progress" && method === "POST") {
            const body = await readJsonBody(req);
            const progress = await upsertTopicProgressForUser(user.id, parts[0], body || {});
            return sendJson(res, 200, { progress });
        }

        if (parts.length === 2 && parts[1] === "explain" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await explainTopicSelection({
                userId: user.id,
                topicId: parts[0],
                selectedText: body.selectedText || body.text,
                style: body.style,
            });
            return sendJson(res, 200, result);
        }

        if (parts.length === 2 && parts[1] === "re-explain" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await reExplainTopicContent({
                userId: user.id,
                topicId: parts[0],
                style: body.style,
            });
            return sendJson(res, 200, result);
        }

        res.setHeader("Allow", "GET, POST, PUT, DELETE");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/topics]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Topic request failed",
        });
    }
};

export const handleQuizAttemptsRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parsePath(req.url || "", /^\/api\/quiz-attempts\/?/);
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 1 && method === "GET") {
            const attempt = await getQuizAttemptForUser(user.id, parts[0]);
            if (!attempt) {
                return sendJson(res, 404, { error: "Quiz attempt not found" });
            }
            return sendJson(res, 200, { attempt });
        }

        res.setHeader("Allow", "GET");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/quiz-attempts]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Quiz attempt request failed",
        });
    }
};

export const handleShareRequest = async (req, res) => {
    try {
        const parts = parsePath(req.url || "", /^\/api\/share\/?/);
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 1 && method === "GET") {
            const course = await getPublicCourseByShareToken(parts[0]);
            if (!course) {
                return sendJson(res, 404, { error: "Shared course not found" });
            }
            return sendJson(res, 200, { course });
        }

        res.setHeader("Allow", "GET");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/share]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Share request failed",
        });
    }
};
