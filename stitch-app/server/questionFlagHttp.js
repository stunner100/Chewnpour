import { fromNodeHeaders } from "better-auth/node";
import { Buffer } from "node:buffer";
import { auth } from "./auth.js";
import { flagQuestion } from "./questionFlags.js";

const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
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

// POST /api/questions/:questionId/flag  { reason, note }
export const handleQuestionsRequest = async (req, res) => {
    try {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        const user = session?.user || null;
        if (!user?.id) return sendJson(res, 401, { error: "Unauthorized" });

        const pathname = String(req.url || "").split("?")[0];
        const match = /^\/api\/questions\/([^/]+)\/flag\/?$/.exec(pathname);
        const method = String(req.method || "GET").toUpperCase();
        if (!match) return sendJson(res, 404, { error: "Not found" });
        if (method !== "POST") {
            res.setHeader("Allow", "POST");
            return sendJson(res, 405, { error: "Method not allowed" });
        }

        const body = await readJsonBody(req);
        const result = await flagQuestion({
            userId: user.id,
            questionId: decodeURIComponent(match[1]),
            reason: body.reason,
            note: body.note,
        });
        return sendJson(res, 200, result);
    } catch (error) {
        const status = Number(error?.status) || 500;
        if (status >= 500) console.error("[api/questions]", error);
        return sendJson(res, status, {
            error: status >= 500 ? "Could not send the report" : error.message,
        });
    }
};
