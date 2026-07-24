import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import {
    getBillingForUser,
    grantPurchasedCredits,
    hasSuccessfulPurchase,
} from "./billing.js";
import {
    getPaymentProvider,
    initializePaystackTransaction,
    verifyPaystackTransaction,
} from "./paystack.js";
import {
    listTopUpPlans,
    resolveTopUpPlanById,
    resolveTopUpPlanByPayment,
    TOPUP_CURRENCY,
} from "./topUpPlans.js";

const sanitizeReturnPath = (value) => {
    const fallback = "/dashboard";
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
    return trimmed;
};

const buildAppBaseUrl = () =>
    String(
        process.env.APP_BASE_URL ||
            process.env.FRONTEND_URL ||
            process.env.BETTER_AUTH_URL ||
            "http://localhost:5173",
    ).replace(/\/+$/, "");

const buildPaymentReference = (userId) => {
    const userSlug =
        String(userId || "user")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")
            .slice(0, 20) || "user";
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    return `stitch_topup_${userSlug}_${Date.now()}_${randomSuffix}`;
};

const toPaymentRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        reference: row.reference,
        planId: row.plan_id,
        amountMinor: Number(row.amount_minor || 0),
        currency: row.currency || TOPUP_CURRENCY,
        credits: Number(row.credits || 0),
        status: row.status,
        provider: row.provider,
        customerEmail: row.customer_email || null,
        source: row.source || null,
        eventType: row.event_type || null,
        paidAt: row.paid_at ? new Date(row.paid_at).getTime() : null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    };
};

export const getPaymentByReference = async (reference) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM payments WHERE reference = $1 LIMIT 1`,
        [reference],
    );
    return result.rows[0] || null;
};

export const getBillingSnapshotForUser = async (userId) => {
    const billing = await getBillingForUser(userId);
    const includeFirstTime = !(await hasSuccessfulPurchase(userId));
    const topUpOptions = listTopUpPlans({ includeFirstTime });
    return {
        billing,
        freeLimit: Number(process.env.STARTER_UPLOAD_CREDITS || 3) || 3,
        purchasedCredits: billing.purchasedUploadCredits,
        consumedCredits: billing.consumedUploadCredits,
        totalAllowed: billing.purchasedUploadCredits,
        remaining: billing.remainingUploadCredits,
        canTopUp: true,
        currency: TOPUP_CURRENCY,
        topUpOptions,
        topUpCredits: topUpOptions[0]?.credits || 5,
        topUpPriceMajor: topUpOptions[0]?.amountMajor || 20,
        checkoutCurrencies: [TOPUP_CURRENCY],
    };
};

export const initializeTopUpCheckout = async ({
    userId,
    email,
    topUpPlanId,
    returnPath,
}) => {
    const plan = resolveTopUpPlanById(topUpPlanId);
    if (!plan) {
        const error = new Error("Choose a valid top-up plan.");
        error.status = 400;
        error.code = "INVALID_TOPUP_PLAN";
        throw error;
    }

    if (plan.id === "first-time-starter" && (await hasSuccessfulPurchase(userId))) {
        const error = new Error("First-time starter plan is no longer available.");
        error.status = 400;
        error.code = "INVALID_TOPUP_PLAN";
        throw error;
    }

    const provider = getPaymentProvider();
    const safeReturnPath = sanitizeReturnPath(returnPath);
    const reference = buildPaymentReference(userId);
    const customerEmail = String(email || "").trim().toLowerCase();
    if (!customerEmail) {
        const error = new Error("A verified email is required for checkout.");
        error.status = 400;
        error.code = "EMAIL_REQUIRED";
        throw error;
    }

    const db = getPool();
    await db.query(
        `INSERT INTO payments (
            id, user_id, reference, plan_id, amount_minor, currency, credits,
            status, provider, customer_email, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'initialized',$8,$9,'checkout_init')`,
        [
            nanoid(),
            userId,
            reference,
            plan.id,
            plan.amountMinor,
            plan.currency,
            plan.credits,
            provider,
            customerEmail,
        ],
    );

    const callbackParams = new URLSearchParams({
        reference,
        from: safeReturnPath,
    });
    const callbackUrl = `${buildAppBaseUrl()}/subscription/callback?${callbackParams.toString()}`;

    if (provider === "manual") {
        return {
            authorizationUrl: callbackUrl,
            reference,
            provider,
            plan,
        };
    }

    const initialized = await initializePaystackTransaction({
        email: customerEmail,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        reference,
        callbackUrl,
        metadata: {
            userId,
            returnPath: safeReturnPath,
            purpose: "upload_topup",
            topUpPlanId: plan.id,
            topUpCredits: plan.credits,
            topUpAmountMajor: plan.amountMajor,
            topUpCurrency: plan.currency,
        },
    });

    return {
        authorizationUrl: initialized.authorizationUrl,
        reference,
        provider,
        plan,
    };
};

export const applySuccessfulPayment = async ({
    reference,
    userId = null,
    amountMinor,
    currency,
    provider = "paystack",
    customerEmail = null,
    paidAtMs = Date.now(),
    source = "webhook",
    eventType = "charge.success",
    payloadHash = null,
}) => {
    const existing = await getPaymentByReference(reference);
    if (!existing) {
        return {
            applied: false,
            duplicate: false,
            reason: "unknown_reference",
            remaining: 0,
        };
    }

    if (userId && existing.user_id !== userId) {
        return {
            applied: false,
            duplicate: false,
            reason: "invalid_reference",
            remaining: 0,
        };
    }

    if (existing.status === "success") {
        const billing = await getBillingForUser(existing.user_id);
        return {
            applied: false,
            duplicate: true,
            reason: "already_applied",
            remaining: billing.remainingUploadCredits,
            grantedCredits: 0,
            amountMajor: existing.amount_minor / 100,
            currency: existing.currency,
        };
    }

    const expectedAmount = Math.max(0, Math.floor(Number(existing.amount_minor) || 0));
    const expectedCurrency = String(existing.currency || TOPUP_CURRENCY).toUpperCase();
    const paidAmount = Math.max(0, Math.floor(Number(amountMinor) || 0));
    const paidCurrency = String(currency || "").trim().toUpperCase();

    if (paidAmount !== expectedAmount) {
        return {
            applied: false,
            duplicate: false,
            reason: "amount_mismatch",
            remaining: 0,
        };
    }
    if (paidCurrency !== expectedCurrency) {
        return {
            applied: false,
            duplicate: false,
            reason: "currency_mismatch",
            remaining: 0,
        };
    }

    const plan =
        resolveTopUpPlanById(existing.plan_id) ||
        resolveTopUpPlanByPayment(paidAmount, paidCurrency);
    if (!plan || plan.credits !== Number(existing.credits)) {
        return {
            applied: false,
            duplicate: false,
            reason: "invalid_topup_plan",
            remaining: 0,
        };
    }

    const billing = await grantPurchasedCredits({
        userId: existing.user_id,
        credits: plan.credits,
        reason: "upload_topup",
        planId: plan.id,
        paymentReference: reference,
    });

    const db = getPool();
    await db.query(
        `UPDATE payments
         SET status = 'success',
             provider = $2,
             customer_email = COALESCE($3, customer_email),
             source = $4,
             event_type = $5,
             payload_hash = COALESCE($6, payload_hash),
             paid_at = to_timestamp($7 / 1000.0),
             updated_at = NOW()
         WHERE reference = $1`,
        [
            reference,
            provider,
            customerEmail,
            source,
            eventType,
            payloadHash,
            Math.max(0, Number(paidAtMs) || Date.now()),
        ],
    );

    return {
        applied: true,
        duplicate: false,
        reason: "applied",
        remaining: billing.remainingUploadCredits,
        grantedCredits: plan.credits,
        amountMajor: plan.amountMajor,
        currency: plan.currency,
    };
};

export const verifyTopUpAfterRedirect = async ({
    userId,
    reference,
    returnPath,
}) => {
    const safeReturnPath = sanitizeReturnPath(returnPath);
    const failureRedirect = (reason) =>
        `/subscription?from=${encodeURIComponent(safeReturnPath)}&reason=${encodeURIComponent(reason)}`;

    const trimmedReference = String(reference || "").trim();
    if (!trimmedReference) {
        return {
            success: false,
            redirectTo: failureRedirect("missing_reference"),
        };
    }

    const existing = await getPaymentByReference(trimmedReference);
    if (!existing || existing.user_id !== userId) {
        return {
            success: false,
            redirectTo: failureRedirect("invalid_reference"),
        };
    }

    const provider = String(existing.provider || getPaymentProvider()).toLowerCase();

    if (provider === "manual") {
        const applyResult = await applySuccessfulPayment({
            reference: trimmedReference,
            userId,
            amountMinor: existing.amount_minor,
            currency: existing.currency,
            provider: "manual",
            customerEmail: existing.customer_email,
            paidAtMs: Date.now(),
            source: "callback_verify",
            eventType: "charge.success",
        });
        if (!(applyResult.applied || applyResult.duplicate)) {
            return {
                success: false,
                redirectTo: failureRedirect(applyResult.reason || "payment_failed"),
            };
        }
        return {
            success: true,
            redirectTo: safeReturnPath,
            grantedCredits: applyResult.grantedCredits || 0,
            remaining: applyResult.remaining,
            currency: applyResult.currency || TOPUP_CURRENCY,
            provider: "manual",
        };
    }

    const paymentData = await verifyPaystackTransaction(trimmedReference);
    const paymentStatus = String(paymentData.status || "").toLowerCase();
    if (paymentStatus !== "success") {
        return {
            success: false,
            redirectTo: failureRedirect("payment_not_success"),
        };
    }

    const applyResult = await applySuccessfulPayment({
        reference: trimmedReference,
        userId,
        amountMinor: paymentData.amount,
        currency: paymentData.currency,
        provider: "paystack",
        customerEmail:
            typeof paymentData?.customer?.email === "string"
                ? paymentData.customer.email
                : existing.customer_email,
        paidAtMs: paymentData.paid_at
            ? Date.parse(paymentData.paid_at) || Date.now()
            : Date.now(),
        source: "callback_verify",
        eventType: "charge.success",
    });

    if (!(applyResult.applied || applyResult.duplicate)) {
        const reason =
            applyResult.reason === "amount_mismatch" ||
            applyResult.reason === "currency_mismatch"
                ? "payment_mismatch"
                : applyResult.reason || "payment_failed";
        return {
            success: false,
            redirectTo: failureRedirect(reason),
        };
    }

    return {
        success: true,
        redirectTo: safeReturnPath,
        grantedCredits: applyResult.grantedCredits || 0,
        remaining: applyResult.remaining,
        currency: applyResult.currency || TOPUP_CURRENCY,
        provider: "paystack",
    };
};

export { toPaymentRow, sanitizeReturnPath };
