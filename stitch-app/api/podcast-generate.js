import { Buffer } from "node:buffer";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../server/auth.js";
import { generatePodcastForTopic } from "../server/podcasts.js";

export const config = {
    api: {
        bodyParser: false,
    },
    maxDuration: 120,
};

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

export default async function handler(req, res) {
    try {
        if (String(req.method || "GET").toUpperCase() !== "POST") {
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

        const podcast = await generatePodcastForTopic({
            userId: user.id,
            topicId,
            force: Boolean(body.force),
        });
        return sendJson(res, 200, { podcast });
    } catch (error) {
        if (res.headersSent) return;
        const status = Number(error?.status) || 500;
        return sendJson(res, status >= 400 && status < 600 ? status : 500, {
            error: error?.message || "Could not generate this podcast.",
        });
    }
}
