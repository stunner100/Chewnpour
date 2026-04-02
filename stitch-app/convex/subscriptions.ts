import { ConvexError, v } from "convex/values";
import {
    action,
    internalAction,
    internalMutation,
    internalQuery,
    mutation,
    query,
} from "./_generated/server";
import { internal } from "./_generated/api";

export const FREE_UPLOAD_LIMIT = 3;
export const TOPUP_CURRENCY = "GHS";
export const TOPUP_PLANS = [
    {
        id: "starter",
        amountMajor: 20,
        amountMinor: 2000,
        credits: 5,
    },
    {
        id: "max",
        amountMajor: 40,
        amountMinor: 4000,
        credits: 12,
    },
    {
        id: "semester",
        amountMajor: 60,
        amountMinor: 6000,
        credits: 20,
        validityDays: 120, // ~4 months
        unlimitedAiChat: true,
    },
] as const;

const FIRST_TIME_STARTER_PLAN = {
    id: "first-time-starter" as const,
    amountMajor: 15,
    amountMinor: 1500,
    credits: 5,
};

const DEFAULT_TOPUP_PLAN = TOPUP_PLANS[0];
const PAYMENT_PROVIDER_KEY = "paymentProvider";
const PAYMENT_PROVIDER_PAYSTACK = "paystack";
const PAYMENT_PROVIDER_MANUAL = "manual";
const PAYMENT_PROVIDER_FALLBACK_BY_DEFAULT = PAYMENT_PROVIDER_PAYSTACK;
const APP_NAME = "ChewnPour";
const BOOTSTRAP_BILLING_ALERT_EMAILS = ["patrickannor35@gmail.com"];
const PAYSTACK_BASE_URL = String(process.env.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/+$/, "");
const PAYSTACK_SECRET_KEY = String(process.env.PAYSTACK_SECRET_KEY || "").trim();
const PAYSTACK_WEBHOOK_FORWARD_SECRET = String(process.env.PAYSTACK_WEBHOOK_FORWARD_SECRET || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const APP_BASE_URL = String(
    process.env.APP_BASE_URL
    || process.env.FRONTEND_URL
    || "http://localhost:5173"
).replace(/\/+$/, "");
const PAYSTACK_TIMEOUT_MS = (() => {
    const raw = Number(process.env.PAYSTACK_TIMEOUT_MS || 12000);
    if (!Number.isFinite(raw)) return 12000;
    return Math.max(3000, Math.floor(raw));
})();
const PAYMENT_PROVIDER_ENV_DEFAULT = String(process.env.PAYMENT_PROVIDER || PAYMENT_PROVIDER_FALLBACK_BY_DEFAULT)
    .trim()
    .toLowerCase();
const PAYMENT_RECONCILE_DELAY_MS = 10 * 60 * 1000;
const PAYMENT_RECONCILE_MIN_AGE_MS = 15 * 60 * 1000;
const PAYMENT_RECONCILE_RETRY_INTERVAL_MS = 60 * 60 * 1000;
const PAYMENT_NOT_FOUND_FINALIZE_AFTER_MS = 6 * 60 * 60 * 1000;
const PAYMENT_RECONCILE_BATCH_LIMIT = 25;
const PAYMENT_VERIFY_ERROR_ALERT_ATTEMPTS = 3;
const PAYMENT_VERIFY_ERROR_ALERT_MIN_AGE_MS = 2 * 60 * 60 * 1000;

const parseCommaSeparated = (value: string | undefined, transform?: (item: string) => string) => {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (transform ? transform(item) : item));
};

const normalizeEmail = (value: unknown) =>
    typeof value === "string" && value.trim()
        ? value.trim().toLowerCase()
        : "";

const resolvePaymentProvider = (value: unknown) => {
    const candidate = String(value || "").trim().toLowerCase();
    if (candidate === PAYMENT_PROVIDER_PAYSTACK || candidate === PAYMENT_PROVIDER_MANUAL) return candidate;
    return PAYMENT_PROVIDER_FALLBACK_BY_DEFAULT;
};

const readPaymentProviderSetting = async (ctx: { db: any }) => {
    const stored = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q: any) => q.eq("key", PAYMENT_PROVIDER_KEY))
        .first();
    if (stored && typeof stored.value === "string" && stored.value.trim()) {
        return resolvePaymentProvider(stored.value);
    }

    return resolvePaymentProvider(PAYMENT_PROVIDER_ENV_DEFAULT);
};

const buildBillingAlertRecipients = (dynamicAdminEmails: unknown[] = []) => {
    return Array.from(
        new Set(
            [
                ...BOOTSTRAP_BILLING_ALERT_EMAILS,
                ...parseCommaSeparated(process.env.ADMIN_EMAILS, normalizeEmail),
                ...dynamicAdminEmails.map((value) => normalizeEmail(value)),
            ].filter(Boolean)
        )
    );
};

const toNonNegativeInt = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
};

const normalizeCurrency = (value: unknown) => String(value || "").trim().toUpperCase();
const normalizePaymentStatus = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizeVerificationStatus = (value: unknown) => String(value || "").trim().toLowerCase();
const truncateMessage = (value: unknown, maxLength = 280) => {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
};

const resolvePaymentCreatedAtMs = (payment: any) =>
    toNonNegativeInt(payment?.createdAt) || toNonNegativeInt(payment?._creationTime);

const resolvePaymentLastVerifiedAtMs = (payment: any) =>
    toNonNegativeInt(payment?.lastVerifiedAt);

const resolvePaymentVerificationAttempts = (payment: any) =>
    toNonNegativeInt(payment?.verificationAttempts);

const isFinalProviderFailureStatus = (value: unknown) => {
    const normalized = normalizeVerificationStatus(value);
    return normalized === "abandoned"
        || normalized === "failed"
        || normalized === "reversed"
        || normalized === "cancelled";
};

const shouldFinalizeMissingReference = (payment: any, now = Date.now(), nextAttempts = 1) => {
    const createdAt = resolvePaymentCreatedAtMs(payment);
    const ageMs = createdAt > 0 ? Math.max(0, now - createdAt) : 0;
    return ageMs >= PAYMENT_NOT_FOUND_FINALIZE_AFTER_MS || nextAttempts >= 3;
};

const shouldRetryInitializedPayment = (payment: any, now = Date.now()) => {
    if (normalizePaymentStatus(payment?.status) !== "initialized") return false;
    const createdAt = resolvePaymentCreatedAtMs(payment);
    if (createdAt <= 0) return false;
    const lastVerifiedAt = resolvePaymentLastVerifiedAtMs(payment);
    const nextEligibleAt = lastVerifiedAt > 0
        ? lastVerifiedAt + PAYMENT_RECONCILE_RETRY_INTERVAL_MS
        : createdAt + PAYMENT_RECONCILE_MIN_AGE_MS;
    return now >= nextEligibleAt;
};

const TOPUP_CHECKOUT_CURRENCIES = [TOPUP_CURRENCY];

const formatTopUpAmountForCopy = (amountMajor: number) => {
    const normalizedAmount = Number(amountMajor);
    const safeAmount = Number.isFinite(normalizedAmount) ? Math.max(0, normalizedAmount) : 0;
    const hasFraction = Math.abs(safeAmount % 1) > 0.000001;
    return `${TOPUP_CURRENCY} ${hasFraction ? safeAmount.toFixed(2) : String(safeAmount)}`;
};

const buildLocalizedTopUpPlan = (plan: typeof TOPUP_PLANS[number]) => ({
    id: plan.id,
    amountMajor: plan.amountMajor,
    amountMinor: plan.amountMinor,
    credits: plan.credits,
    currency: TOPUP_CURRENCY,
    ...("validityDays" in plan ? { validityDays: plan.validityDays } : {}),
    ...("unlimitedAiChat" in plan ? { unlimitedAiChat: plan.unlimitedAiChat } : {}),
});

const buildLocalizedTopUpOptions = (opts?: { includeFirstTime?: boolean }) => {
    const plans: Array<ReturnType<typeof buildLocalizedTopUpPlan>> = [];
    if (opts?.includeFirstTime) {
        plans.push({
            id: FIRST_TIME_STARTER_PLAN.id,
            amountMajor: FIRST_TIME_STARTER_PLAN.amountMajor,
            amountMinor: FIRST_TIME_STARTER_PLAN.amountMinor,
            credits: FIRST_TIME_STARTER_PLAN.credits,
            currency: TOPUP_CURRENCY,
        });
    }
    for (const plan of TOPUP_PLANS) {
        plans.push(buildLocalizedTopUpPlan(plan));
    }
    return plans;
};

const buildTopUpOptionsCopy = (
    options: Array<{ amountMajor: number; credits: number; currency: string }>
) => options
    .map((plan) => `${formatTopUpAmountForCopy(plan.amountMajor)} (+${plan.credits} uploads)`)
    .join(" or ");

const LEGACY_PREMIUM_MIN_CREDITS = TOPUP_PLANS.reduce(
    (maxCredits, plan) => Math.max(maxCredits, plan.credits),
    0,
);

const TOPUP_OPTIONS_COPY = buildTopUpOptionsCopy(buildLocalizedTopUpOptions());

const resolveTopUpPlanById = (
    planId: unknown,
) => {
    const normalizedId = String(planId || "").trim().toLowerCase();
    if (!normalizedId) return null;
    if (normalizedId === FIRST_TIME_STARTER_PLAN.id) {
        return {
            id: FIRST_TIME_STARTER_PLAN.id,
            amountMajor: FIRST_TIME_STARTER_PLAN.amountMajor,
            amountMinor: FIRST_TIME_STARTER_PLAN.amountMinor,
            credits: FIRST_TIME_STARTER_PLAN.credits,
            currency: TOPUP_CURRENCY,
        };
    }
    const basePlan = TOPUP_PLANS.find((plan) => plan.id === normalizedId);
    if (!basePlan) return null;
    return buildLocalizedTopUpPlan(basePlan);
};

const resolveTopUpPlanByPayment = (amountMinor: number, currency: string) => {
    const normalizedAmountMinor = toNonNegativeInt(amountMinor);
    const normalizedCurrency = normalizeCurrency(currency);
    if (normalizedCurrency !== TOPUP_CURRENCY) return null;

    // Check first-time plan
    if (toNonNegativeInt(FIRST_TIME_STARTER_PLAN.amountMinor) === normalizedAmountMinor) {
        return {
            id: FIRST_TIME_STARTER_PLAN.id,
            amountMajor: FIRST_TIME_STARTER_PLAN.amountMajor,
            amountMinor: FIRST_TIME_STARTER_PLAN.amountMinor,
            credits: FIRST_TIME_STARTER_PLAN.credits,
            currency: TOPUP_CURRENCY,
        };
    }

    const plan = TOPUP_PLANS.find((item) => toNonNegativeInt(item.amountMinor) === normalizedAmountMinor);
    return plan ? buildLocalizedTopUpPlan(plan) : null;
};

const resolveAuthUserId = (identity: any) => {
    if (!identity || typeof identity !== "object") return "";
    const candidates = [
        identity.subject,
        identity.userId,
        identity.id,
        identity.tokenIdentifier,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    return "";
};

const assertAuthenticatedUserId = (identity: any) => {
    const authUserId = resolveAuthUserId(identity);
    if (!authUserId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "You must be signed in to access billing.",
        });
    }
    return authUserId;
};

const sanitizeReturnPath = (value: unknown) => {
    const fallback = "/dashboard";
    if (typeof value !== "string") return fallback;

    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) return fallback;
    if (trimmed.startsWith("//")) return fallback;

    return trimmed;
};

const buildSubscriptionFailureRedirect = (returnPath: string, reason = "payment_failed") => {
    const safeReturnPath = sanitizeReturnPath(returnPath);
    const query = new URLSearchParams({
        from: safeReturnPath,
        reason,
    });
    return `/subscription?${query.toString()}`;
};

const buildAbsoluteAppUrl = (pathWithQuery: string) => {
    const safePath = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
    return `${APP_BASE_URL}${safePath}`;
};

const getPaystackFailureCode = (payload: any) => {
    const candidates = [
        payload?.code,
        payload?.data?.code,
    ];
    for (const candidate of candidates) {
        const normalized = String(candidate || "").trim();
        if (normalized) return normalized;
    }
    return "";
};

const buildPaystackFailureMessage = (statusCode: number, payload: any) => {
    const baseMessage = typeof payload?.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : `Paystack request failed with status ${statusCode}.`;
    const providerCode = getPaystackFailureCode(payload);
    if (!providerCode) return baseMessage;
    if (baseMessage.toLowerCase().includes(providerCode.toLowerCase())) return baseMessage;
    return `${baseMessage} (Paystack code: ${providerCode})`;
};

const isLikelyEmail = (value: unknown) => {
    if (typeof value !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const getPaystackCustomerEmail = (identity: any, userId: string) => {
    const identityEmail = typeof identity?.email === "string" ? identity.email.trim() : "";
    if (isLikelyEmail(identityEmail)) return identityEmail;

    const slug = String(userId || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 32) || "user";
    return `${slug}@stitch.app`;
};

const buildPaymentReference = (userId: string) => {
    const userSlug = String(userId || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 20) || "user";
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    return `stitch_topup_${userSlug}_${Date.now()}_${randomSuffix}`;
};

const callPaystackApi = async (
    endpoint: string,
    init: RequestInit = {}
) => {
    if (!PAYSTACK_SECRET_KEY) {
        throw new ConvexError({
            code: "PAYSTACK_NOT_CONFIGURED",
            message: "Payment provider is not configured yet.",
        });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);

    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                ...(init.headers || {}),
            },
            signal: controller.signal,
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || payload.status !== true) {
            const providerCode = getPaystackFailureCode(payload);
            throw new ConvexError({
                code: "PAYSTACK_REQUEST_FAILED",
                message: buildPaystackFailureMessage(response.status, payload),
                provider: PAYMENT_PROVIDER_PAYSTACK,
                httpStatus: response.status,
                ...(providerCode ? { providerCode } : {}),
            });
        }

        return payload;
    } finally {
        clearTimeout(timeoutId);
    }
};

const sendBillingAlertEmail = async (params: {
    to: string[];
    subject: string;
    html: string;
}) => {
    if (!RESEND_API_KEY || params.to.length === 0) {
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${APP_NAME} <noreply@chewnpour.com>`,
                to: params.to,
                subject: params.subject,
                html: params.html,
            }),
        });

        if (!response.ok) {
            const body = await response.text().catch(() => "");
            console.error("[billing] failed to send alert email", {
                status: response.status,
                body: body.slice(0, 500),
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error("[billing] failed to send alert email", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

const verifyPaystackTransactionByReference = async (reference: string) => {
    if (!PAYSTACK_SECRET_KEY) {
        return {
            ok: false as const,
            kind: "verify_error",
            message: "PAYSTACK_NOT_CONFIGURED",
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);

    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload || payload.status !== true) {
            const message = buildPaystackFailureMessage(response.status, payload);
            const normalizedMessage = String(payload?.message || message).toLowerCase();
            if (response.status === 400 && normalizedMessage.includes("reference not found")) {
                return {
                    ok: false as const,
                    kind: "not_found",
                    message,
                    httpStatus: response.status,
                };
            }
            return {
                ok: false as const,
                kind: "verify_error",
                message,
                httpStatus: response.status,
            };
        }

        return {
            ok: true as const,
            payload,
            data: payload.data || {},
        };
    } catch (error) {
        return {
            ok: false as const,
            kind: "verify_error",
            message: error instanceof Error ? error.message : String(error),
        };
    } finally {
        clearTimeout(timeoutId);
    }
};

const getSubscriptionRecordByUserId = async (ctx: any, userId: string) => {
    return await ctx.db
        .query("subscriptions")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();
};

const getPaymentTransactionByReference = async (ctx: any, reference: string) => {
    return await ctx.db
        .query("paymentTransactions")
        .withIndex("by_reference", (q: any) => q.eq("reference", reference))
        .first();
};

const buildFallbackCheckoutRedirect = (reference: string, returnPath: string) => {
    const params = new URLSearchParams({
        reference,
        from: returnPath,
    });

    return buildAbsoluteAppUrl(`/subscription/callback?${params.toString()}`);
};

export const getHistoricalStoredUploadCount = async (ctx: any, userId: string) => {
    const [uploads, assignmentThreads] = await Promise.all([
        ctx.db
            .query("uploads")
            .withIndex("by_userId", (q: any) => q.eq("userId", userId))
            .collect(),
        ctx.db
            .query("assignmentThreads")
            .withIndex("by_userId", (q: any) => q.eq("userId", userId))
            .collect(),
    ]);

    return uploads.length + assignmentThreads.length;
};

const hasPremiumPaymentHistory = (subscription: any, purchasedCredits: number) =>
    purchasedCredits > 0
    && Boolean(
        String(subscription?.lastPaymentReference || "").trim()
        || toNonNegativeInt(subscription?.lastPaymentAt) > 0
    );

const resolveConsumedUploadCredits = (params: {
    subscription: any;
    purchasedCredits: number;
    storedConsumedCredits: number;
    historicalStoredUploadCount: number;
}) => {
    const hasPaidPremiumHistory = hasPremiumPaymentHistory(params.subscription, params.purchasedCredits);
    if (hasPaidPremiumHistory) {
        // For paid users, keep consumption ledger authoritative to avoid charging
        // pre-premium uploads against purchased credits.
        return toNonNegativeInt(params.storedConsumedCredits);
    }
    return Math.max(
        toNonNegativeInt(params.storedConsumedCredits),
        toNonNegativeInt(params.historicalStoredUploadCount),
    );
};

const buildUploadQuotaSnapshot = (params: {
    purchasedCredits: number;
    consumedCredits: number;
}) => {
    const purchasedCredits = toNonNegativeInt(params.purchasedCredits);
    const consumedCredits = toNonNegativeInt(params.consumedCredits);
    const totalAllowed = FREE_UPLOAD_LIMIT + purchasedCredits;
    const remaining = Math.max(0, totalAllowed - consumedCredits);
    const topUpOptions = buildLocalizedTopUpOptions({
        includeFirstTime: purchasedCredits === 0,
    });
    const defaultTopUpPlan = topUpOptions[0] || buildLocalizedTopUpPlan(DEFAULT_TOPUP_PLAN);

    return {
        freeLimit: FREE_UPLOAD_LIMIT,
        purchasedCredits,
        consumedCredits,
        totalAllowed,
        remaining,
        canTopUp: true,
        topUpPriceMajor: defaultTopUpPlan.amountMajor,
        currency: defaultTopUpPlan.currency,
        topUpCredits: defaultTopUpPlan.credits,
        topUpOptions,
    };
};

const computeUploadQuotaSnapshotForUser = async (
    ctx: any,
    userId: string,
) => {
    const [subscription, historicalStoredUploadCount] = await Promise.all([
        getSubscriptionRecordByUserId(ctx, userId),
        getHistoricalStoredUploadCount(ctx, userId),
    ]);

    const purchasedCredits = toNonNegativeInt(subscription?.purchasedUploadCredits);
    const storedConsumedCredits = toNonNegativeInt(subscription?.consumedUploadCredits);
    const consumedCredits = resolveConsumedUploadCredits({
        subscription,
        purchasedCredits,
        storedConsumedCredits,
        historicalStoredUploadCount,
    });

    return buildUploadQuotaSnapshot({
        purchasedCredits,
        consumedCredits,
    });
};

const buildUploadQuotaExceededError = (snapshot: ReturnType<typeof buildUploadQuotaSnapshot>) => {
    return new ConvexError({
        code: "UPLOAD_QUOTA_EXCEEDED",
        message: `Upload limit reached. Purchase a top-up: ${buildTopUpOptionsCopy(snapshot.topUpOptions)}.`,
        remaining: snapshot.remaining,
        totalAllowed: snapshot.totalAllowed,
        topUpPriceMajor: snapshot.topUpPriceMajor,
        currency: snapshot.currency,
        topUpCredits: snapshot.topUpCredits,
        topUpOptions: snapshot.topUpOptions,
    });
};

export const consumeUploadCreditOrThrow = async (
    ctx: any,
    userId: string,
    historicalStoredUploadCount?: number,
) => {
    const subscription = await getSubscriptionRecordByUserId(ctx, userId);
    const historicalBaseline = Number.isFinite(Number(historicalStoredUploadCount))
        ? toNonNegativeInt(historicalStoredUploadCount)
        : await getHistoricalStoredUploadCount(ctx, userId);

    const purchasedCredits = toNonNegativeInt(subscription?.purchasedUploadCredits);
    const storedConsumedCredits = toNonNegativeInt(subscription?.consumedUploadCredits);
    const consumedBefore = resolveConsumedUploadCredits({
        subscription,
        purchasedCredits,
        storedConsumedCredits,
        historicalStoredUploadCount: historicalBaseline,
    });

    const beforeSnapshot = buildUploadQuotaSnapshot({
        purchasedCredits,
        consumedCredits: consumedBefore,
    });

    if (beforeSnapshot.remaining <= 0) {
        throw buildUploadQuotaExceededError(beforeSnapshot);
    }

    const nextConsumedCredits = consumedBefore + 1;
    const plan = purchasedCredits > 0 ? "premium" : "free";
    const amount = purchasedCredits > 0 ? DEFAULT_TOPUP_PLAN.amountMajor : 0;

    if (subscription) {
        await ctx.db.patch(subscription._id, {
            consumedUploadCredits: nextConsumedCredits,
            purchasedUploadCredits: purchasedCredits,
            plan,
            status: subscription.status || "active",
            currency: subscription.currency || TOPUP_CURRENCY,
            amount: typeof subscription.amount === "number" ? subscription.amount : amount,
        });
    } else {
        await ctx.db.insert("subscriptions", {
            userId,
            plan,
            status: "active",
            amount,
            currency: TOPUP_CURRENCY,
            purchasedUploadCredits: purchasedCredits,
            consumedUploadCredits: nextConsumedCredits,
        });
    }

    return buildUploadQuotaSnapshot({
        purchasedCredits,
        consumedCredits: nextConsumedCredits,
    });
};

const applyPaystackTopUpCreditGrant = async (ctx: any, args: {
    userId?: string;
    reference: string;
    amountMinor: number;
    currency: string;
    customerEmail?: string;
    paidAtMs?: number;
    source: string;
    provider?: string;
    eventType?: string;
}) => {
    const reference = String(args.reference || "").trim();
    if (!reference) {
        return { applied: false, duplicate: false, reason: "missing_reference", remaining: 0 };
    }

    const existingTransaction = await getPaymentTransactionByReference(ctx, reference);
    if (existingTransaction && existingTransaction.status === "success") {
        const snapshot = await computeUploadQuotaSnapshotForUser(ctx, existingTransaction.userId);
        return {
            applied: false,
            duplicate: true,
            reason: "already_processed",
            remaining: snapshot.remaining,
        };
    }

    const resolvedUserId = String(existingTransaction?.userId || args.userId || "").trim();
    if (!resolvedUserId) {
        return { applied: false, duplicate: false, reason: "missing_user", remaining: 0 };
    }

    if (existingTransaction && existingTransaction.userId !== resolvedUserId) {
        return {
            applied: false,
            duplicate: false,
            reason: "reference_user_mismatch",
            remaining: 0,
        };
    }

    const amountMinor = toNonNegativeInt(args.amountMinor);
    const currency = normalizeCurrency(args.currency);
    const initializedAmountMinor = toNonNegativeInt(existingTransaction?.amountMinor);
    const initializedCurrency = normalizeCurrency(existingTransaction?.currency);

    if (
        existingTransaction
        && initializedAmountMinor > 0
        && amountMinor !== initializedAmountMinor
    ) {
        return {
            applied: false,
            duplicate: false,
            reason: "amount_mismatch",
            remaining: 0,
        };
    }

    if (
        existingTransaction
        && initializedCurrency
        && currency !== initializedCurrency
    ) {
        return {
            applied: false,
            duplicate: false,
            reason: "currency_mismatch",
            remaining: 0,
        };
    }

    const topUpPlan = resolveTopUpPlanByPayment(amountMinor, currency);
    if (!topUpPlan) {
        return {
            applied: false,
            duplicate: false,
            reason: "invalid_topup_plan",
            remaining: 0,
        };
    }

    const [subscription, historicalStoredUploadCount] = await Promise.all([
        getSubscriptionRecordByUserId(ctx, resolvedUserId),
        getHistoricalStoredUploadCount(ctx, resolvedUserId),
    ]);

    const purchasedCredits = toNonNegativeInt(subscription?.purchasedUploadCredits);
    const storedConsumedCredits = toNonNegativeInt(subscription?.consumedUploadCredits);
    const consumedCreditsBeforeTopUp = resolveConsumedUploadCredits({
        subscription,
        purchasedCredits,
        storedConsumedCredits,
        historicalStoredUploadCount,
    });
    const isFirstPaidGrant = purchasedCredits <= 0;
    const consumedCredits = isFirstPaidGrant
        ? Math.min(FREE_UPLOAD_LIMIT, consumedCreditsBeforeTopUp)
        : consumedCreditsBeforeTopUp;
    const nextPurchasedCredits = purchasedCredits + topUpPlan.credits;
    const paidAt = toNonNegativeInt(args.paidAtMs) || Date.now();

    // Compute expiry for semester pass plans
    const isSemesterPass = "validityDays" in topUpPlan && (topUpPlan as any).validityDays > 0;
    const planExpiresAt = isSemesterPass
        ? paidAt + ((topUpPlan as any).validityDays * 24 * 60 * 60 * 1000)
        : undefined;

    const subscriptionPatch: Record<string, any> = {
        plan: "premium",
        status: "active",
        amount: topUpPlan.amountMajor,
        currency: topUpPlan.currency,
        purchasedUploadCredits: nextPurchasedCredits,
        consumedUploadCredits: consumedCredits,
        lastPaymentReference: reference,
        lastPaymentAt: paidAt,
        lastTopUpPlanId: topUpPlan.id,
    };
    if (planExpiresAt !== undefined) {
        subscriptionPatch.planExpiresAt = planExpiresAt;
    }

    if (subscription) {
        await ctx.db.patch(subscription._id, subscriptionPatch);
    } else {
        await ctx.db.insert("subscriptions", {
            userId: resolvedUserId,
            ...subscriptionPatch,
        });
    }

    const paymentPatch = {
        amountMinor: topUpPlan.amountMinor,
        currency: topUpPlan.currency,
        status: "success",
        provider: resolvePaymentProvider(args.provider),
        source: args.source,
        paidAt,
        customerEmail: args.customerEmail,
        eventType: args.eventType || "charge.success",
    };

    if (existingTransaction) {
        await ctx.db.patch(existingTransaction._id, paymentPatch);
    } else {
        await ctx.db.insert("paymentTransactions", {
            userId: resolvedUserId,
            provider: resolvePaymentProvider(args.provider),
            reference,
            createdAt: Date.now(),
            ...paymentPatch,
        });
    }

    const snapshot = buildUploadQuotaSnapshot({
        purchasedCredits: nextPurchasedCredits,
        consumedCredits,
    });

    return {
        applied: true,
        duplicate: false,
        reason: "applied",
        remaining: snapshot.remaining,
        grantedCredits: topUpPlan.credits,
        amountMajor: topUpPlan.amountMajor,
        currency: topUpPlan.currency,
    };
};

// Get user's subscription (legacy compatibility)
export const getSubscription = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return null;

        const subscription = await getSubscriptionRecordByUserId(ctx, args.userId);

        if (!subscription) {
            return {
                plan: "free",
                status: "active",
                amount: 0,
                currency: TOPUP_CURRENCY,
                nextBillingDate: null,
                purchasedUploadCredits: 0,
                consumedUploadCredits: 0,
            };
        }

        return subscription;
    },
});

export const getUploadQuotaStatus = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        return await computeUploadQuotaSnapshotForUser(ctx, userId);
    },
});

export const getUploadQuotaStatusInternal = internalQuery({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        return await computeUploadQuotaSnapshotForUser(ctx, args.userId);
    },
});

export const getPublicTopUpPricing = query({
    args: {},
    handler: async (_ctx) => {
        const topUpOptions = buildLocalizedTopUpOptions();
        const defaultTopUpPlan = topUpOptions[0] || buildLocalizedTopUpPlan(DEFAULT_TOPUP_PLAN);

        return {
            freeLimit: FREE_UPLOAD_LIMIT,
            currency: defaultTopUpPlan.currency,
            topUpPriceMajor: defaultTopUpPlan.amountMajor,
            topUpCredits: defaultTopUpPlan.credits,
            topUpOptions,
            checkoutCurrencies: TOPUP_CHECKOUT_CURRENCIES,
        };
    },
});

export const getPaymentTransactionByReferenceInternal = internalQuery({
    args: {
        reference: v.string(),
    },
    handler: async (ctx, args) => {
        const reference = String(args.reference || "").trim();
        if (!reference) return null;
        return await getPaymentTransactionByReference(ctx, reference);
    },
});

export const getPaymentProviderSettingInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        return {
            provider: await readPaymentProviderSetting(ctx),
        };
    },
});

export const getBillingAlertRecipientsInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        const adminRows = await ctx.db.query("adminAccess").collect();
        return buildBillingAlertRecipients(adminRows.map((row: any) => row.email));
    },
});

export const listStalePaymentTransactionsInternal = internalQuery({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Math.max(1, Math.min(100, Math.floor(Number(args.limit) || PAYMENT_RECONCILE_BATCH_LIMIT)));
        const now = Date.now();
        const rows = await ctx.db.query("paymentTransactions").collect();
        return rows
            .filter((row: any) =>
                resolvePaymentProvider(row?.provider) === PAYMENT_PROVIDER_PAYSTACK
                && shouldRetryInitializedPayment(row, now)
            )
            .sort((left: any, right: any) => resolvePaymentCreatedAtMs(left) - resolvePaymentCreatedAtMs(right))
            .slice(0, limit);
    },
});

export const updatePaymentVerificationStateInternal = internalMutation({
    args: {
        reference: v.string(),
        status: v.optional(v.string()),
        source: v.optional(v.string()),
        eventType: v.optional(v.string()),
        paidAt: v.optional(v.number()),
        customerEmail: v.optional(v.string()),
        lastVerifiedAt: v.optional(v.number()),
        verificationStatus: v.optional(v.string()),
        verificationMessage: v.optional(v.string()),
        verificationAttemptsDelta: v.optional(v.number()),
        alertedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const reference = String(args.reference || "").trim();
        if (!reference) return null;

        const existing = await getPaymentTransactionByReference(ctx, reference);
        if (!existing) return null;

        const patch: Record<string, any> = {};
        if (typeof args.status === "string" && args.status.trim()) patch.status = args.status.trim();
        if (typeof args.source === "string" && args.source.trim()) patch.source = args.source.trim();
        if (typeof args.eventType === "string" && args.eventType.trim()) patch.eventType = args.eventType.trim();
        if (typeof args.customerEmail === "string" && args.customerEmail.trim()) {
            patch.customerEmail = args.customerEmail.trim();
        }
        if (typeof args.paidAt === "number" && Number.isFinite(args.paidAt) && args.paidAt > 0) {
            patch.paidAt = Math.floor(args.paidAt);
        }
        if (typeof args.lastVerifiedAt === "number" && Number.isFinite(args.lastVerifiedAt) && args.lastVerifiedAt > 0) {
            patch.lastVerifiedAt = Math.floor(args.lastVerifiedAt);
        }
        if (typeof args.verificationStatus === "string" && args.verificationStatus.trim()) {
            patch.verificationStatus = args.verificationStatus.trim();
        }
        if (typeof args.verificationMessage === "string") {
            patch.verificationMessage = truncateMessage(args.verificationMessage);
        }
        if (typeof args.alertedAt === "number" && Number.isFinite(args.alertedAt) && args.alertedAt > 0) {
            patch.alertedAt = Math.floor(args.alertedAt);
        }

        const attemptsDelta = toNonNegativeInt(args.verificationAttemptsDelta);
        if (attemptsDelta > 0) {
            patch.verificationAttempts = resolvePaymentVerificationAttempts(existing) + attemptsDelta;
        }

        await ctx.db.patch(existing._id, patch);
        return {
            ...existing,
            ...patch,
        };
    },
});

export const recordPaymentInitializationInternal = internalMutation({
    args: {
        userId: v.string(),
        reference: v.string(),
        amountMinor: v.number(),
        currency: v.string(),
        customerEmail: v.string(),
        provider: v.string(),
        source: v.string(),
    },
    handler: async (ctx, args) => {
        const reference = String(args.reference || "").trim();
        if (!reference) {
            throw new ConvexError({
                code: "INVALID_REFERENCE",
                message: "Payment reference is required.",
            });
        }

        const existing = await getPaymentTransactionByReference(ctx, reference);
        if (existing && existing.userId !== args.userId) {
            throw new ConvexError({
                code: "REFERENCE_CONFLICT",
                message: "This payment reference is already linked to another account.",
            });
        }

        const selectedPlan = resolveTopUpPlanByPayment(args.amountMinor, args.currency);
        if (!selectedPlan) {
            throw new ConvexError({
                code: "INVALID_TOPUP_PLAN",
                message: `Unsupported top-up plan. Available plans: ${TOPUP_OPTIONS_COPY}.`,
            });
        }

        const payload = {
            userId: args.userId,
            provider: resolvePaymentProvider(args.provider),
            reference,
            amountMinor: selectedPlan.amountMinor,
            currency: selectedPlan.currency,
            status: "initialized",
            source: args.source,
            createdAt: Date.now(),
            customerEmail: args.customerEmail,
            eventType: "checkout.initialize",
            verificationAttempts: 0,
            verificationStatus: "initialized",
            verificationMessage: "Checkout initialized.",
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            void ctx.scheduler.runAfter(PAYMENT_RECONCILE_DELAY_MS, internal.subscriptions.reconcilePaymentReferenceInternal, {
                reference,
                trigger: "post_checkout_init",
            });
            return existing._id;
        }

        const paymentId = await ctx.db.insert("paymentTransactions", payload);
        void ctx.scheduler.runAfter(PAYMENT_RECONCILE_DELAY_MS, internal.subscriptions.reconcilePaymentReferenceInternal, {
            reference,
            trigger: "post_checkout_init",
        });
        return paymentId;
    },
});

export const reconcileUploadConsumedCreditsInternal = internalMutation({
    args: {
        userId: v.string(),
        consumedUploadCredits: v.number(),
    },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) {
            throw new ConvexError({
                code: "INVALID_USER",
                message: "User id is required.",
            });
        }

        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        if (!subscription) {
            throw new ConvexError({
                code: "SUBSCRIPTION_NOT_FOUND",
                message: "Subscription record not found for user.",
            });
        }

        const consumedUploadCredits = toNonNegativeInt(args.consumedUploadCredits);
        const purchasedUploadCredits = toNonNegativeInt(subscription.purchasedUploadCredits);
        await ctx.db.patch(subscription._id, {
            consumedUploadCredits,
            purchasedUploadCredits,
            plan: purchasedUploadCredits > 0 ? "premium" : "free",
            status: subscription.status || "active",
            amount: typeof subscription.amount === "number"
                ? subscription.amount
                : purchasedUploadCredits > 0
                    ? DEFAULT_TOPUP_PLAN.amountMajor
                    : 0,
            currency: subscription.currency || TOPUP_CURRENCY,
        });

        const snapshot = await computeUploadQuotaSnapshotForUser(ctx, userId);
        return {
            userId,
            purchasedCredits: snapshot.purchasedCredits,
            consumedCredits: snapshot.consumedCredits,
            remaining: snapshot.remaining,
            totalAllowed: snapshot.totalAllowed,
        };
    },
});

export const applyVerifiedPaystackPaymentInternal = internalMutation({
    args: {
        userId: v.string(),
        reference: v.string(),
        amountMinor: v.number(),
        currency: v.string(),
        provider: v.string(),
        customerEmail: v.optional(v.string()),
        paidAtMs: v.optional(v.number()),
        source: v.string(),
        eventType: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await applyPaystackTopUpCreditGrant(ctx, {
            userId: args.userId,
            reference: args.reference,
            amountMinor: args.amountMinor,
            currency: args.currency,
            provider: args.provider,
            customerEmail: args.customerEmail,
            paidAtMs: args.paidAtMs,
            source: args.source,
            eventType: args.eventType,
        });
    },
});

export const reconcilePaymentReferenceInternal = internalAction({
    args: {
        reference: v.string(),
        trigger: v.optional(v.string()),
        sendAlert: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const reference = String(args.reference || "").trim();
        if (!reference) {
            return {
                ok: false,
                result: "missing_reference",
            };
        }

        const payment = await ctx.runQuery(internal.subscriptions.getPaymentTransactionByReferenceInternal, {
            reference,
        });
        if (!payment) {
            return {
                ok: false,
                reference,
                result: "missing_transaction",
            };
        }

        const provider = resolvePaymentProvider(payment.provider);
        if (provider !== PAYMENT_PROVIDER_PAYSTACK) {
            return {
                ok: false,
                reference,
                result: "ignored_provider",
                provider,
            };
        }

        if (normalizePaymentStatus(payment.status) === "success") {
            return {
                ok: true,
                reference,
                result: "already_success",
                provider,
            };
        }

        const now = Date.now();
        const trigger = String(args.trigger || "manual").trim() || "manual";
        const verifyResult = await verifyPaystackTransactionByReference(reference);

        const maybeSendAlert = async (params: {
            subject: string;
            headline: string;
            body: string[];
        }) => {
            if (args.sendAlert === false || toNonNegativeInt(payment.alertedAt) > 0) {
                return false;
            }

            const recipients = await ctx.runQuery(internal.subscriptions.getBillingAlertRecipientsInternal, {});
            const to = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
            if (to.length === 0) return false;

            const html = [
                "<div style=\"font-family:Arial,sans-serif;line-height:1.5\">",
                `<h2>${params.headline}</h2>`,
                "<ul>",
                ...params.body.map((line) => `<li>${line}</li>`),
                "</ul>",
                `<p><a href=\"${APP_BASE_URL}/admin\">Open admin dashboard</a></p>`,
                "</div>",
            ].join("");

            const sent = await sendBillingAlertEmail({
                to,
                subject: params.subject,
                html,
            });
            if (sent) {
                await ctx.runMutation(internal.subscriptions.updatePaymentVerificationStateInternal, {
                    reference,
                    alertedAt: now,
                });
            }
            return sent;
        };

        if (!verifyResult.ok) {
            const nextAttempts = resolvePaymentVerificationAttempts(payment) + 1;

            if (verifyResult.kind === "not_found") {
                const finalizeAsFailed = shouldFinalizeMissingReference(payment, now, nextAttempts);
                await ctx.runMutation(internal.subscriptions.updatePaymentVerificationStateInternal, {
                    reference,
                    status: finalizeAsFailed ? "failed" : undefined,
                    lastVerifiedAt: now,
                    verificationStatus: "not_found",
                    verificationMessage: verifyResult.message,
                    verificationAttemptsDelta: 1,
                    eventType: finalizeAsFailed ? "charge.not_found" : undefined,
                });

                return {
                    ok: true,
                    reference,
                    provider,
                    result: finalizeAsFailed ? "not_found_failed" : "not_found_pending",
                    verificationStatus: "not_found",
                    verificationMessage: verifyResult.message,
                };
            }

            await ctx.runMutation(internal.subscriptions.updatePaymentVerificationStateInternal, {
                reference,
                lastVerifiedAt: now,
                verificationStatus: "verify_error",
                verificationMessage: verifyResult.message,
                verificationAttemptsDelta: 1,
            });

            const shouldAlert =
                nextAttempts >= PAYMENT_VERIFY_ERROR_ALERT_ATTEMPTS
                && (now - resolvePaymentCreatedAtMs(payment)) >= PAYMENT_VERIFY_ERROR_ALERT_MIN_AGE_MS;
            const alertSent = shouldAlert
                ? await maybeSendAlert({
                    subject: `${APP_NAME} billing verification needs attention`,
                    headline: "Billing verification is stuck",
                    body: [
                        `Reference: ${reference}`,
                        `User: ${payment.customerEmail || payment.userId || "unknown"}`,
                        `Trigger: ${trigger}`,
                        `Attempts: ${nextAttempts}`,
                        `Reason: ${verifyResult.message}`,
                    ],
                })
                : false;

            return {
                ok: true,
                reference,
                provider,
                result: "verify_error",
                verificationStatus: "verify_error",
                verificationMessage: verifyResult.message,
                alertSent,
            };
        }

        const paymentData = verifyResult.data || {};
        const providerStatus = normalizeVerificationStatus(paymentData.status);
        const providerMessage = truncateMessage(
            paymentData.gateway_response || paymentData.message || paymentData.status || "Verification completed."
        );

        if (providerStatus !== "success") {
            const finalizeAsFailed = isFinalProviderFailureStatus(providerStatus);
            await ctx.runMutation(internal.subscriptions.updatePaymentVerificationStateInternal, {
                reference,
                status: finalizeAsFailed ? "failed" : undefined,
                lastVerifiedAt: now,
                verificationStatus: providerStatus || "provider_pending",
                verificationMessage: providerMessage,
                verificationAttemptsDelta: 1,
                eventType: providerStatus ? `charge.${providerStatus}` : undefined,
            });

            return {
                ok: true,
                reference,
                provider,
                result: finalizeAsFailed ? "provider_failed" : "provider_pending",
                verificationStatus: providerStatus || "provider_pending",
                verificationMessage: providerMessage,
            };
        }

        const paidAtMs = Number.isFinite(Date.parse(paymentData.paid_at))
            ? Date.parse(paymentData.paid_at)
            : now;
        const applyResult = await ctx.runMutation(internal.subscriptions.applyVerifiedPaystackPaymentInternal, {
            userId: String(payment.userId || "").trim(),
            reference,
            amountMinor: toNonNegativeInt(paymentData.amount || payment.amountMinor),
            currency: normalizeCurrency(paymentData.currency || payment.currency || TOPUP_CURRENCY),
            provider,
            customerEmail: String(paymentData?.customer?.email || payment.customerEmail || "").trim() || undefined,
            paidAtMs,
            source: "reconcile_verify",
            eventType: "charge.success",
        });

        await ctx.runMutation(internal.subscriptions.updatePaymentVerificationStateInternal, {
            reference,
            lastVerifiedAt: now,
            verificationStatus: applyResult.applied ? "recovered_success" : "duplicate_success",
            verificationMessage: applyResult.applied
                ? "Recovered via scheduled reconciliation."
                : "Payment was already credited before reconciliation finished.",
            verificationAttemptsDelta: 1,
            source: "reconcile_verify",
            eventType: "charge.success",
            customerEmail: String(paymentData?.customer?.email || payment.customerEmail || "").trim() || undefined,
            paidAt: paidAtMs,
        });

        const alertSent = applyResult.applied
            ? await maybeSendAlert({
                subject: `${APP_NAME} recovered a missed payment credit`,
                headline: "A missed payment credit was auto-recovered",
                body: [
                    `Reference: ${reference}`,
                    `User: ${String(paymentData?.customer?.email || payment.customerEmail || payment.userId || "unknown")}`,
                    `Amount: ${normalizeCurrency(paymentData.currency || payment.currency || TOPUP_CURRENCY)} ${((toNonNegativeInt(paymentData.amount || payment.amountMinor)) / 100).toFixed(2)}`,
                    `Trigger: ${trigger}`,
                    `Credits granted: ${toNonNegativeInt(applyResult.grantedCredits)}`,
                ],
            })
            : false;

        return {
            ok: true,
            reference,
            provider,
            result: applyResult.applied ? "applied" : "duplicate",
            grantedCredits: toNonNegativeInt(applyResult.grantedCredits),
            alertSent,
        };
    },
});

export const reconcileStalePaystackPaymentsInternal = internalAction({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const rows = await ctx.runQuery(internal.subscriptions.listStalePaymentTransactionsInternal, {
            limit: args.limit,
        });

        const summary = {
            scanned: rows.length,
            applied: 0,
            duplicates: 0,
            pending: 0,
            failed: 0,
            verifyErrors: 0,
        };

        for (const row of rows) {
            const result = await ctx.runAction(internal.subscriptions.reconcilePaymentReferenceInternal, {
                reference: row.reference,
                trigger: "cron",
            });
            switch (result?.result) {
                case "applied":
                    summary.applied += 1;
                    break;
                case "duplicate":
                case "already_success":
                    summary.duplicates += 1;
                    break;
                case "not_found_failed":
                case "provider_failed":
                    summary.failed += 1;
                    break;
                case "verify_error":
                    summary.verifyErrors += 1;
                    break;
                default:
                    summary.pending += 1;
                    break;
            }
        }

        return summary;
    },
});

const initializePaystackCheckout = async (
    args: {
        userId: string;
        reference: string;
        safeReturnPath: string;
        callbackUrl: string;
        plan: NonNullable<ReturnType<typeof resolveTopUpPlanById>>;
        customerEmail: string;
    }
) => {
    const initializePayload = await callPaystackApi("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
            email: args.customerEmail,
            amount: args.plan.amountMinor,
            currency: args.plan.currency,
            reference: args.reference,
            callback_url: args.callbackUrl,
            metadata: {
                userId: args.userId,
                returnPath: args.safeReturnPath,
                purpose: "upload_topup",
                topUpPlanId: args.plan.id,
                topUpCredits: args.plan.credits,
                topUpAmountMajor: args.plan.amountMajor,
                topUpCurrency: args.plan.currency,
            },
        }),
    });

    const authorizationUrl = String(initializePayload?.data?.authorization_url || "").trim();
    if (!authorizationUrl) {
        throw new ConvexError({
            code: "CHECKOUT_INIT_FAILED",
            message: "Could not start checkout right now. Please try again.",
        });
    }

    return {
        authorizationUrl,
        provider: PAYMENT_PROVIDER_PAYSTACK,
    };
};

const initializeManualCheckout = async (
    args: {
        safeReturnPath: string;
        reference: string;
    }
) => ({
    authorizationUrl: buildFallbackCheckoutRedirect(args.reference, args.safeReturnPath),
    provider: PAYMENT_PROVIDER_MANUAL,
});

export const initializePaystackTopUpCheckout = action({
    args: {
        returnPath: v.string(),
        topUpPlanId: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        const safeReturnPath = sanitizeReturnPath(args.returnPath);
        const selectedPlan = resolveTopUpPlanById(args.topUpPlanId);
        if (!selectedPlan) {
            throw new ConvexError({
                code: "INVALID_TOPUP_PLAN",
                message: `Choose a valid top-up plan: ${TOPUP_OPTIONS_COPY}.`,
            });
        }

        const reference = buildPaymentReference(userId);
        const customerEmail = getPaystackCustomerEmail(identity, userId);
        const paymentProviderSetting = await ctx.runQuery(
            internal.subscriptions.getPaymentProviderSettingInternal,
            {}
        );
        const provider = resolvePaymentProvider(paymentProviderSetting?.provider);

        const callbackParams = new URLSearchParams({
            reference,
            from: safeReturnPath,
        });

        const callbackUrl = buildAbsoluteAppUrl(`/subscription/callback?${callbackParams.toString()}`);

        try {
            await ctx.runMutation(internal.subscriptions.recordPaymentInitializationInternal, {
                userId,
                reference,
                amountMinor: selectedPlan.amountMinor,
                currency: selectedPlan.currency,
                customerEmail,
                provider,
                source: "checkout_init",
            });
        } catch {
            throw new ConvexError({
                code: "CHECKOUT_INIT_FAILED",
                message: "Could not start checkout right now. Please try again.",
            });
        }

        let initializePayload: {
            authorizationUrl: string;
            provider: string;
        };

        try {
            if (provider === PAYMENT_PROVIDER_MANUAL) {
                initializePayload = await initializeManualCheckout({
                    safeReturnPath,
                    reference,
                });
            } else {
                initializePayload = await initializePaystackCheckout({
                    userId,
                    reference,
                    safeReturnPath,
                    callbackUrl,
                    plan: selectedPlan,
                    customerEmail,
                });
            }
        } catch (error) {
            if (error instanceof ConvexError) {
                throw error;
            }
            throw new ConvexError({
                code: "CHECKOUT_INIT_FAILED",
                message: "Could not start checkout right now. Please try again.",
            });
        }

        const authorizationUrl = String(initializePayload.authorizationUrl || "").trim();
        if (!authorizationUrl) {
            throw new ConvexError({
                code: "CHECKOUT_INIT_FAILED",
                message: "Could not start checkout right now. Please try again.",
            });
        }

        return {
            authorizationUrl,
            reference,
            topUpPlanId: selectedPlan.id,
            amountMajor: selectedPlan.amountMajor,
            currency: selectedPlan.currency,
            provider: initializePayload.provider,
        };
    },
});

export const verifyPaystackTopUpAfterRedirect = action({
    args: {
        reference: v.string(),
        returnPath: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        const safeReturnPath = sanitizeReturnPath(args.returnPath);
        const reference = String(args.reference || "").trim();

        if (!reference) {
            const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
            return {
                success: false,
                remaining: quota.remaining,
                redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "missing_reference"),
            };
        }

        const initializedTransaction = await ctx.runQuery(
            internal.subscriptions.getPaymentTransactionByReferenceInternal,
            { reference }
        );

        if (!initializedTransaction || initializedTransaction.userId !== userId) {
            const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
            return {
                success: false,
                remaining: quota.remaining,
                redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "invalid_reference"),
            };
        }

        const provider = resolvePaymentProvider(initializedTransaction.provider);

        try {
            if (provider === PAYMENT_PROVIDER_MANUAL) {
                const expectedAmountMinor = toNonNegativeInt(initializedTransaction.amountMinor);
                const expectedCurrency = normalizeCurrency(initializedTransaction.currency);

                const expectedPlan = resolveTopUpPlanByPayment(expectedAmountMinor, expectedCurrency);
                if (!expectedPlan) {
                    const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
                    return {
                        success: false,
                        remaining: quota.remaining,
                        redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "payment_mismatch"),
                    };
                }

                const applyResult = await ctx.runMutation(internal.subscriptions.applyVerifiedPaystackPaymentInternal, {
                    userId,
                    reference,
                    amountMinor: expectedAmountMinor,
                    currency: expectedCurrency,
                    provider,
                    customerEmail: initializedTransaction.customerEmail,
                    paidAtMs: Date.now(),
                    source: "callback_verify",
                    eventType: "charge.success",
                });

                return {
                    success: applyResult.applied || applyResult.duplicate,
                    remaining: toNonNegativeInt(applyResult.remaining),
                    redirectTo: safeReturnPath,
                    grantedCredits: toNonNegativeInt(applyResult.grantedCredits),
                    amountMajor: Number.isFinite(Number(applyResult.amountMajor))
                        ? Number(applyResult.amountMajor)
                        : 0,
                    currency: String(applyResult.currency || TOPUP_CURRENCY),
                    provider,
                };
            }

            const verifyPayload = await callPaystackApi(`/transaction/verify/${encodeURIComponent(reference)}`, {
                method: "GET",
            });
            const paymentData = verifyPayload?.data || {};
            const paymentStatus = String(paymentData.status || "").toLowerCase();
            const amountMinor = toNonNegativeInt(paymentData.amount);
            const currency = normalizeCurrency(paymentData.currency);
            const paidAtMs = paymentData.paid_at ? Date.parse(paymentData.paid_at) : Date.now();
            const customerEmail = String(paymentData?.customer?.email || initializedTransaction.customerEmail || "").trim();
            const expectedAmountMinor = toNonNegativeInt(initializedTransaction.amountMinor);
            const expectedCurrency = normalizeCurrency(initializedTransaction.currency);
            const expectedPlan = resolveTopUpPlanByPayment(expectedAmountMinor, expectedCurrency);

            if (paymentStatus !== "success") {
                const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
                return {
                    success: false,
                    remaining: quota.remaining,
                    redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "payment_not_success"),
                };
            }

            if (
                !expectedPlan
                || amountMinor !== expectedAmountMinor
                || currency !== expectedCurrency
            ) {
                const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
                return {
                    success: false,
                    remaining: quota.remaining,
                    redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "payment_mismatch"),
                };
            }

            const applyResult = await ctx.runMutation(internal.subscriptions.applyVerifiedPaystackPaymentInternal, {
                userId,
                reference,
                amountMinor,
                currency,
                customerEmail,
                paidAtMs: Number.isFinite(paidAtMs) ? paidAtMs : Date.now(),
                source: "callback_verify",
                provider,
                eventType: "charge.success",
            });

            return {
                success: applyResult.applied || applyResult.duplicate,
                remaining: toNonNegativeInt(applyResult.remaining),
                redirectTo: safeReturnPath,
                grantedCredits: toNonNegativeInt(applyResult.grantedCredits),
                amountMajor: Number.isFinite(Number(applyResult.amountMajor))
                    ? Number(applyResult.amountMajor)
                    : 0,
                currency: String(applyResult.currency || TOPUP_CURRENCY),
                provider,
            };
        } catch {
            const quota = await ctx.runQuery(internal.subscriptions.getUploadQuotaStatusInternal, { userId });
            return {
                success: false,
                remaining: quota.remaining,
                redirectTo: buildSubscriptionFailureRedirect(safeReturnPath, "verification_failed"),
            };
        }
    },
});

export const processPaystackWebhookEvent = mutation({
    args: {
        forwardSecret: v.string(),
        eventType: v.string(),
        reference: v.string(),
        amountMinor: v.number(),
        currency: v.string(),
        customerEmail: v.optional(v.string()),
        paidAtMs: v.optional(v.number()),
        payloadHash: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        if (!PAYSTACK_WEBHOOK_FORWARD_SECRET || args.forwardSecret !== PAYSTACK_WEBHOOK_FORWARD_SECRET) {
            throw new ConvexError({
                code: "UNAUTHORIZED_WEBHOOK",
                message: "Webhook verification failed.",
            });
        }

        if (String(args.eventType || "").toLowerCase() !== "charge.success") {
            return {
                applied: false,
                duplicate: false,
                reason: "ignored_event",
            };
        }

        const reference = String(args.reference || "").trim();
        if (!reference) {
            return {
                applied: false,
                duplicate: false,
                reason: "missing_reference",
            };
        }

        const initializedTransaction = await getPaymentTransactionByReference(ctx, reference);
        if (!initializedTransaction) {
            return {
                applied: false,
                duplicate: false,
                reason: "unknown_reference",
            };
        }

        const provider = resolvePaymentProvider(initializedTransaction.provider);
        if (provider !== PAYMENT_PROVIDER_PAYSTACK) {
            return {
                applied: false,
                duplicate: false,
                reason: "ignored_provider",
                provider,
            };
        }

        const result = await applyPaystackTopUpCreditGrant(ctx, {
            userId: initializedTransaction.userId,
            reference,
            amountMinor: args.amountMinor,
            currency: args.currency,
            provider,
            customerEmail: args.customerEmail,
            paidAtMs: args.paidAtMs,
            source: "webhook",
            eventType: args.eventType,
        });

        return {
            applied: result.applied,
            duplicate: result.duplicate,
            reason: result.reason,
        };
    },
});

// Create or update subscription (legacy compatibility)
export const upsertSubscription = mutation({
    args: {
        userId: v.string(),
        plan: v.string(),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        status: v.string(),
        nextBillingDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await getSubscriptionRecordByUserId(ctx, args.userId);

        if (existing) {
            await ctx.db.patch(existing._id, {
                plan: args.plan,
                amount: args.amount,
                currency: args.currency,
                status: args.status,
                nextBillingDate: args.nextBillingDate,
            });
            return existing._id;
        }

        return await ctx.db.insert("subscriptions", {
            userId: args.userId,
            plan: args.plan,
            amount: args.amount,
            currency: args.currency,
            status: args.status,
            nextBillingDate: args.nextBillingDate,
        });
    },
});

// Legacy premium upgrade entry point (kept for compatibility)
export const upgradeToPremium = mutation({
    args: {
        userId: v.string(),
        amount: v.number(),
        currency: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await getSubscriptionRecordByUserId(ctx, args.userId);
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);

        const data = {
            plan: "premium",
            status: "active",
            amount: args.amount,
            currency: args.currency,
            nextBillingDate: nextBilling.toISOString(),
            purchasedUploadCredits: Math.max(
                toNonNegativeInt(existing?.purchasedUploadCredits),
                LEGACY_PREMIUM_MIN_CREDITS,
            ),
        };

        if (existing) {
            await ctx.db.patch(existing._id, data);
            return existing._id;
        }

        return await ctx.db.insert("subscriptions", {
            userId: args.userId,
            ...data,
        });
    },
});

// Cancel subscription (legacy compatibility)
export const cancelSubscription = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const subscription = await getSubscriptionRecordByUserId(ctx, args.userId);

        if (subscription) {
            await ctx.db.patch(subscription._id, {
                status: "cancelled",
                plan: "free",
            });
        }
    },
});

// ── Voice + Humanizer Rate Limiting ─────────────────────────────────────────

const FREE_VOICE_GENERATION_LIMIT = 1;
const FREE_REEXPLAIN_LIMIT = 1;
const FREE_HUMANIZER_DAILY_LIMIT = 1;
const FREE_AI_MESSAGE_DAILY_LIMIT = 2;

const getHumanizerUsageToday = async (ctx: any, userId: string) => {
    const todayUTC = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
        .query("humanizerUsage")
        .withIndex("by_userId_date", (q: any) => q.eq("userId", userId).eq("date", todayUTC))
        .first();
    return { row, date: todayUTC, count: toNonNegativeInt(row?.count) };
};

const getAiMessageUsageToday = async (ctx: any, userId: string) => {
    const todayUTC = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
        .query("aiMessageUsage")
        .withIndex("by_userId_date", (q: any) => q.eq("userId", userId).eq("date", todayUTC))
        .first();
    return { row, date: todayUTC, count: toNonNegativeInt(row?.count) };
};

const isUserPremium = (subscription: any) => {
    if (!subscription) return false;
    const plan = String(subscription.plan || "").toLowerCase();
    const status = String(subscription.status || "").toLowerCase();
    if (plan !== "premium" || status !== "active") return false;

    // Check if the plan has an expiry (semester pass)
    const expiresAt = toNonNegativeInt(subscription.planExpiresAt);
    if (expiresAt > 0 && Date.now() > expiresAt) {
        return false;
    }

    return true;
};

export const getVoiceGenerationQuotaStatus = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        const premium = isUserPremium(subscription);
        const used = toNonNegativeInt(subscription?.consumedVoiceGenerations);
        const limit = premium ? Infinity : FREE_VOICE_GENERATION_LIMIT;
        const remaining = premium ? Infinity : Math.max(0, limit - used);
        return { limit, used, remaining, isPremium: premium };
    },
});

export const getAiMessageQuotaStatus = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        const premium = isUserPremium(subscription);
        const { count } = await getAiMessageUsageToday(ctx, userId);
        const limit = premium ? Infinity : FREE_AI_MESSAGE_DAILY_LIMIT;
        const remaining = premium ? Infinity : Math.max(0, limit - count);
        return { limit, used: count, remaining, isPremium: premium };
    },
});

export const consumeAiMessageCreditOrThrow = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });

        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        const premium = isUserPremium(subscription);
        if (premium) {
            return {
                limit: Infinity,
                used: 0,
                remaining: Infinity,
                isPremium: true,
            };
        }

        const { row, date, count } = await getAiMessageUsageToday(ctx, userId);
        if (count >= FREE_AI_MESSAGE_DAILY_LIMIT) {
            throw new ConvexError({
                code: "AI_MESSAGE_QUOTA_EXCEEDED",
                message: "You've used your free AI messages today. Upgrade to premium for unlimited AI chat.",
                used: count,
                limit: FREE_AI_MESSAGE_DAILY_LIMIT,
            });
        }

        const nextCount = count + 1;
        if (row) {
            await ctx.db.patch(row._id, { count: nextCount });
        } else {
            await ctx.db.insert("aiMessageUsage", { userId, date, count: nextCount });
        }

        return {
            limit: FREE_AI_MESSAGE_DAILY_LIMIT,
            used: nextCount,
            remaining: Math.max(0, FREE_AI_MESSAGE_DAILY_LIMIT - nextCount),
            isPremium: false,
        };
    },
});

export const consumeVoiceGenerationCreditOrThrow = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });

        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        if (isUserPremium(subscription)) {
            return {
                limit: Infinity,
                used: toNonNegativeInt(subscription?.consumedVoiceGenerations),
                remaining: Infinity,
                isPremium: true,
            };
        }

        const used = toNonNegativeInt(subscription?.consumedVoiceGenerations);
        if (used >= FREE_VOICE_GENERATION_LIMIT) {
            throw new ConvexError({
                code: "VOICE_QUOTA_EXCEEDED",
                message: "You've used your free AI voice generation. Upgrade to premium for unlimited AI voice.",
                used,
                limit: FREE_VOICE_GENERATION_LIMIT,
            });
        }

        const nextUsed = used + 1;
        if (subscription) {
            await ctx.db.patch(subscription._id, {
                consumedVoiceGenerations: nextUsed,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: TOPUP_CURRENCY,
                purchasedUploadCredits: 0,
                consumedUploadCredits: 0,
                consumedVoiceGenerations: nextUsed,
            });
        }

        return {
            limit: FREE_VOICE_GENERATION_LIMIT,
            used: nextUsed,
            remaining: Math.max(0, FREE_VOICE_GENERATION_LIMIT - nextUsed),
            isPremium: false,
        };
    },
});

export const consumeReExplainCreditOrThrow = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });

        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        if (isUserPremium(subscription)) {
            return {
                limit: Infinity,
                used: toNonNegativeInt(subscription?.consumedReExplanations),
                remaining: Infinity,
                isPremium: true,
            };
        }

        const used = toNonNegativeInt(subscription?.consumedReExplanations);
        if (used >= FREE_REEXPLAIN_LIMIT) {
            throw new ConvexError({
                code: "REEXPLAIN_QUOTA_EXCEEDED",
                message: "You've used your free lesson re-explain. Upgrade to premium for unlimited re-explains.",
                used,
                limit: FREE_REEXPLAIN_LIMIT,
            });
        }

        const nextUsed = used + 1;
        if (subscription) {
            await ctx.db.patch(subscription._id, {
                consumedReExplanations: nextUsed,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: TOPUP_CURRENCY,
                purchasedUploadCredits: 0,
                consumedUploadCredits: 0,
                consumedVoiceGenerations: 0,
                consumedReExplanations: nextUsed,
            });
        }

        return {
            limit: FREE_REEXPLAIN_LIMIT,
            used: nextUsed,
            remaining: Math.max(0, FREE_REEXPLAIN_LIMIT - nextUsed),
            isPremium: false,
        };
    },
});

export const getHumanizerQuotaStatus = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = assertAuthenticatedUserId(identity);
        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        const premium = isUserPremium(subscription);
        const { count } = await getHumanizerUsageToday(ctx, userId);
        const limit = premium ? Infinity : FREE_HUMANIZER_DAILY_LIMIT;
        const remaining = premium ? Infinity : Math.max(0, limit - count);
        return { limit, used: count, remaining, isPremium: premium };
    },
});

export const consumeHumanizerCreditOrThrow = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userId = String(args.userId || "").trim();
        if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED", message: "You must be signed in." });

        const subscription = await getSubscriptionRecordByUserId(ctx, userId);
        const premium = isUserPremium(subscription);

        if (!premium) {
            const { row, date, count } = await getHumanizerUsageToday(ctx, userId);
            if (count >= FREE_HUMANIZER_DAILY_LIMIT) {
                throw new ConvexError({
                    code: "HUMANIZER_QUOTA_EXCEEDED",
                    message: "You've used your free humanization today. Upgrade to premium for unlimited access.",
                    used: count,
                    limit: FREE_HUMANIZER_DAILY_LIMIT,
                });
            }
            if (row) {
                await ctx.db.patch(row._id, { count: count + 1 });
            } else {
                await ctx.db.insert("humanizerUsage", { userId, date, count: 1 });
            }
        }
    },
});
