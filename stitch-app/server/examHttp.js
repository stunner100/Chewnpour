import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    getExamAttemptForUser,
    startExamForCourse,
    submitExamAttempt,
} from "./exams.js";

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

const parsePath = (url = "") => {
    const pathname = String(url || "").split("?")[0];
    return pathname.replace("/api/exams", "").split("/").filter(Boolean);
};

export const handleExamsRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parsePath(req.url);
        const method = String(req.method || "GET").toUpperCase();

        if (method === "POST" && parts.length === 0) {
            const body = await readJsonBody(req);
            const courseId = String(body.courseId || "").trim();
            if (!courseId) {
                return sendJson(res, 400, { error: "courseId is required" });
            }
            const exam = await startExamForCourse({
                userId: String(user.id),
                courseId,
                questionLimit: body.questionLimit,
            });
            return sendJson(res, 201, { exam });
        }

        if (method === "GET" && parts.length === 1) {
            const exam = await getExamAttemptForUser(String(user.id), parts[0]);
            return sendJson(res, 200, { exam });
        }

        if (method === "POST" && parts.length === 2 && parts[1] === "submit") {
            const body = await readJsonBody(req);
            const exam = await submitExamAttempt({
                userId: String(user.id),
                examId: parts[0],
                answers: body.answers || {},
            });
            return sendJson(res, 200, { exam });
        }

        return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Exam request failed",
            code: error?.code || undefined,
        });
    }
};
