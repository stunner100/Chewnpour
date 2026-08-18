import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { BOOTSTRAP_ADMIN_EMAILS, isAdminUser } from "./adminAccess.js";
import { getAdminSnapshot } from "./adminMetrics.js";

const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
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
    if (!isAdminUser({ email: user.email, id: user.id })) {
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
        console.error("adminHttp", error);
        return sendJson(res, 500, { error: "Could not load admin data." });
    }
};
