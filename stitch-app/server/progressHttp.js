import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { getProgressSnapshotForUser } from "./progress.js";

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

export const handleProgressRequest = async (req, res) => {
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

        const progress = await getProgressSnapshotForUser(user.id);
        return sendJson(res, 200, { progress });
    } catch (error) {
        console.error("[api/progress]", error);
        return sendJson(res, 500, {
            error: error?.message || "Progress request failed",
        });
    }
};
