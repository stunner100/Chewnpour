import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    getBillingSnapshotForUser,
    initializeTopUpCheckout,
    verifyTopUpAfterRedirect,
} from "./payments.js";

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

const parsePath = (url = "") => {
    const pathname = String(url || "").split("?")[0];
    return pathname.replace(/^\/api\/billing\/?/, "").split("/").filter(Boolean);
};

export const handleBillingRequest = async (req, res) => {
    try {
        const user = await requireSessionUser(req);
        if (!user?.id) {
            return sendJson(res, 401, { error: "Unauthorized" });
        }

        const parts = parsePath(req.url || "");
        const method = String(req.method || "GET").toUpperCase();

        if (parts.length === 0 && method === "GET") {
            const snapshot = await getBillingSnapshotForUser(user.id);
            return sendJson(res, 200, {
                billing: snapshot.billing,
                quota: {
                    freeLimit: snapshot.freeLimit,
                    purchasedCredits: snapshot.purchasedCredits,
                    consumedCredits: snapshot.consumedCredits,
                    totalAllowed: snapshot.totalAllowed,
                    remaining: snapshot.remaining,
                    canTopUp: snapshot.canTopUp,
                    currency: snapshot.currency,
                    topUpCredits: snapshot.topUpCredits,
                    topUpPriceMajor: snapshot.topUpPriceMajor,
                    topUpOptions: snapshot.topUpOptions,
                    checkoutCurrencies: snapshot.checkoutCurrencies,
                },
            });
        }

        if (parts.length === 1 && parts[0] === "checkout" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await initializeTopUpCheckout({
                userId: user.id,
                email: user.email,
                topUpPlanId: body.topUpPlanId || body.planId,
                returnPath: body.returnPath || "/dashboard",
            });
            return sendJson(res, 200, {
                authorizationUrl: result.authorizationUrl,
                reference: result.reference,
                provider: result.provider,
                plan: result.plan,
            });
        }

        if (parts.length === 1 && parts[0] === "verify" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await verifyTopUpAfterRedirect({
                userId: user.id,
                reference: body.reference,
                returnPath: body.returnPath || "/dashboard",
            });
            return sendJson(res, 200, result);
        }

        res.setHeader("Allow", "GET, POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    } catch (error) {
        console.error("[api/billing]", error);
        const status = Number(error?.status) || 500;
        return sendJson(res, status, {
            error: error?.message || "Billing request failed",
            code: error?.code || undefined,
        });
    }
};
