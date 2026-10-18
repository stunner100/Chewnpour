import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { verifyUnsubscribeToken } from "./reviewReminderEmail.js";
import { disableReviewReminders, runReviewReminders } from "./reviewReminders.js";

const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        // List-Unsubscribe=One-Click posts form data, not JSON.
        return Object.fromEntries(new URLSearchParams(raw));
    }
};

// Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
const isCronRequest = (req) => {
    const secret = String(process.env.CRON_SECRET || "").trim();
    if (!secret) return false;
    const given = Buffer.from(String(req.headers?.authorization || ""));
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
};

// GET  /api/cron/review-reminders   (Vercel Cron, daily)
// POST /api/email/unsubscribe       { token } or ?token=…, no sign-in needed
export const handleReminderRequest = async (req, res) => {
    try {
        const url = new URL(String(req.url || "/"), "http://localhost");
        const pathname = url.pathname.replace(/\/+$/, "");
        const method = String(req.method || "GET").toUpperCase();

        if (pathname === "/api/cron/review-reminders" && method === "GET") {
            if (!isCronRequest(req)) return sendJson(res, 401, { error: "Unauthorized" });
            const result = await runReviewReminders();
            console.log("[cron/review-reminders]", result);
            return sendJson(res, 200, result);
        }

        if (pathname === "/api/email/unsubscribe" && method === "POST") {
            const body = await readJsonBody(req);
            const token = String(body.token || url.searchParams.get("token") || "");
            const userId = verifyUnsubscribeToken(token, String(process.env.BETTER_AUTH_SECRET || "").trim());
            if (!userId) return sendJson(res, 400, { error: "This unsubscribe link is not valid." });
            return sendJson(res, 200, await disableReviewReminders(userId));
        }

        return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        console.error("[api/reminders]", error);
        return sendJson(res, 500, { error: "Request failed" });
    }
};
