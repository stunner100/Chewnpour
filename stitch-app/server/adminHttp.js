import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { BOOTSTRAP_ADMIN_EMAILS } from "./adminAccess.js";
import { clearAdminSnapshotCache, getAdminSnapshot, searchAdminUsers } from "./adminMetrics.js";
import { grantAdmin, isAdminSessionUser, listAdmins, revokeAdmin } from "./adminMembers.js";
import { handleAdminPastPapersRequest } from "./pastPaperHttp.js";
import { listOpenQuestionFlags, resolveQuestionFlag } from "./questionFlags.js";

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

const requireAdminUser = async (req) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    const user = session?.user || null;
    if (!user?.id) {
        const error = new Error("Unauthorized");
        error.status = 401;
        throw error;
    }
    if (!(await isAdminSessionUser(user))) {
        const error = new Error("Forbidden");
        error.status = 403;
        error.code = "ADMIN_FORBIDDEN";
        throw error;
    }
    return user;
};

export const handleAdminRequest = async (req, res) => {
    try {
        const user = await requireAdminUser(req);
        const pathname = String(req.url || "").split("?")[0];
        const method = String(req.method || "GET").toUpperCase();

        if ((pathname === "/api/admin" || pathname === "/api/admin/") && method === "GET") {
            return sendJson(res, 200, {
                admin: true,
                email: user.email || "",
                bootstrapAdminIncludes: BOOTSTRAP_ADMIN_EMAILS[0],
            });
        }

        if (pathname === "/api/admin/snapshot" && method === "GET") {
            const snapshot = await getAdminSnapshot();
            return sendJson(res, 200, {
                snapshot,
                viewer: {
                    email: user.email || "",
                    id: user.id,
                },
                bootstrapAdminIncludes: BOOTSTRAP_ADMIN_EMAILS[0],
            });
        }

        if (pathname === "/api/admin/admins" && method === "GET") {
            return sendJson(res, 200, { admins: await listAdmins(), viewerId: user.id });
        }
        if (pathname === "/api/admin/admins" && method === "POST") {
            const body = await readJsonBody(req);
            const granted = await grantAdmin({
                actorId: user.id,
                userId: body.userId,
                email: body.email,
                allowUnverified: body.allowUnverified === true,
            });
            clearAdminSnapshotCache();
            return sendJson(res, 201, { granted, admins: await listAdmins() });
        }
        if (pathname.startsWith("/api/admin/admins/") && method === "DELETE") {
            const targetId = decodeURIComponent(pathname.slice("/api/admin/admins/".length));
            await revokeAdmin({ actorId: user.id, userId: targetId });
            clearAdminSnapshotCache();
            return sendJson(res, 200, { admins: await listAdmins() });
        }

        if (pathname === "/api/admin/users" && method === "GET") {
            const query = new URL(String(req.url || "/"), "http://localhost").searchParams.get("q");
            return sendJson(res, 200, { users: await searchAdminUsers(query) });
        }

        if (pathname === "/api/admin/question-flags" && method === "GET") {
            return sendJson(res, 200, { flags: await listOpenQuestionFlags() });
        }
        const resolveMatch = /^\/api\/admin\/question-flags\/([^/]+)\/resolve$/.exec(pathname);
        if (resolveMatch && method === "POST") {
            const body = await readJsonBody(req);
            const result = await resolveQuestionFlag({
                adminId: user.id,
                flagId: decodeURIComponent(resolveMatch[1]),
                outcome: body.outcome,
            });
            return sendJson(res, 200, { ...result, flags: await listOpenQuestionFlags() });
        }

        if (pathname === "/api/admin/past-papers" || pathname.startsWith("/api/admin/past-papers/")) {
            return handleAdminPastPapersRequest(req, res, user);
        }

        res.setHeader("Allow", "GET");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        const status = Number(error?.status) || 500;
        if (status === 401) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }
        if (status === 403) {
            return sendJson(res, 403, {
                error: "Forbidden",
                code: error.code || "ADMIN_FORBIDDEN",
            });
        }
        if (status >= 400 && status < 500) {
            return sendJson(res, status, { error: error.message, code: error.code || undefined });
        }
        console.error("adminHttp", error);
        return sendJson(res, 500, { error: "Could not load admin data." });
    }
};
