const PAYSTACK_BASE_URL = String(
    process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
).replace(/\/+$/, "");

const PAYSTACK_TIMEOUT_MS = (() => {
    const raw = Number(process.env.PAYSTACK_TIMEOUT_MS || 12000);
    if (!Number.isFinite(raw)) return 12000;
    return Math.max(3000, Math.floor(raw));
})();

export const getPaymentProvider = () => {
    const value = String(process.env.PAYMENT_PROVIDER || "paystack")
        .trim()
        .toLowerCase();
    return value === "manual" ? "manual" : "paystack";
};

export const getPaystackSecretKey = () =>
    String(process.env.PAYSTACK_SECRET_KEY || "").trim();

export const callPaystackApi = async (endpoint, init = {}) => {
    const secret = getPaystackSecretKey();
    if (!secret) {
        const error = new Error("Payment provider is not configured yet.");
        error.status = 503;
        error.code = "PAYSTACK_NOT_CONFIGURED";
        throw error;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);

    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${secret}`,
                ...(init.headers || {}),
            },
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.status !== true) {
            const message =
                payload?.message ||
                `Paystack request failed (${response.status}).`;
            const error = new Error(message);
            error.status = 502;
            error.code = "PAYSTACK_REQUEST_FAILED";
            throw error;
        }
        return payload;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const initializePaystackTransaction = async ({
    email,
    amountMinor,
    currency,
    reference,
    callbackUrl,
    metadata,
}) => {
    const payload = await callPaystackApi("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
            email,
            amount: amountMinor,
            currency,
            reference,
            callback_url: callbackUrl,
            metadata: metadata || {},
        }),
    });
    const authorizationUrl = String(payload?.data?.authorization_url || "").trim();
    if (!authorizationUrl) {
        const error = new Error("Could not start checkout right now. Please try again.");
        error.status = 502;
        error.code = "CHECKOUT_INIT_FAILED";
        throw error;
    }
    return {
        authorizationUrl,
        accessCode: payload?.data?.access_code || null,
        reference: payload?.data?.reference || reference,
    };
};

export const verifyPaystackTransaction = async (reference) => {
    const payload = await callPaystackApi(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        { method: "GET" },
    );
    return payload?.data || {};
};
