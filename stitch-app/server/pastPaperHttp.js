import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    deletePastPaper,
    getPastPaperFileUrl,
    initPastPaperUpload,
    listAllPastPapers,
    listPublishedPastPapers,
    startPastPaperPracticeForUser,
    updatePastPaper,
} from "./pastPapers.js";

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

const sendError = (res, scope, error) => {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error(scope, error);
    return sendJson(res, status, {
        error: status >= 500 ? "Past questions request failed." : error.message,
        code: error?.code || undefined,
    });
};

const splitPath = (url, prefix) =>
    String(url || "")
        .split("?")[0]
        .slice(prefix.length)
        .split("/")
        .filter(Boolean);

/** Student routes: /api/past-questions */
export const handlePastQuestionsRequest = async (req, res) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        const user = session?.user || null;
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const url = new URL(String(req.url || "/"), "http://localhost");
        const parts = splitPath(req.url, "/api/past-questions");
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 0 && method === "GET") {
            const result = await listPublishedPastPapers({
                institution: url.searchParams.get("institution") || "",
                courseCode: url.searchParams.get("courseCode") || "",
                year: url.searchParams.get("year") || "",
                q: url.searchParams.get("q") || "",
            });
            return sendJson(res, 200, result);
        }

        if (parts.length === 2 && parts[1] === "file" && method === "GET") {
            const file = await getPastPaperFileUrl(parts[0], {
                download: url.searchParams.get("download") === "1",
            });
            return sendJson(res, 200, file);
        }

        if (parts.length === 2 && parts[1] === "practice" && method === "POST") {
            const result = await startPastPaperPracticeForUser(user.id, parts[0]);
            return sendJson(res, 200, result);
        }

        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        return sendError(res, "[api/past-questions]", error);
    }
};

/** Admin routes: /api/admin/past-papers (caller has already checked admin access). */
export const handleAdminPastPapersRequest = async (req, res, user) => {
    try {
        const parts = splitPath(req.url, "/api/admin/past-papers");
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 0 && method === "GET") {
            return sendJson(res, 200, { papers: await listAllPastPapers() });
        }
        if (parts.length === 1 && parts[0] === "init" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await initPastPaperUpload({ adminUserId: user.id, input: body });
            return sendJson(res, 200, result);
        }
        if (parts.length === 1 && method === "PATCH") {
            const body = await readJsonBody(req);
            return sendJson(res, 200, { paper: await updatePastPaper(parts[0], body) });
        }
        if (parts.length === 1 && method === "DELETE") {
            return sendJson(res, 200, await deletePastPaper(parts[0]));
        }

        res.setHeader("Allow", "GET, POST, PATCH, DELETE");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        return sendError(res, "[api/admin/past-papers]", error);
    }
};
