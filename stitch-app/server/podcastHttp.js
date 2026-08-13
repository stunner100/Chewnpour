import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { listPodcastsForUser } from "./podcasts.js";

const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
};

const requireSessionUser = async (req) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    return session?.user || null;
};

export const handlePodcastsRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const method = String(req.method || "GET").toUpperCase();
        if (method !== "GET") {
            res.setHeader("Allow", "GET");
            return sendJson(res, 405, { error: "Method not allowed" });
        }

        const url = new URL(req.url || "/", "http://localhost");
        const topicId = String(url.searchParams.get("topicId") || "").trim();
        const podcasts = await listPodcastsForUser(user.id, { topicId });
        return sendJson(res, 200, { podcasts });
    } catch (error) {
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Could not load podcasts.",
        });
    }
};
