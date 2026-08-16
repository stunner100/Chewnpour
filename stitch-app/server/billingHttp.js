import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { getBillingSnapshotForUser } from "./payments.js";

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
                    canTopUp: false,
                    currency: snapshot.currency,
                    topUpCredits: snapshot.topUpCredits,
                    topUpPriceMajor: snapshot.topUpPriceMajor,
                    topUpOptions: [],
                    checkoutCurrencies: snapshot.checkoutCurrencies,
                    unlimited: true,
                },
            });
        }

        if (parts.length === 1 && (parts[0] === "checkout" || parts[0] === "verify") && method === "POST") {
            return sendJson(res, 410, {
                error: "ChewnPour is free. Paid top-ups are retired.",
                code: "BILLING_RETIRED",
            });
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
