import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    addStudyTimeForUser,
    ensureProfile,
    getProfileForUser,
    updateProfileForUser,
} from "./profiles.js";

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

export const handleProfileRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const pathname = String(req.url || "").split("?")[0];
        const method = String(req.method || "GET").toUpperCase();

        if (pathname === "/api/profile/study-time" && method === "POST") {
            const body = await readJsonBody(req);
            const profile = await addStudyTimeForUser(user.id, body.minutes);
            return sendJson(res, 200, { profile });
        }

        if (pathname === "/api/profile" || pathname === "/api/profile/") {
            if (method === "GET") {
                let profile = await getProfileForUser(user.id);
                if (!profile) {
                    profile = await ensureProfile({
                        userId: user.id,
                        fullName: user.name || "",
                        avatarUrl: user.image || null,
                    });
                }
                return sendJson(res, 200, { profile });
            }

            if (method === "PATCH" || method === "PUT") {
                const updates = await readJsonBody(req);
                const profile = await updateProfileForUser(user.id, updates);
                return sendJson(res, 200, { profile });
            }
        }

        res.setHeader("Allow", "GET, PATCH, PUT, POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/profile]", error);
        return sendJson(res, 500, {
            error: error?.message || "Profile request failed",
        });
    }
};
