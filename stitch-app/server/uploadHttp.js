import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    finalizeUploadForUser,
    getUploadForUser,
    initUploadForUser,
    listUploadsForUser,
} from "./uploads.js";
import { assertUploadCreditsAvailable } from "./billing.js";

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

const parseUploadPath = (url = "") => {
    const pathname = String(url || "").split("?")[0];
    const parts = pathname.replace(/^\/api\/uploads\/?/, "").split("/").filter(Boolean);
    return parts;
};

export const handleUploadsRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parseUploadPath(req.url || "");
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 0 && method === "GET") {
            const uploads = await listUploadsForUser(user.id);
            return sendJson(res, 200, { uploads });
        }

        if (parts.length === 1 && parts[0] === "init" && method === "POST") {
            const body = await readJsonBody(req);
            const fileName = String(body.fileName || "").trim();
            const fileType = String(body.fileType || "").trim();
            const fileSize = Number(body.fileSize || 0);
            const contentType = String(body.contentType || "").trim() || null;

            if (!fileName || !fileType) {
                return sendJson(res, 400, { error: "fileName and fileType are required" });
            }
            if (!Number.isFinite(fileSize) || fileSize <= 0) {
                return sendJson(res, 400, { error: "fileSize must be a positive number" });
            }
            if (fileSize > 50 * 1024 * 1024) {
                return sendJson(res, 400, { error: "File must be smaller than 50MB" });
            }

            await assertUploadCreditsAvailable(user.id);

            const result = await initUploadForUser({
                userId: user.id,
                fileName,
                fileType,
                fileSize,
                contentType,
            });
            return sendJson(res, 200, result);
        }

        if (parts.length === 2 && parts[1] === "finalize" && method === "POST") {
            const uploadId = parts[0];
            const upload = await finalizeUploadForUser(user.id, uploadId);
            return sendJson(res, 200, { upload });
        }

        if (parts.length === 1 && method === "GET") {
            const upload = await getUploadForUser(user.id, parts[0]);
            if (!upload) {
                return sendJson(res, 404, { error: "Upload not found" });
            }
            return sendJson(res, 200, { upload });
        }

        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/uploads]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Upload request failed",
            code: error?.code || undefined,
            billing: error?.billing || undefined,
        });
    }
};
