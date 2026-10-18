import { fromNodeHeaders } from "better-auth/node";
import { Buffer } from "node:buffer";
import { auth } from "./auth.js";
import { answerReviewQuestion, getReviewQueueForUser } from "./reviews.js";

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
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : {};
};

const requireSessionUser = async (req) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    return session?.user || null;
};

// GET  /api/review         → due summary + the next session's questions
// POST /api/review/answer  → grade one answer and reschedule it
export const handleReviewRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const pathname = String(req.url || "").split("?")[0].replace(/\/+$/, "");
        const method = String(req.method || "GET").toUpperCase();

        if (pathname === "/api/review" && method === "GET") {
            const review = await getReviewQueueForUser(user.id);
            return sendJson(res, 200, { review });
        }
        if (pathname === "/api/review/answer" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await answerReviewQuestion({
                userId: user.id,
                questionId: body.questionId,
                selectedIndex: body.selectedIndex,
            });
            return sendJson(res, 200, { result });
        }

        return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        console.error("[api/review]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Review request failed",
        });
    }
};
