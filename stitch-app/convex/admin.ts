import { action, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_USERS_5M_WINDOW_MS = 5 * 60 * 1000;
const NEW_USER_WINDOW_DAYS = 7;
const ACTIVE_USER_WINDOW_DAYS = 7;
const RECENT_USERS_LIMIT = 20;
const RECENT_FEEDBACK_LIMIT = 100;
const RECENT_RESEARCH_RESPONSES_LIMIT = 100;
const BOOTSTRAP_ADMIN_EMAILS = ["patrickannor35@gmail.com"];
const BETTER_AUTH_PAGE_SIZE = 200;
const BETTER_AUTH_MAX_PAGES = 12;
const BETTER_AUTH_USER_CHUNK_SIZE = 100;
const DEFAULT_ESTIMATED_AI_MESSAGE_TOKENS = 1800;
const DEFAULT_ESTIMATED_HUMANIZER_TOKENS = 5000;
const MIN_ESTIMATED_AI_MESSAGE_TOKENS = 1200;
const MAX_ESTIMATED_AI_MESSAGE_TOKENS = 4000;
const MIN_ESTIMATED_HUMANIZER_TOKENS = 3000;
const MAX_ESTIMATED_HUMANIZER_TOKENS = 9000;
const PAYMENT_PROVIDER_KEY = "paymentProvider";
const PAYMENT_PROVIDER_PAYSTACK = "paystack";
const PAYMENT_PROVIDER_MANUAL = "manual";
const PAYMENT_PROVIDER_OPTIONS = [
    {
        id: PAYMENT_PROVIDER_PAYSTACK,
        label: "Paystack",
        requiresKey: true,
    },
    {
        id: PAYMENT_PROVIDER_MANUAL,
        label: "Manual (no API key)",
        requiresKey: false,
    },
] as const;
const PAYMENT_PROVIDER_DEFAULT = String(process.env.PAYMENT_PROVIDER || PAYMENT_PROVIDER_PAYSTACK)
    .trim()
    .toLowerCase();
const PAYMENT_RECONCILE_MIN_AGE_MS = 15 * 60 * 1000;
const PAYMENT_RECONCILE_RETRY_INTERVAL_MS = 60 * 60 * 1000;
const UNRESOLVED_PAYMENT_ROWS_LIMIT = 25;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const parseCommaSeparated = (value: string | undefined, transform?: (item: string) => string) => {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (transform ? transform(item) : item));
};

const parseConfiguredAdminEmails = () =>
    new Set(parseCommaSeparated(process.env.ADMIN_EMAILS, (item) => item.toLowerCase()));

const parseConfiguredAdminUserIds = () =>
    new Set(parseCommaSeparated(process.env.ADMIN_USER_IDS));

const resolvePaymentProvider = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === PAYMENT_PROVIDER_PAYSTACK || normalized === PAYMENT_PROVIDER_MANUAL) {
        return normalized;
    }
    return PAYMENT_PROVIDER_DEFAULT;
};

const getPaymentProviderDisplayName = (provider: unknown) => {
    const normalized = resolvePaymentProvider(provider);
    for (const option of PAYMENT_PROVIDER_OPTIONS) {
        if (option.id === normalized) return option.label;
    }
    return PAYMENT_PROVIDER_OPTIONS[0].label;
};

const readPaymentProviderSetting = async (ctx: any) => {
    const row = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q: any) => q.eq("key", PAYMENT_PROVIDER_KEY))
        .first();
    if (row && typeof row.value === "string" && row.value.trim()) {
        return {
            provider: resolvePaymentProvider(row.value),
            updatedAt: Number(row.updatedAt) || 0,
            updatedByUserId: typeof row.updatedByUserId === "string" ? row.updatedByUserId : null,
        };
    }

    return {
        provider: resolvePaymentProvider(PAYMENT_PROVIDER_DEFAULT),
        updatedAt: 0,
        updatedByUserId: null,
    };
};

const normalizeUserIdCandidate = (value: unknown) => {
    if (typeof value !== "string") return "";
    const normalized = value.trim();
    return normalized || "";
};

const pushUnique = (target: string[], value: unknown) => {
    const normalized = normalizeUserIdCandidate(value);
    if (!normalized || target.includes(normalized)) return;
    target.push(normalized);
};

const collectAuthUserIdCandidates = (identity: any) => {
    if (!identity || typeof identity !== "object") return [] as string[];

    const candidates: string[] = [];
    pushUnique(candidates, identity.subject);
    pushUnique(candidates, identity.userId);
    pushUnique(candidates, identity.id);

    const tokenIdentifier = normalizeUserIdCandidate(identity.tokenIdentifier);
    if (tokenIdentifier) {
        pushUnique(candidates, tokenIdentifier);

        // Some auth providers encode a stable user id in tokenIdentifier segments.
        const pipeSegments = tokenIdentifier
            .split("|")
            .map((segment: string) => segment.trim())
            .filter(Boolean);
        if (pipeSegments.length > 1) {
            pushUnique(candidates, pipeSegments[pipeSegments.length - 1]);
        }
        const colonSegments = tokenIdentifier
            .split(":")
            .map((segment: string) => segment.trim())
            .filter(Boolean);
        if (colonSegments.length > 1) {
            pushUnique(candidates, colonSegments[colonSegments.length - 1]);
        }
    }

    return candidates;
};

const resolveAuthUserId = (identity: any) => collectAuthUserIdCandidates(identity)[0] || "";

const normalizeEmail = (value: unknown) =>
    typeof value === "string" && value.trim()
        ? value.trim().toLowerCase()
        : "";

const resolveIdentityEmail = (identity: any) => {
    if (!identity || typeof identity !== "object") return "";
    return (
        normalizeEmail(identity.email)
        || normalizeEmail(identity.claims?.email)
        || normalizeEmail(identity.profile?.email)
    );
};

const normalizeFeedbackMessage = (value: unknown) =>
    typeof value === "string"
        ? value.trim()
        : "";

const isValidEmail = (value: string) => EMAIL_PATTERN.test(value);

const toTimestamp = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeNumber = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
};

const toNonNegativeInteger = (value: unknown) =>
    Math.max(0, Math.floor(toNonNegativeNumber(value)));

const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const normalizeCurrencyCode = (value: unknown, fallback = "GHS") => {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized || fallback;
};

const normalizeUploadStatus = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "ready" || normalized === "processing" || normalized === "error") {
        return normalized;
    }
    return "other";
};

const normalizePaymentStatus = (value: unknown) =>
    String(value || "").trim().toLowerCase();

const normalizePaymentEventType = (value: unknown) =>
    String(value || "").trim().toLowerCase();

const normalizeSubscriptionPlan = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized || "free";
};

const normalizeSubscriptionStatus = (value: unknown) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized || "unknown";
};

const isSuccessfulPayment = (payment: any) => {
    const status = normalizePaymentStatus(payment?.status);
    const eventType = normalizePaymentEventType(payment?.eventType);
    return (
        status === "success"
        || status === "succeeded"
        || status === "paid"
        || eventType === "charge.success"
    );
};

const isFailedPayment = (payment: any) => {
    const status = normalizePaymentStatus(payment?.status);
    return (
        status === "failed"
        || status === "error"
        || status === "abandoned"
        || status === "cancelled"
    );
};

const resolvePaymentTimestamp = (payment: any) =>
    toTimestamp(
        payment?.paidAt,
        toTimestamp(payment?.createdAt, toTimestamp(payment?._creationTime, 0))
    );

const resolvePaymentLastVerifiedAt = (payment: any) =>
    toTimestamp(payment?.lastVerifiedAt, 0);

const resolvePaymentVerificationAttempts = (payment: any) =>
    toNonNegativeInteger(payment?.verificationAttempts);

const normalizePaymentVerificationStatus = (value: unknown) =>
    String(value || "").trim().toLowerCase();

const isUnresolvedPayment = (payment: any, now: number) => {
    const status = normalizePaymentStatus(payment?.status);
    const verificationStatus = normalizePaymentVerificationStatus(payment?.verificationStatus);
    if (status !== "initialized") return false;

    const createdAt = toTimestamp(payment?.createdAt, toTimestamp(payment?._creationTime, 0));
    if (createdAt <= 0) return false;

    const lastVerifiedAt = resolvePaymentLastVerifiedAt(payment);
    const nextEligibleAt = lastVerifiedAt > 0
        ? lastVerifiedAt + PAYMENT_RECONCILE_RETRY_INTERVAL_MS
        : createdAt + PAYMENT_RECONCILE_MIN_AGE_MS;

    if (now < nextEligibleAt) return false;
    if (!verificationStatus) return true;
    return verificationStatus !== "recovered_success" && verificationStatus !== "duplicate_success";
};

const normalizeFileExtension = (fileName: unknown) => {
    if (typeof fileName !== "string") return "";
    const trimmed = fileName.trim().toLowerCase();
    if (!trimmed) return "";
    const lastDotIndex = trimmed.lastIndexOf(".");
    if (lastDotIndex <= 0 || lastDotIndex >= trimmed.length - 1) return "";
    const extension = trimmed.slice(lastDotIndex + 1).replace(/[^a-z0-9]/g, "");
    return extension || "";
};

const normalizeUploadFileType = (fileType: unknown, fileName?: unknown) => {
    const normalizedFileType = typeof fileType === "string" ? fileType.trim().toLowerCase() : "";

    if (normalizedFileType) {
        if (normalizedFileType.includes("pdf")) return "pdf";
        if (
            normalizedFileType.includes("wordprocessingml")
            || normalizedFileType.includes("msword")
            || normalizedFileType === "doc"
            || normalizedFileType === "docx"
        ) {
            return "docx";
        }
        if (
            normalizedFileType.includes("presentationml")
            || normalizedFileType.includes("powerpoint")
            || normalizedFileType === "ppt"
            || normalizedFileType === "pptx"
        ) {
            return "pptx";
        }
        if (normalizedFileType.startsWith("image/") || normalizedFileType === "image") return "image";
        if (normalizedFileType.includes("text/plain") || normalizedFileType === "txt") return "txt";
        if (normalizedFileType.includes("zip") || normalizedFileType === "zip") return "zip";
        if (/^[a-z0-9]+$/.test(normalizedFileType) && normalizedFileType.length <= 16) {
            return normalizedFileType;
        }
    }

    const extension = normalizeFileExtension(fileName);
    if (!extension) return "unknown";

    if (extension === "jpeg" || extension === "jpg" || extension === "png" || extension === "gif" || extension === "webp" || extension === "heic" || extension === "heif" || extension === "bmp" || extension === "svg") {
        return "image";
    }
    if (extension === "doc") return "docx";
    if (extension === "ppt") return "pptx";
    if (extension === "text") return "txt";
    if (extension.length <= 16) return extension;
    return "unknown";
};

const incrementMap = (map: Map<string, number>, key: string, amount = 1) => {
    map.set(key, (map.get(key) || 0) + amount);
};

const updateMaxTimestamp = (map: Map<string, number>, key: string, timestampMs: number) => {
    const previous = map.get(key) || 0;
    if (timestampMs > previous) {
        map.set(key, timestampMs);
    }
};

const markActiveWindow = (
    userId: string,
    timestampMs: number,
    sevenDaysAgo: number,
    fourteenDaysAgo: number,
    activeUsersLastWindow: Set<string>,
    activeUsersPrevWindow: Set<string>
) => {
    if (!userId) return;
    if (timestampMs >= sevenDaysAgo) {
        activeUsersLastWindow.add(userId);
        return;
    }
    if (timestampMs >= fourteenDaysAgo) {
        activeUsersPrevWindow.add(userId);
    }
};

const normalizeSessionUserId = (session: any) =>
    String(session?.userId || "").trim();

const normalizeAuthUserId = (user: any) =>
    String(user?._id || "").trim();

const buildCampaignUserKey = (campaignId: string, userId: string) =>
    `${campaignId}::${userId}`;

const chunkArray = <T>(items: T[], chunkSize: number) => {
    const safeChunkSize = Math.max(1, Math.floor(chunkSize));
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += safeChunkSize) {
        chunks.push(items.slice(index, index + safeChunkSize));
    }
    return chunks;
};

const fetchBetterAuthRows = async (
    ctx: any,
    params: {
        model: "user" | "session";
        where?: Array<Record<string, unknown>>;
        sortBy?: { field: string; direction: "asc" | "desc" };
        pageSize?: number;
        maxPages?: number;
    }
) => {
    const pageSize = Math.max(
        1,
        Math.min(200, Math.floor(Number(params.pageSize) || BETTER_AUTH_PAGE_SIZE))
    );
    const maxPages = Math.max(1, Math.floor(Number(params.maxPages) || BETTER_AUTH_MAX_PAGES));
    const rows: any[] = [];
    let cursor: string | null = null;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: params.model,
            where: params.where,
            sortBy: params.sortBy,
            paginationOpts: {
                cursor,
                numItems: pageSize,
            },
        });

        const pageRows = Array.isArray(result?.page) ? result.page : [];
        rows.push(...pageRows);

        if (result?.isDone) {
            return { rows, truncated: false };
        }

        const nextCursor =
            typeof result?.continueCursor === "string" ? result.continueCursor : null;
        if (!nextCursor || nextCursor === cursor) {
            return { rows, truncated: true };
        }
        cursor = nextCursor;
    }

    return { rows, truncated: true };
};

const fetchAuthUsersByIds = async (ctx: any, userIds: string[]) => {
    const normalizedIds = Array.from(
        new Set(
            userIds
                .map((userId) => String(userId || "").trim())
                .filter(Boolean)
        )
    );
    if (normalizedIds.length === 0) return [];

    const usersById = new Map<string, any>();
    const idChunks = chunkArray(normalizedIds, BETTER_AUTH_USER_CHUNK_SIZE);

    for (const idChunk of idChunks) {
        const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: "user",
            where: [{ field: "_id", operator: "in", value: idChunk }],
            paginationOpts: {
                cursor: null,
                numItems: idChunk.length,
            },
        });

        const pageRows = Array.isArray(result?.page) ? result.page : [];
        for (const authUser of pageRows) {
            const authUserId = normalizeAuthUserId(authUser);
            if (!authUserId) continue;
            usersById.set(authUserId, authUser);
        }
    }

    return normalizedIds
        .map((userId) => usersById.get(userId))
        .filter((authUser): authUser is NonNullable<typeof authUser> => Boolean(authUser));
};

const buildAccessDeniedPayload = (
    reason: "unauthenticated" | "forbidden" | "not_configured",
    identity: any
) => ({
    allowed: false as const,
    reason,
    signedInAs: {
        userId: resolveAuthUserId(identity) || null,
        email: resolveIdentityEmail(identity) || null,
    },
});

const buildAdminEmailSourceMap = async (ctx: any) => {
    const map = new Map<string, Set<"bootstrap" | "env" | "db">>();

    const addEmail = (rawEmail: unknown, source: "bootstrap" | "env" | "db") => {
        const normalizedEmail = normalizeEmail(rawEmail);
        if (!normalizedEmail) return;
        const existing = map.get(normalizedEmail) || new Set();
        existing.add(source);
        map.set(normalizedEmail, existing);
    };

    for (const email of BOOTSTRAP_ADMIN_EMAILS) {
        addEmail(email, "bootstrap");
    }
    for (const email of parseConfiguredAdminEmails()) {
        addEmail(email, "env");
    }

    const dynamicAdminRows = await ctx.db.query("adminAccess").collect();
    for (const row of dynamicAdminRows) {
        addEmail(row.email, "db");
    }

    return map;
};

const listAdminEmailsFromMap = (sourceMap: Map<string, Set<"bootstrap" | "env" | "db">>) =>
    [...sourceMap.entries()]
        .map(([email, sources]) => ({
            email,
            sources: [...sources].sort(),
        }))
        .sort((left, right) => left.email.localeCompare(right.email));

const resolveAdminAccess = async (ctx: any, identity: any) => {
    const authUserIdCandidates = collectAuthUserIdCandidates(identity);
    const subjectAuthUserId = normalizeUserIdCandidate(identity?.subject);
    let resolvedAuthUsers: any[] = [];
    if (subjectAuthUserId) {
        try {
            resolvedAuthUsers = await fetchAuthUsersByIds(ctx, [subjectAuthUserId]);
        } catch {
            resolvedAuthUsers = [];
        }
    }
    const resolvedAuthUser = resolvedAuthUsers[0] || null;
    const authUserId = normalizeAuthUserId(resolvedAuthUser) || subjectAuthUserId || authUserIdCandidates[0] || "";
    const authEmail = resolveIdentityEmail(identity) || normalizeEmail(resolvedAuthUser?.email);
    const adminUserIdAllowlist = parseConfiguredAdminUserIds();
    const adminEmailSourceMap = await buildAdminEmailSourceMap(ctx);
    const adminEmails = listAdminEmailsFromMap(adminEmailSourceMap);
    const allowlistConfigured = adminUserIdAllowlist.size > 0 || adminEmailSourceMap.size > 0;
    const allowedByUserId = authUserIdCandidates.some((candidate) => adminUserIdAllowlist.has(candidate))
        || (authUserId ? adminUserIdAllowlist.has(authUserId) : false);
    const isAllowed = Boolean(
        authUserId
        && allowlistConfigured
        && (
            allowedByUserId
            || (authEmail && adminEmailSourceMap.has(authEmail))
        )
    );

    return {
        authUserId,
        authEmail,
        authUserIdCandidates,
        adminUserIdAllowlist,
        adminEmailSourceMap,
        adminEmails,
        allowlistConfigured,
        isAllowed,
    };
};

const requireAdminAccess = async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    const access = await resolveAdminAccess(ctx, identity);

    if (!access.authUserId) {
        return { denied: true as const, payload: buildAccessDeniedPayload("unauthenticated", identity) };
    }
    if (!access.allowlistConfigured) {
        return { denied: true as const, payload: buildAccessDeniedPayload("not_configured", identity) };
    }
    if (!access.isAllowed) {
        return { denied: true as const, payload: buildAccessDeniedPayload("forbidden", identity) };
    }

    return {
        denied: false as const,
        identity,
        access,
    };
};

export const getAdminAccessStatusInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const access = await resolveAdminAccess(ctx, identity);
        return {
            authUserId: access.authUserId,
            allowlistConfigured: access.allowlistConfigured,
            isAllowed: access.isAllowed,
        };
    },
});

export const getAccountStateByEmailInternal = internalQuery({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const email = normalizeEmail(args.email);
        if (!email || !isValidEmail(email)) {
            throw new Error("Provide a valid email address.");
        }

        const authUsersResult = await fetchBetterAuthRows(ctx, {
            model: "user",
            where: [{ field: "email", value: email }],
            sortBy: { field: "createdAt", direction: "asc" },
        });
        const authUsers = authUsersResult.rows;
        const authUserIds = Array.from(
            new Set(
                authUsers
                    .map((user) => normalizeAuthUserId(user))
                    .filter(Boolean)
            )
        );

        const [
            profiles,
            subscriptions,
            paymentTransactions,
            courses,
            uploads,
            assignmentThreads,
            examAttempts,
            conceptAttempts,
        ] = await Promise.all([
            ctx.db.query("profiles").collect(),
            ctx.db.query("subscriptions").collect(),
            ctx.db.query("paymentTransactions").collect(),
            ctx.db.query("courses").collect(),
            ctx.db.query("uploads").collect(),
            ctx.db.query("assignmentThreads").collect(),
            ctx.db.query("examAttempts").collect(),
            ctx.db.query("conceptAttempts").collect(),
        ]);

        const paymentUserIdsByEmail = paymentTransactions
            .filter((row: any) => normalizeEmail(row.customerEmail) === email)
            .map((row: any) => String(row.userId || "").trim())
            .filter(Boolean);

        const matchingUserIds = Array.from(
            new Set([
                ...authUserIds,
                ...paymentUserIdsByEmail,
            ])
        );

        const userStates = matchingUserIds.map((userId) => {
            const authUser = authUsers.find((row: any) => normalizeAuthUserId(row) === userId) || null;
            const profile = profiles.find((row: any) => String(row.userId || "").trim() === userId) || null;
            const userSubscriptions = subscriptions.filter((row: any) => String(row.userId || "").trim() === userId);
            const latestSubscription = userSubscriptions
                .slice()
                .sort((left: any, right: any) => {
                    const leftTs = toTimestamp(left.lastPaymentAt, toTimestamp(left._creationTime, 0));
                    const rightTs = toTimestamp(right.lastPaymentAt, toTimestamp(right._creationTime, 0));
                    return rightTs - leftTs;
                })[0] || null;
            const userPayments = paymentTransactions.filter((row: any) => String(row.userId || "").trim() === userId);
            const successfulPayments = userPayments.filter(isSuccessfulPayment);
            const latestSuccessfulPayment = successfulPayments
                .slice()
                .sort((left: any, right: any) => resolvePaymentTimestamp(right) - resolvePaymentTimestamp(left))[0]
                || null;
            const userCourses = courses
                .filter((row: any) => String(row.userId || "").trim() === userId)
                .sort((left: any, right: any) => toTimestamp(right._creationTime, 0) - toTimestamp(left._creationTime, 0));
            const userUploads = uploads
                .filter((row: any) => String(row.userId || "").trim() === userId)
                .sort((left: any, right: any) => toTimestamp(right._creationTime, 0) - toTimestamp(left._creationTime, 0));
            const userAssignmentThreads = assignmentThreads.filter((row: any) => String(row.userId || "").trim() === userId);
            const userExamAttempts = examAttempts.filter((row: any) => String(row.userId || "").trim() === userId);
            const userConceptAttempts = conceptAttempts.filter((row: any) => String(row.userId || "").trim() === userId);

            return {
                userId,
                authUser: authUser ? {
                    email: normalizeEmail(authUser.email) || null,
                    emailVerified: Boolean(authUser.emailVerified),
                    name: String(authUser.name || "").trim() || null,
                    createdAt: toTimestamp(authUser.createdAt, 0),
                } : null,
                profile: profile ? {
                    profileId: String(profile._id || ""),
                    fullName: String(profile.fullName || "").trim() || null,
                    department: String(profile.department || "").trim() || null,
                    onboardingCompleted: profile.onboardingCompleted === true,
                    createdAt: toTimestamp(profile._creationTime, 0),
                } : null,
                subscription: latestSubscription ? {
                    subscriptionId: String(latestSubscription._id || ""),
                    plan: normalizeSubscriptionPlan(latestSubscription.plan),
                    status: normalizeSubscriptionStatus(latestSubscription.status),
                    purchasedUploadCredits: toNonNegativeInteger(latestSubscription.purchasedUploadCredits),
                    consumedUploadCredits: toNonNegativeInteger(latestSubscription.consumedUploadCredits),
                    lastPaymentReference: String(latestSubscription.lastPaymentReference || "").trim() || null,
                    lastPaymentAt: toTimestamp(latestSubscription.lastPaymentAt, 0),
                    planExpiresAt: toTimestamp(latestSubscription.planExpiresAt, 0),
                } : null,
                metrics: {
                    courseCount: userCourses.length,
                    uploadCount: userUploads.length,
                    assignmentThreadCount: userAssignmentThreads.length,
                    examAttemptCount: userExamAttempts.length,
                    conceptAttemptCount: userConceptAttempts.length,
                    paymentTransactionCount: userPayments.length,
                    successfulPaymentCount: successfulPayments.length,
                },
                recentCourses: userCourses.slice(0, 10).map((course: any) => ({
                    courseId: String(course._id || ""),
                    title: String(course.title || "").trim() || "Untitled course",
                    createdAt: toTimestamp(course._creationTime, 0),
                })),
                recentUploads: userUploads.slice(0, 10).map((upload: any) => ({
                    uploadId: String(upload._id || ""),
                    fileName: String(upload.fileName || "").trim() || "Untitled upload",
                    status: String(upload.status || "").trim() || "unknown",
                    createdAt: toTimestamp(upload._creationTime, 0),
                })),
                latestSuccessfulPayment: latestSuccessfulPayment ? {
                    reference: String(latestSuccessfulPayment.reference || "").trim() || null,
                    amountMinor: toNonNegativeInteger(latestSuccessfulPayment.amountMinor),
                    currency: normalizeCurrencyCode(latestSuccessfulPayment.currency),
                    paidAt: resolvePaymentTimestamp(latestSuccessfulPayment),
                } : null,
            };
        });

        return {
            email,
            authUsersTruncated: authUsersResult.truncated,
            authUsers: authUsers.map((authUser: any) => ({
                userId: normalizeAuthUserId(authUser),
                email: normalizeEmail(authUser.email) || null,
                emailVerified: Boolean(authUser.emailVerified),
                name: String(authUser.name || "").trim() || null,
                createdAt: toTimestamp(authUser.createdAt, 0),
            })),
            userStates,
        };
    },
});

export const addAdminEmail = mutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const adminGuard = await requireAdminAccess(ctx);
        if (adminGuard.denied) {
            throw new Error("Admin access required.");
        }

        const email = normalizeEmail(args.email);
        if (!email || !isValidEmail(email)) {
            throw new Error("Provide a valid email address.");
        }

        const existing = await ctx.db
            .query("adminAccess")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();
        if (existing) {
            return { ok: true, alreadyExisted: true, email };
        }

        await ctx.db.insert("adminAccess", {
            email,
            addedByUserId: adminGuard.access.authUserId,
            createdAt: Date.now(),
        });

        return { ok: true, alreadyExisted: false, email };
    },
});

export const removeAdminEmail = mutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const adminGuard = await requireAdminAccess(ctx);
        if (adminGuard.denied) {
            throw new Error("Admin access required.");
        }

        const email = normalizeEmail(args.email);
        if (!email || !isValidEmail(email)) {
            throw new Error("Provide a valid email address.");
        }

        const bootstrapEmails = new Set(BOOTSTRAP_ADMIN_EMAILS.map((entry) => normalizeEmail(entry)));
        if (bootstrapEmails.has(email)) {
            throw new Error("This bootstrap admin email cannot be removed.");
        }

        const configuredAdminEmails = parseConfiguredAdminEmails();
        if (configuredAdminEmails.has(email)) {
            throw new Error("This admin email is managed via ADMIN_EMAILS env and cannot be removed here.");
        }

        const existing = await ctx.db
            .query("adminAccess")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();
        if (!existing) {
            return { ok: true, removed: false, email };
        }

        await ctx.db.delete(existing._id);
        return { ok: true, removed: true, email };
    },
});

export const setPaymentProvider = mutation({
    args: {
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const adminGuard = await requireAdminAccess(ctx);
        if (adminGuard.denied) {
            throw new Error("Admin access required.");
        }

        const normalizedProvider = String(args.provider || "").trim().toLowerCase();
        const provider = resolvePaymentProvider(normalizedProvider);
        if (provider !== normalizedProvider || !PAYMENT_PROVIDER_OPTIONS.some((option) => option.id === provider)) {
            throw new Error("Unsupported payment provider.");
        }

        const existing = await ctx.db
            .query("appSettings")
            .withIndex("by_key", (q) => q.eq("key", PAYMENT_PROVIDER_KEY))
            .first();
        const now = Date.now();
        const payload = {
            key: PAYMENT_PROVIDER_KEY,
            value: provider,
            updatedAt: now,
            updatedByUserId: adminGuard.access.authUserId,
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return {
                ok: true,
                key: PAYMENT_PROVIDER_KEY,
                provider,
                updatedAt: now,
                updatedByUserId: payload.updatedByUserId,
            };
        }

        await ctx.db.insert("appSettings", payload);
        return {
            ok: true,
            key: PAYMENT_PROVIDER_KEY,
            provider,
            updatedAt: now,
            updatedByUserId: payload.updatedByUserId,
        };
    },
});

export const reconcilePaymentReference = action({
    args: {
        reference: v.string(),
    },
    handler: async (ctx, args) => {
        const access = await ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {});
        if (!access?.authUserId) {
            throw new Error("Admin sign-in required.");
        }
        if (!access.allowlistConfigured || !access.isAllowed) {
            throw new Error("Admin access required.");
        }

        const reference = String(args.reference || "").trim();
        if (!reference) {
            throw new Error("Payment reference is required.");
        }

        return await ctx.runAction(internal.subscriptions.reconcilePaymentReferenceInternal, {
            reference,
            trigger: "admin_manual",
            sendAlert: false,
        });
    },
});

export const grantUploadCreditsByEmail = mutation({
    args: {
        email: v.string(),
        credits: v.number(),
        grantKey: v.string(),
        note: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const adminGuard = await requireAdminAccess(ctx);
        if (adminGuard.denied) {
            throw new Error("Admin access required.");
        }

        const email = normalizeEmail(args.email);
        if (!email || !isValidEmail(email)) {
            throw new Error("Provide a valid email address.");
        }

        const credits = toNonNegativeInteger(args.credits);
        if (credits <= 0) {
            throw new Error("Credits must be greater than zero.");
        }

        const grantKey = String(args.grantKey || "").trim().slice(0, 160);
        if (!grantKey) {
            throw new Error("Grant key is required.");
        }

        const sourceNote = typeof args.note === "string" && args.note.trim()
            ? args.note.trim().slice(0, 200)
            : "admin_manual_grant";

        const authUsersResult = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: "user",
            where: [{ field: "email", value: email }],
            paginationOpts: {
                cursor: null,
                numItems: 5,
            },
        });
        const authUsers = Array.isArray(authUsersResult?.page) ? authUsersResult.page : [];
        const authUser = authUsers.find((user: any) => normalizeEmail(user?.email) === email) || null;
        const userId = normalizeAuthUserId(authUser);
        if (!userId) {
            throw new Error("No account found for that email.");
        }

        const existingGrant = await ctx.db
            .query("campaignCreditGrants")
            .withIndex("by_userId_campaignId", (q) => q.eq("userId", userId).eq("campaignId", grantKey))
            .first();

        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();

        if (existingGrant) {
            return {
                ok: true,
                alreadyGranted: true,
                email,
                userId,
                grantedCredits: toNonNegativeInteger(existingGrant.grantedCredits),
                purchasedUploadCredits: toNonNegativeInteger(subscription?.purchasedUploadCredits),
                consumedUploadCredits: toNonNegativeInteger(subscription?.consumedUploadCredits),
            };
        }

        const purchasedUploadCredits = toNonNegativeInteger(subscription?.purchasedUploadCredits);
        const consumedUploadCredits = toNonNegativeInteger(subscription?.consumedUploadCredits);
        const nextPurchasedUploadCredits = purchasedUploadCredits + credits;

        if (subscription) {
            await ctx.db.patch(subscription._id, {
                purchasedUploadCredits: nextPurchasedUploadCredits,
                consumedUploadCredits,
                plan: normalizeSubscriptionPlan(subscription.plan),
                status: normalizeSubscriptionStatus(subscription.status),
                amount: typeof subscription.amount === "number" ? subscription.amount : 0,
                currency: normalizeCurrencyCode(subscription.currency, "GHS"),
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: "GHS",
                purchasedUploadCredits: credits,
                consumedUploadCredits: 0,
            });
        }

        await ctx.db.insert("campaignCreditGrants", {
            campaignId: grantKey,
            userId,
            email,
            creditType: "upload_credits",
            grantedCredits: credits,
            grantedAt: Date.now(),
            lastActivityAt: 0,
            daysInactive: 0,
            source: sourceNote,
        });

        return {
            ok: true,
            alreadyGranted: false,
            email,
            userId,
            grantedCredits: credits,
            purchasedUploadCredits: nextPurchasedUploadCredits,
            consumedUploadCredits,
        };
    },
});

export const diagnoseRetrievalForTopic = action({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const access = await ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {});
        if (!access?.authUserId) {
            throw new Error("Admin sign-in required.");
        }
        if (!access.allowlistConfigured || !access.isAllowed) {
            throw new Error("Admin access required.");
        }

        return await ctx.runAction(internal.grounded.diagnoseSemanticRetrievalForTopic, {
            topicId: args.topicId,
        });
    },
});

export const getDashboardSnapshot = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity().catch(() => null);
        const access = await resolveAdminAccess(ctx, identity);

        if (!access.authUserId) {
            return buildAccessDeniedPayload("unauthenticated", identity);
        }
        if (!access.allowlistConfigured) {
            return buildAccessDeniedPayload("not_configured", identity);
        }
        if (!access.isAllowed) {
            return buildAccessDeniedPayload("forbidden", identity);
        }

        const now = Date.now();
        const sevenDaysAgo = now - ACTIVE_USER_WINDOW_DAYS * DAY_MS;
        const fourteenDaysAgo = now - (ACTIVE_USER_WINDOW_DAYS + NEW_USER_WINDOW_DAYS) * DAY_MS;
        const fiveMinutesAgo = now - ACTIVE_USERS_5M_WINDOW_MS;
        const sevenDaysAgoDateKey = new Date(sevenDaysAgo).toISOString().slice(0, 10);

        const [profiles, uploads, assignmentThreads, examAttempts, conceptAttempts, feedbackEntries, productResearchResponses, activeSessionsResult, subscriptions, paymentTransactions, courses, humanizerUsage, aiMessageUsage, llmUsageDaily, userPresenceLast5Minutes, allUserPresence, questionTargetAuditRuns, campaignCreditGrants, campaignLandingEvents] =
            await Promise.all([
                ctx.db.query("profiles").collect(),
                ctx.db.query("uploads").collect(),
                ctx.db.query("assignmentThreads").collect(),
                ctx.db.query("examAttempts").collect(),
                ctx.db.query("conceptAttempts").collect(),
                ctx.db.query("feedback").collect(),
                ctx.db.query("productResearchResponses").collect(),
                fetchBetterAuthRows(ctx, {
                    model: "session",
                    where: [{ field: "expiresAt", operator: "gt", value: Date.now() }],
                    sortBy: { field: "updatedAt", direction: "desc" },
                }),
                ctx.db.query("subscriptions").collect(),
                ctx.db.query("paymentTransactions").collect(),
                ctx.db.query("courses").collect(),
                ctx.db.query("humanizerUsage").collect(),
                ctx.db.query("aiMessageUsage").collect(),
                ctx.db.query("llmUsageDaily").collect(),
                ctx.db
                    .query("userPresence")
                    .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", fiveMinutesAgo))
                    .collect(),
                ctx.db.query("userPresence").collect(),
                ctx.db
                    .query("questionTargetAuditRuns")
                    .withIndex("by_finishedAt")
                    .order("desc")
                    .take(10),
                ctx.db.query("campaignCreditGrants").collect(),
                ctx.db.query("campaignLandingEvents").collect(),
            ]);
        // Topics can contain very large generated content, so avoid full-table
        // scans here and derive admin content metrics from lightweight records.
        const topics: any[] = [];

        const activeSessions = activeSessionsResult.rows;

        const activeUsersLast5Minutes = new Set(
            userPresenceLast5Minutes
                .map((presence) => {
                    const userId = String(presence.userId || "").trim();
                    const lastSeenAt = toTimestamp(presence.lastSeenAt, 0);
                    if (!userId || lastSeenAt < fiveMinutesAgo) return null;
                    return userId;
                })
                .filter((userId): userId is string => Boolean(userId))
        );

        const activeUsersLastWindow = new Set<string>();
        const activeUsersPrevWindow = new Set<string>();
        const feedbackCountByUser = new Map<string, number>();
        const docsProcessedByUser = new Map<string, number>();
        const lastActivityByUser = new Map<string, number>();
        const latestPresenceByUser = new Map<string, number>();
        const latestUploadByUser = new Map<string, number>();
        const latestActivationByUser = new Map<string, number>();
        const latestPaymentByUser = new Map<string, number>();
        const uploadChannelStats = new Map<string, {
            total: number;
            ready: number;
            processing: number;
            error: number;
            other: number;
        }>();
        const uploadFileTypeCounts = new Map<string, number>();
        const uploadStatsByUser = new Map<string, {
            totalUploads: number;
            studyUploads: number;
            assignmentUploads: number;
            readyUploads: number;
            processingUploads: number;
            errorUploads: number;
            otherUploads: number;
        }>();

        const ensureUploadChannelStats = (channelKey: string) => {
            const existing = uploadChannelStats.get(channelKey);
            if (existing) return existing;
            const created = {
                total: 0,
                ready: 0,
                processing: 0,
                error: 0,
                other: 0,
            };
            uploadChannelStats.set(channelKey, created);
            return created;
        };

        const ensureUploadUserStats = (userId: string) => {
            const existing = uploadStatsByUser.get(userId);
            if (existing) return existing;
            const created = {
                totalUploads: 0,
                studyUploads: 0,
                assignmentUploads: 0,
                readyUploads: 0,
                processingUploads: 0,
                errorUploads: 0,
                otherUploads: 0,
            };
            uploadStatsByUser.set(userId, created);
            return created;
        };

        const applyStatusCounters = (
            counters: {
                total: number;
                ready: number;
                processing: number;
                error: number;
                other: number;
            },
            statusKey: string
        ) => {
            counters.total += 1;
            if (statusKey === "ready") {
                counters.ready += 1;
                return;
            }
            if (statusKey === "processing") {
                counters.processing += 1;
                return;
            }
            if (statusKey === "error") {
                counters.error += 1;
                return;
            }
            counters.other += 1;
        };

        const recordUploadBreakdown = (args: {
            userId: string;
            channel: "study_materials" | "assignment_helper";
            status: unknown;
            fileType: unknown;
            fileName?: unknown;
        }) => {
            const userId = String(args.userId || "").trim();
            if (!userId) return;

            const statusKey = normalizeUploadStatus(args.status);
            const fileTypeKey = normalizeUploadFileType(args.fileType, args.fileName);

            incrementMap(uploadFileTypeCounts, fileTypeKey);
            applyStatusCounters(ensureUploadChannelStats(args.channel), statusKey);

            const uploadUserStats = ensureUploadUserStats(userId);
            uploadUserStats.totalUploads += 1;
            if (args.channel === "study_materials") {
                uploadUserStats.studyUploads += 1;
            } else {
                uploadUserStats.assignmentUploads += 1;
            }
            if (statusKey === "ready") {
                uploadUserStats.readyUploads += 1;
            } else if (statusKey === "processing") {
                uploadUserStats.processingUploads += 1;
            } else if (statusKey === "error") {
                uploadUserStats.errorUploads += 1;
            } else {
                uploadUserStats.otherUploads += 1;
            }
        };

        for (const upload of uploads) {
            const userId = String(upload.userId || "").trim();
            const timestampMs = toTimestamp(upload._creationTime, 0);
            if (!userId) continue;
            recordUploadBreakdown({
                userId,
                channel: "study_materials",
                status: upload.status,
                fileType: upload.fileType,
                fileName: upload.fileName,
            });
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestUploadByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
            if (upload.status === "ready") {
                incrementMap(docsProcessedByUser, userId);
            }
        }

        for (const thread of assignmentThreads) {
            const userId = String(thread.userId || "").trim();
            const timestampMs = toTimestamp(thread._creationTime, 0);
            if (!userId) continue;
            recordUploadBreakdown({
                userId,
                channel: "assignment_helper",
                status: thread.status,
                fileType: thread.fileType,
                fileName: thread.fileName,
            });
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestUploadByUser, userId, timestampMs);
            updateMaxTimestamp(latestActivationByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
            if (thread.status === "ready") {
                incrementMap(docsProcessedByUser, userId);
            }
        }

        for (const course of courses) {
            const userId = String(course.userId || "").trim();
            const timestampMs = toTimestamp(course._creationTime, 0);
            if (!userId) continue;
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestActivationByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
        }

        for (const attempt of examAttempts) {
            const userId = String(attempt.userId || "").trim();
            const timestampMs = toTimestamp(attempt._creationTime, 0);
            if (!userId) continue;
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestActivationByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
        }

        for (const attempt of conceptAttempts) {
            const userId = String(attempt.userId || "").trim();
            const timestampMs = toTimestamp(attempt._creationTime, 0);
            if (!userId) continue;
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestActivationByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
        }

        for (const entry of feedbackEntries) {
            const userId = String(entry.userId || "").trim();
            const timestampMs = toTimestamp(entry.createdAt, entry._creationTime);
            if (!userId) continue;
            incrementMap(feedbackCountByUser, userId);
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
        }

        for (const presence of allUserPresence) {
            const userId = String(presence.userId || "").trim();
            const timestampMs = toTimestamp(presence.lastSeenAt, 0);
            if (!userId) continue;
            updateMaxTimestamp(lastActivityByUser, userId, timestampMs);
            updateMaxTimestamp(latestPresenceByUser, userId, timestampMs);
            markActiveWindow(
                userId,
                timestampMs,
                sevenDaysAgo,
                fourteenDaysAgo,
                activeUsersLastWindow,
                activeUsersPrevWindow
            );
        }

        const profileByUserId = new Map(
            profiles
                .map((profile) => [String(profile.userId || "").trim(), profile] as const)
                .filter(([userId]) => Boolean(userId))
        );

        // ── Exam Analytics ──
        const examAttemptsLastWindow = examAttempts.filter((a) => a._creationTime >= sevenDaysAgo).length;
        const objectiveAttempts = examAttempts.filter(
            (a) => String(a?.examFormat || "").trim().toLowerCase() !== "essay"
        ).length;
        const essayAttempts = examAttempts.filter((a) => a.examFormat === "essay").length;

        let examScoreSum = 0;
        let examScoreCount = 0;
        let examTimeSum = 0;
        let examTimeCount = 0;
        const examScoreBuckets = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
        const examCountByUser = new Map<string, { count: number; scoreSum: number; scoreCount: number }>();

        for (const attempt of examAttempts) {
            const total = Number(attempt.totalQuestions || 0);
            if (total > 0) {
                const pct = (Number(attempt.score || 0) / total) * 100;
                examScoreSum += pct;
                examScoreCount += 1;
                const bucketIdx = Math.min(Math.floor(pct / 20), 4);
                examScoreBuckets[bucketIdx] += 1;
            }
            if (Number(attempt.timeTakenSeconds) > 0) {
                examTimeSum += Number(attempt.timeTakenSeconds);
                examTimeCount += 1;
            }
            const uid = String(attempt.userId || "").trim();
            if (uid) {
                const cur = examCountByUser.get(uid) || { count: 0, scoreSum: 0, scoreCount: 0 };
                cur.count += 1;
                if (total > 0) {
                    cur.scoreSum += (Number(attempt.score || 0) / total) * 100;
                    cur.scoreCount += 1;
                }
                examCountByUser.set(uid, cur);
            }
        }

        const topExamUsersBase = [...examCountByUser.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([userId, stats]) => {
                const profile = profileByUserId.get(userId);
                return {
                    userId,
                    fullName: profile?.fullName || null,
                    attempts: stats.count,
                    avgScore: stats.scoreCount > 0 ? Math.round((stats.scoreSum / stats.scoreCount) * 10) / 10 : 0,
                };
            });

        const examAnalytics = {
            totalAttempts: examAttempts.length,
            attemptsLastWindow: examAttemptsLastWindow,
            objectiveAttempts,
            essayAttempts,
            averageScorePercent: examScoreCount > 0 ? Math.round((examScoreSum / examScoreCount) * 10) / 10 : 0,
            averageTimeTakenSeconds: examTimeCount > 0 ? Math.round(examTimeSum / examTimeCount) : 0,
            scoreDistribution: [
                { label: "0-20%", count: examScoreBuckets[0] },
                { label: "21-40%", count: examScoreBuckets[1] },
                { label: "41-60%", count: examScoreBuckets[2] },
                { label: "61-80%", count: examScoreBuckets[3] },
                { label: "81-100%", count: examScoreBuckets[4] },
            ],
            topExamUsers: topExamUsersBase,
        };

        // ── Concept Analytics ──
        const conceptAttemptsLastWindow = conceptAttempts.filter((a) => a._creationTime >= sevenDaysAgo).length;
        let conceptScoreSum = 0;
        let conceptScoreCount = 0;
        let conceptTimeSum = 0;
        let conceptTimeCount = 0;
        for (const attempt of conceptAttempts) {
            const total = Number(attempt.totalQuestions || 0);
            if (total > 0) {
                conceptScoreSum += (Number(attempt.score || 0) / total) * 100;
                conceptScoreCount += 1;
            }
            if (Number(attempt.timeTakenSeconds) > 0) {
                conceptTimeSum += Number(attempt.timeTakenSeconds);
                conceptTimeCount += 1;
            }
        }

        const conceptAnalytics = {
            totalAttempts: conceptAttempts.length,
            attemptsLastWindow: conceptAttemptsLastWindow,
            averageScorePercent: conceptScoreCount > 0 ? Math.round((conceptScoreSum / conceptScoreCount) * 10) / 10 : 0,
            averageTimeTakenSeconds: conceptTimeCount > 0 ? Math.round(conceptTimeSum / conceptTimeCount) : 0,
        };

        // ── Subscription Analytics ──
        const planCounts = new Map<string, number>();
        let totalPurchasedCredits = 0;
        let totalConsumedCredits = 0;
        let totalVoiceGenerations = 0;
        const latestSubscriptionByUser = new Map<string, any>();
        for (const sub of subscriptions) {
            const plan = normalizeSubscriptionPlan(sub.plan);
            planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
            totalPurchasedCredits += Number(sub.purchasedUploadCredits || 0);
            totalConsumedCredits += Number(sub.consumedUploadCredits || 0);
            totalVoiceGenerations += Number(sub.consumedVoiceGenerations || 0);

            const userId = String(sub.userId || "").trim();
            if (!userId) continue;
            const snapshotTimestamp = toTimestamp(sub.lastPaymentAt, toTimestamp(sub._creationTime, 0));
            const existing = latestSubscriptionByUser.get(userId);
            const existingTimestamp = existing
                ? toTimestamp(existing.lastPaymentAt, toTimestamp(existing._creationTime, 0))
                : -1;
            if (!existing || snapshotTimestamp >= existingTimestamp) {
                latestSubscriptionByUser.set(userId, sub);
            }
        }
        const totalSubs = subscriptions.length || 1;
        const planBreakdown = [...planCounts.entries()]
            .map(([plan, count]) => ({
                plan,
                count,
                percent: Math.round((count / totalSubs) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count);
        const latestSubscriptions = Array.from(latestSubscriptionByUser.values());
        const premiumUsersTotal = latestSubscriptions.filter(
            (subscription) => normalizeSubscriptionPlan(subscription.plan) === "premium"
        ).length;
        const premiumUsersActive = latestSubscriptions.filter(
            (subscription) =>
                normalizeSubscriptionPlan(subscription.plan) === "premium"
                && normalizeSubscriptionStatus(subscription.status) === "active"
        ).length;

        const subscriptionAnalytics = {
            planBreakdown,
            totalPurchasedCredits,
            totalConsumedCredits,
            totalVoiceGenerations,
            premiumUsersTotal,
            premiumUsersActive,
        };

        // ── Revenue Analytics ──
        const successfulPayments = paymentTransactions.filter(isSuccessfulPayment);
        const failedPayments = paymentTransactions.filter(isFailedPayment);
        const finalizedPaymentAttempts = successfulPayments.length + failedPayments.length;

        for (const payment of successfulPayments) {
            const userId = String(payment.userId || "").trim();
            const timestampMs = resolvePaymentTimestamp(payment);
            if (!userId) continue;
            updateMaxTimestamp(latestPaymentByUser, userId, timestampMs);
        }

        // If transaction rows are missing but subscriptions track recent paid states,
        // derive a conservative revenue snapshot from the subscription records.
        const subscriptionRevenueSnapshots = subscriptions
            .map((subscription) => {
                const amountMajor = toNonNegativeNumber(subscription.amount);
                const paidAt = toTimestamp(subscription.lastPaymentAt, 0);
                if (amountMajor <= 0 || paidAt <= 0) return null;
                return {
                    amountMinor: Math.round(amountMajor * 100),
                    paidAt,
                    currency: normalizeCurrencyCode(subscription.currency, "GHS"),
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        for (const subscription of subscriptions) {
            const userId = String(subscription.userId || "").trim();
            const amountMajor = toNonNegativeNumber(subscription.amount);
            const paidAt = toTimestamp(subscription.lastPaymentAt, 0);
            if (!userId || amountMajor <= 0 || paidAt <= 0) continue;
            updateMaxTimestamp(latestPaymentByUser, userId, paidAt);
        }
        const useSubscriptionRevenueFallback =
            successfulPayments.length === 0 && subscriptionRevenueSnapshots.length > 0;

        const paymentsLastWindow = successfulPayments.filter(
            (payment) => resolvePaymentTimestamp(payment) >= sevenDaysAgo
        );
        const subscriptionPaymentsLastWindow = subscriptionRevenueSnapshots.filter(
            (payment) => payment.paidAt >= sevenDaysAgo
        );

        const totalRevenueMinor = useSubscriptionRevenueFallback
            ? subscriptionRevenueSnapshots.reduce((sum, payment) => sum + payment.amountMinor, 0)
            : successfulPayments.reduce(
                (sum, payment) => sum + toNonNegativeNumber(payment.amountMinor),
                0
            );
        const revenueLastWindowMinor = useSubscriptionRevenueFallback
            ? subscriptionPaymentsLastWindow.reduce((sum, payment) => sum + payment.amountMinor, 0)
            : paymentsLastWindow.reduce(
                (sum, payment) => sum + toNonNegativeNumber(payment.amountMinor),
                0
            );
        const totalSuccessfulPayments = useSubscriptionRevenueFallback
            ? subscriptionRevenueSnapshots.length
            : successfulPayments.length;
        const paymentsLastWindowCount = useSubscriptionRevenueFallback
            ? subscriptionPaymentsLastWindow.length
            : paymentsLastWindow.length;
        const conversionBase = useSubscriptionRevenueFallback
            ? subscriptionRevenueSnapshots.length + failedPayments.length
            : finalizedPaymentAttempts;
        const conversionRate = conversionBase > 0
            ? Math.round((totalSuccessfulPayments / conversionBase) * 1000) / 10
            : 0;
        const currency = useSubscriptionRevenueFallback
            ? normalizeCurrencyCode(subscriptionRevenueSnapshots[0]?.currency, "GHS")
            : normalizeCurrencyCode(successfulPayments[0]?.currency, "GHS");

        const revenueAnalytics = {
            totalSuccessfulPayments,
            totalRevenueMinor,
            currency,
            paymentsLastWindow: paymentsLastWindowCount,
            revenueLastWindowMinor,
            failedPayments: failedPayments.length,
            conversionRate,
            source: useSubscriptionRevenueFallback
                ? "subscriptions"
                : "paymentTransactions",
        };

        const recoveredPayments = successfulPayments.filter(
            (payment) => String(payment.source || "").trim() === "reconcile_verify"
        );
        const unresolvedPayments = paymentTransactions
            .filter((payment) => isUnresolvedPayment(payment, now))
            .sort((left, right) => {
                const leftCreatedAt = toTimestamp(left.createdAt, toTimestamp(left._creationTime, 0));
                const rightCreatedAt = toTimestamp(right.createdAt, toTimestamp(right._creationTime, 0));
                return leftCreatedAt - rightCreatedAt;
            });
        const billingRecovery = {
            unresolvedCount: unresolvedPayments.length,
            unresolvedInitializedCount: unresolvedPayments.filter(
                (payment) => normalizePaymentStatus(payment.status) === "initialized"
            ).length,
            verifyErrorCount: unresolvedPayments.filter(
                (payment) => normalizePaymentVerificationStatus(payment.verificationStatus) === "verify_error"
            ).length,
            alertedCount: unresolvedPayments.filter(
                (payment) => toTimestamp(payment.alertedAt, 0) > 0
            ).length,
            recoveredPaymentsTotal: recoveredPayments.length,
            recoveredPaymentsLastWindow: recoveredPayments.filter(
                (payment) => resolvePaymentTimestamp(payment) >= sevenDaysAgo
            ).length,
            unresolvedPayments: unresolvedPayments.slice(0, UNRESOLVED_PAYMENT_ROWS_LIMIT).map((payment) => {
                const createdAt = toTimestamp(payment.createdAt, toTimestamp(payment._creationTime, 0));
                return {
                    reference: String(payment.reference || "").trim(),
                    userId: String(payment.userId || "").trim() || null,
                    customerEmail: normalizeEmail(payment.customerEmail) || null,
                    amountMinor: toNonNegativeInteger(payment.amountMinor),
                    currency: normalizeCurrencyCode(payment.currency, "GHS"),
                    status: normalizePaymentStatus(payment.status) || "initialized",
                    verificationStatus: normalizePaymentVerificationStatus(payment.verificationStatus) || "initialized",
                    verificationMessage: String(payment.verificationMessage || "").trim() || null,
                    provider: resolvePaymentProvider(payment.provider),
                    createdAt,
                    lastVerifiedAt: resolvePaymentLastVerifiedAt(payment) || null,
                    verificationAttempts: resolvePaymentVerificationAttempts(payment),
                    alertedAt: toTimestamp(payment.alertedAt, 0) || null,
                    ageHours: Math.round(((now - createdAt) / (60 * 60 * 1000)) * 10) / 10,
                };
            }),
        };

        // ── Content Analytics ──
        const completedCoursesFromCourses = courses.filter(
            (course) => course.status === "completed" || course.status === "ready"
        ).length;
        const inProgressCoursesFromCourses = courses.filter(
            (course) => course.status === "in_progress" || course.status === "processing"
        ).length;

        const inferredCompletedCourses = uploads.filter(
            (upload) => normalizeUploadStatus(upload.status) === "ready"
        ).length;
        const inferredInProgressCourses = uploads.filter(
            (upload) => normalizeUploadStatus(upload.status) === "processing"
        ).length;

        const inferredTopicStats = uploads.reduce(
            (acc, upload) => {
                const plannedTopics = toNonNegativeInteger(upload.plannedTopicCount);
                const generatedTopics = toNonNegativeInteger(upload.generatedTopicCount);
                const totalTopics = Math.max(plannedTopics, generatedTopics);
                acc.totalTopics += totalTopics;
                if (normalizeUploadStatus(upload.status) === "ready") {
                    acc.examReadyTopics += totalTopics;
                } else {
                    acc.examReadyTopics += generatedTopics;
                }
                return acc;
            },
            { totalTopics: 0, examReadyTopics: 0 }
        );

        const hasCourseRows = courses.length > 0;
        const hasTopicRows = topics.length > 0;
        const completedCourses = hasCourseRows ? completedCoursesFromCourses : inferredCompletedCourses;
        const inProgressCourses = hasCourseRows ? inProgressCoursesFromCourses : inferredInProgressCourses;
        const totalCourses = hasCourseRows ? courses.length : uploads.length;
        const totalTopics = hasTopicRows ? topics.length : inferredTopicStats.totalTopics;
        const examReadyTopics = hasTopicRows
            ? topics.filter((topic) => Boolean(topic.examReady)).length
            : inferredTopicStats.examReadyTopics;
        const totalObjective = hasTopicRows
            ? topics.reduce((sum, topic) => sum + toNonNegativeNumber(topic.usableObjectiveCount), 0)
            : 0;
        const totalEssay = hasTopicRows
            ? topics.reduce((sum, topic) => sum + toNonNegativeNumber(topic.usableEssayCount), 0)
            : 0;
        const topicCount = totalTopics || 1;

        const contentAnalytics = {
            totalCourses,
            completedCourses,
            inProgressCourses,
            totalTopics,
            examReadyTopics,
            averageObjectivePerTopic: hasTopicRows ? Math.round((totalObjective / topicCount) * 10) / 10 : 0,
            averageEssayPerTopic: hasTopicRows ? Math.round((totalEssay / topicCount) * 10) / 10 : 0,
            source: {
                courses: hasCourseRows ? "courses" : "uploads",
                topics: hasTopicRows ? "topics" : "uploads",
            },
        };

        // ── Engagement Analytics ──
        const onboardingCompletedCount = profiles.filter((p) => p.onboardingCompleted).length;
        const onboardingCompletionRate = profiles.length > 0
            ? Math.round((onboardingCompletedCount / profiles.length) * 1000) / 10
            : 0;
        const voiceModeEnabledCount = profiles.filter((p) => p.voiceModeEnabled).length;
        let totalStreakDays = 0;
        let streakCount = 0;
        let totalStudyHoursSum = 0;
        let studyHoursCount = 0;
        for (const p of profiles) {
            if (Number(p.streakDays) > 0) {
                totalStreakDays += Number(p.streakDays);
                streakCount += 1;
            }
            if (Number(p.totalStudyHours) > 0) {
                totalStudyHoursSum += Number(p.totalStudyHours);
                studyHoursCount += 1;
            }
        }
        const totalHumanizerUsage = humanizerUsage.reduce((sum, h) => sum + Number(h.count || 0), 0);
        const humanizerUsageLastWindow = humanizerUsage
            .filter((h) => h._creationTime >= sevenDaysAgo)
            .reduce((sum, h) => sum + Number(h.count || 0), 0);

        const engagementAnalytics = {
            onboardingCompletedCount,
            onboardingCompletionRate,
            voiceModeEnabledCount,
            averageStreakDays: streakCount > 0 ? Math.round((totalStreakDays / streakCount) * 10) / 10 : 0,
            averageTotalStudyHours: studyHoursCount > 0 ? Math.round((totalStudyHoursSum / studyHoursCount) * 10) / 10 : 0,
            totalHumanizerUsage,
            humanizerUsageLastWindow,
        };

        const newUsersLastWindow = profiles.filter((profile) => profile._creationTime >= sevenDaysAgo).length;
        const newUsersPrevWindow = profiles.filter(
            (profile) => profile._creationTime >= fourteenDaysAgo && profile._creationTime < sevenDaysAgo
        ).length;

        const uploadReadyTotal = uploads.filter((upload) => upload.status === "ready").length;
        const uploadReadyLastWindow = uploads.filter(
            (upload) => upload.status === "ready" && upload._creationTime >= sevenDaysAgo
        ).length;
        const assignmentReadyTotal = assignmentThreads.filter((thread) => thread.status === "ready").length;
        const assignmentReadyLastWindow = assignmentThreads.filter(
            (thread) => thread.status === "ready" && thread._creationTime >= sevenDaysAgo
        ).length;

        const feedbackTotal = feedbackEntries.length;
        const feedbackLastWindow = feedbackEntries.filter((entry) => {
            const timestampMs = toTimestamp(entry.createdAt, entry._creationTime);
            return timestampMs >= sevenDaysAgo;
        }).length;
        const feedbackWithMessageTotal = feedbackEntries.filter(
            (entry) => Boolean(normalizeFeedbackMessage(entry.message))
        ).length;
        const feedbackWithMessageLastWindow = feedbackEntries.filter((entry) => {
            const timestampMs = toTimestamp(entry.createdAt, entry._creationTime);
            return timestampMs >= sevenDaysAgo && Boolean(normalizeFeedbackMessage(entry.message));
        }).length;

        const ratedFeedback = feedbackEntries.filter(
            (entry) => Number.isFinite(Number(entry.rating)) && Number(entry.rating) > 0
        );
        const averageFeedbackRating = ratedFeedback.length > 0
            ? Math.round(
                (ratedFeedback.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / ratedFeedback.length) * 10
            ) / 10
            : 0;

        const productResearchResponsesTotal = productResearchResponses.length;
        const productResearchResponsesLastWindow = productResearchResponses.filter((entry) => {
            const timestampMs = toTimestamp(entry.createdAt, entry._creationTime);
            return timestampMs >= sevenDaysAgo;
        }).length;
        const productResearchResponsesWithNotesTotal = productResearchResponses.filter(
            (entry) => Boolean(normalizeFeedbackMessage(entry.additionalNotes))
        ).length;
        const productResearchResponsesWithNotesLastWindow = productResearchResponses.filter((entry) => {
            const timestampMs = toTimestamp(entry.createdAt, entry._creationTime);
            return timestampMs >= sevenDaysAgo && Boolean(normalizeFeedbackMessage(entry.additionalNotes));
        }).length;
        const productResearchRespondersTotal = new Set(
            productResearchResponses
                .map((entry) => String(entry.userId || "").trim())
                .filter(Boolean)
        ).size;
        const productResearchCampaignCounts = new Map<string, number>();
        for (const entry of productResearchResponses) {
            const campaign = String(entry.campaign || "").trim() || "unknown";
            incrementMap(productResearchCampaignCounts, campaign);
        }

        const llmUsageByUser = new Map<string, {
            requestCount: number;
            requestCountLastWindow: number;
            promptTokens: number;
            promptTokensLastWindow: number;
            completionTokens: number;
            completionTokensLastWindow: number;
            totalTokens: number;
            totalTokensLastWindow: number;
            updatedAt: number;
        }>();
        let llmRequestsTotal = 0;
        let llmRequestsLastWindow = 0;
        let llmPromptTokensTotal = 0;
        let llmPromptTokensLastWindow = 0;
        let llmCompletionTokensTotal = 0;
        let llmCompletionTokensLastWindow = 0;
        let llmTokensTotal = 0;
        let llmTokensLastWindow = 0;
        let llmUsageFirstTrackedAt = 0;
        let llmUsageLastTrackedAt = 0;

        for (const entry of llmUsageDaily) {
            const userId = String(entry.userId || "").trim();
            if (!userId) continue;
            const updatedAt = toTimestamp(entry.updatedAt, entry._creationTime);
            const requestCount = toNonNegativeInteger(entry.requestCount);
            const promptTokens = toNonNegativeInteger(entry.promptTokens);
            const completionTokens = toNonNegativeInteger(entry.completionTokens);
            const totalTokens = toNonNegativeInteger(entry.totalTokens);
            const inLastWindow = updatedAt >= sevenDaysAgo;

            const current = llmUsageByUser.get(userId) || {
                requestCount: 0,
                requestCountLastWindow: 0,
                promptTokens: 0,
                promptTokensLastWindow: 0,
                completionTokens: 0,
                completionTokensLastWindow: 0,
                totalTokens: 0,
                totalTokensLastWindow: 0,
                updatedAt: 0,
            };
            current.requestCount += requestCount;
            current.promptTokens += promptTokens;
            current.completionTokens += completionTokens;
            current.totalTokens += totalTokens;
            if (inLastWindow) {
                current.requestCountLastWindow += requestCount;
                current.promptTokensLastWindow += promptTokens;
                current.completionTokensLastWindow += completionTokens;
                current.totalTokensLastWindow += totalTokens;
            }
            current.updatedAt = Math.max(current.updatedAt, updatedAt);
            llmUsageByUser.set(userId, current);

            llmRequestsTotal += requestCount;
            llmPromptTokensTotal += promptTokens;
            llmCompletionTokensTotal += completionTokens;
            llmTokensTotal += totalTokens;
            if (inLastWindow) {
                llmRequestsLastWindow += requestCount;
                llmPromptTokensLastWindow += promptTokens;
                llmCompletionTokensLastWindow += completionTokens;
                llmTokensLastWindow += totalTokens;
            }
            if (updatedAt > 0 && (llmUsageFirstTrackedAt === 0 || updatedAt < llmUsageFirstTrackedAt)) {
                llmUsageFirstTrackedAt = updatedAt;
            }
            if (updatedAt > llmUsageLastTrackedAt) {
                llmUsageLastTrackedAt = updatedAt;
            }
        }
        const historicalAiMessageTokensPerRequest = clampNumber(
            Math.round(
                (llmRequestsTotal > 0 && llmTokensTotal > 0
                    ? (llmTokensTotal / llmRequestsTotal) * 0.85
                    : DEFAULT_ESTIMATED_AI_MESSAGE_TOKENS)
            ),
            MIN_ESTIMATED_AI_MESSAGE_TOKENS,
            MAX_ESTIMATED_AI_MESSAGE_TOKENS
        );
        const historicalHumanizerTokensPerRequest = clampNumber(
            Math.round(
                (llmRequestsTotal > 0 && llmTokensTotal > 0
                    ? (llmTokensTotal / llmRequestsTotal) * 2.2
                    : DEFAULT_ESTIMATED_HUMANIZER_TOKENS)
            ),
            MIN_ESTIMATED_HUMANIZER_TOKENS,
            MAX_ESTIMATED_HUMANIZER_TOKENS
        );
        const getUserLlmUsage = (userId: string) =>
            llmUsageByUser.get(String(userId || "").trim()) || {
                requestCount: 0,
                requestCountLastWindow: 0,
                promptTokens: 0,
                promptTokensLastWindow: 0,
                completionTokens: 0,
                completionTokensLastWindow: 0,
                totalTokens: 0,
                totalTokensLastWindow: 0,
                updatedAt: 0,
            };
        const historicalLlmEstimateByUser = new Map<string, {
            aiMessageCountTotal: number;
            aiMessageCountLastWindow: number;
            humanizerCountTotal: number;
            humanizerCountLastWindow: number;
            estimatedTokensTotal: number;
            estimatedTokensLastWindow: number;
        }>();
        let historicalEstimatedRequestCountTotal = 0;
        let historicalEstimatedRequestCountLastWindow = 0;
        let historicalEstimatedTokensTotal = 0;
        let historicalEstimatedTokensLastWindow = 0;
        let historicalAiMessageCountTotal = 0;
        let historicalAiMessageCountLastWindow = 0;
        let historicalHumanizerCountTotal = 0;
        let historicalHumanizerCountLastWindow = 0;
        const accumulateHistoricalEstimate = (
            userId: string,
            field: "aiMessageCountTotal" | "aiMessageCountLastWindow" | "humanizerCountTotal" | "humanizerCountLastWindow",
            count: number,
            estimatedTokens: number
        ) => {
            const normalizedUserId = String(userId || "").trim();
            if (!normalizedUserId || count <= 0) return;
            const current = historicalLlmEstimateByUser.get(normalizedUserId) || {
                aiMessageCountTotal: 0,
                aiMessageCountLastWindow: 0,
                humanizerCountTotal: 0,
                humanizerCountLastWindow: 0,
                estimatedTokensTotal: 0,
                estimatedTokensLastWindow: 0,
            };
            current[field] += count;
            current.estimatedTokensTotal += estimatedTokens;
            if (field === "aiMessageCountLastWindow" || field === "humanizerCountLastWindow") {
                current.estimatedTokensLastWindow += estimatedTokens;
            }
            historicalLlmEstimateByUser.set(normalizedUserId, current);
        };
        for (const row of aiMessageUsage) {
            const userId = String(row.userId || "").trim();
            const count = toNonNegativeInteger(row.count);
            if (!userId || count <= 0) continue;
            const inLastWindow = String(row.date || "") >= sevenDaysAgoDateKey;
            const estimatedTokens = count * historicalAiMessageTokensPerRequest;
            historicalEstimatedRequestCountTotal += count;
            historicalEstimatedTokensTotal += estimatedTokens;
            historicalAiMessageCountTotal += count;
            accumulateHistoricalEstimate(userId, "aiMessageCountTotal", count, estimatedTokens);
            if (inLastWindow) {
                historicalEstimatedRequestCountLastWindow += count;
                historicalEstimatedTokensLastWindow += estimatedTokens;
                historicalAiMessageCountLastWindow += count;
                accumulateHistoricalEstimate(userId, "aiMessageCountLastWindow", count, estimatedTokens);
            }
        }
        for (const row of humanizerUsage) {
            const userId = String(row.userId || "").trim();
            const count = toNonNegativeInteger(row.count);
            if (!userId || count <= 0) continue;
            const inLastWindow = String(row.date || "") >= sevenDaysAgoDateKey;
            const estimatedTokens = count * historicalHumanizerTokensPerRequest;
            historicalEstimatedRequestCountTotal += count;
            historicalEstimatedTokensTotal += estimatedTokens;
            historicalHumanizerCountTotal += count;
            accumulateHistoricalEstimate(userId, "humanizerCountTotal", count, estimatedTokens);
            if (inLastWindow) {
                historicalEstimatedRequestCountLastWindow += count;
                historicalEstimatedTokensLastWindow += estimatedTokens;
                historicalHumanizerCountLastWindow += count;
                accumulateHistoricalEstimate(userId, "humanizerCountLastWindow", count, estimatedTokens);
            }
        }
        const getUserHistoricalLlmEstimate = (userId: string) =>
            historicalLlmEstimateByUser.get(String(userId || "").trim()) || {
                aiMessageCountTotal: 0,
                aiMessageCountLastWindow: 0,
                humanizerCountTotal: 0,
                humanizerCountLastWindow: 0,
                estimatedTokensTotal: 0,
                estimatedTokensLastWindow: 0,
            };

        const recentUsersBase = [...profiles]
            .sort((left, right) => right._creationTime - left._creationTime)
            .slice(0, RECENT_USERS_LIMIT)
            .map((profile) => {
                const userId = String(profile.userId || "").trim();
                const llmUsage = getUserLlmUsage(userId);
                const historicalEstimate = getUserHistoricalLlmEstimate(userId);
                return {
                    userId,
                    fullName: profile.fullName || null,
                    educationLevel: profile.educationLevel || null,
                    department: profile.department || null,
                    createdAt: profile._creationTime,
                    lastActiveAt: lastActivityByUser.get(userId) || null,
                    documentsProcessed: docsProcessedByUser.get(userId) || 0,
                    feedbackCount: feedbackCountByUser.get(userId) || 0,
                    llmTokensTotal: llmUsage.totalTokens,
                    llmTokensLastWindow: llmUsage.totalTokensLastWindow,
                    llmRequestsTotal: llmUsage.requestCount,
                    llmRequestsLastWindow: llmUsage.requestCountLastWindow,
                    estimatedHistoricalTokensTotal: historicalEstimate.estimatedTokensTotal,
                    estimatedHistoricalTokensLastWindow: historicalEstimate.estimatedTokensLastWindow,
                };
            });
        const recentUserIds = Array.from(
            new Set(
                recentUsersBase
                    .map((entry) => String(entry.userId || "").trim())
                    .filter(Boolean)
            )
        );
        const recentUserAuthUsers = await fetchAuthUsersByIds(ctx, recentUserIds);
        const recentUserAuthUsersById = new Map(
            recentUserAuthUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );
        const recentUsers = recentUsersBase.map((entry) => ({
            ...entry,
            email: normalizeEmail(recentUserAuthUsersById.get(entry.userId)?.email) || null,
        }));

        const premiumUsersBase = latestSubscriptions
            .map((subscription) => {
                const userId = String(subscription.userId || "").trim();
                if (!userId || normalizeSubscriptionPlan(subscription.plan) !== "premium") {
                    return null;
                }
                const profile = profileByUserId.get(userId);
                const llmUsage = getUserLlmUsage(userId);
                const historicalEstimate = getUserHistoricalLlmEstimate(userId);
                const lastPaymentAt = toTimestamp(subscription.lastPaymentAt, 0);
                const status = normalizeSubscriptionStatus(subscription.status);
                return {
                    userId,
                    fullName: profile?.fullName || null,
                    department: profile?.department || null,
                    status,
                    isActive: status === "active",
                    amountMajor: toNonNegativeNumber(subscription.amount),
                    currency: normalizeCurrencyCode(subscription.currency, "GHS"),
                    lastPaymentAt: lastPaymentAt > 0 ? lastPaymentAt : null,
                    nextBillingDate: String(subscription.nextBillingDate || "").trim() || null,
                    llmTokensTotal: llmUsage.totalTokens,
                    llmTokensLastWindow: llmUsage.totalTokensLastWindow,
                    llmRequestsTotal: llmUsage.requestCount,
                    llmRequestsLastWindow: llmUsage.requestCountLastWindow,
                    estimatedHistoricalTokensTotal: historicalEstimate.estimatedTokensTotal,
                    estimatedHistoricalTokensLastWindow: historicalEstimate.estimatedTokensLastWindow,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((left, right) => {
                const statusDiff = Number(right.isActive) - Number(left.isActive);
                if (statusDiff !== 0) return statusDiff;
                return (right.lastPaymentAt || 0) - (left.lastPaymentAt || 0);
            });
        const premiumUserIds = Array.from(
            new Set(
                premiumUsersBase
                    .map((entry) => String(entry.userId || "").trim())
                    .filter(Boolean)
            )
        );
        const premiumAuthUsers = await fetchAuthUsersByIds(ctx, premiumUserIds);
        const premiumAuthUsersById = new Map(
            premiumAuthUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );
        const premiumUsers = premiumUsersBase.map((entry) => ({
            ...entry,
            email: normalizeEmail(premiumAuthUsersById.get(entry.userId)?.email) || null,
        }));

        const recentFeedbackBase = [...feedbackEntries]
            .sort((left, right) => {
                const leftTimestamp = toTimestamp(left.createdAt, left._creationTime);
                const rightTimestamp = toTimestamp(right.createdAt, right._creationTime);
                return rightTimestamp - leftTimestamp;
            })
            .slice(0, RECENT_FEEDBACK_LIMIT)
            .map((entry) => {
                const userId = String(entry.userId || "").trim();
                const profile = profileByUserId.get(userId);
                return {
                    feedbackId: String(entry._id),
                    userId,
                    rating: Number(entry.rating || 0),
                    message: normalizeFeedbackMessage(entry.message),
                    createdAt: toTimestamp(entry.createdAt, entry._creationTime),
                    fullName: profile?.fullName || null,
                    department: profile?.department || null,
                };
            });
        const recentFeedbackUserIds = Array.from(
            new Set(
                recentFeedbackBase
                    .map((entry) => String(entry.userId || "").trim())
                    .filter(Boolean)
            )
        );
        const recentFeedbackAuthUsers = await fetchAuthUsersByIds(ctx, recentFeedbackUserIds);
        const recentFeedbackAuthUsersById = new Map(
            recentFeedbackAuthUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );
        const recentFeedback = recentFeedbackBase.map((entry) => {
            const authUser = recentFeedbackAuthUsersById.get(entry.userId);
            const message = normalizeFeedbackMessage(entry.message);
            return {
                ...entry,
                email: normalizeEmail(authUser?.email) || null,
                hasMessage: Boolean(message),
                message,
            };
        });

        const recentProductResearchResponsesBase = [...productResearchResponses]
            .sort((left, right) => {
                const leftTimestamp = toTimestamp(left.createdAt, left._creationTime);
                const rightTimestamp = toTimestamp(right.createdAt, right._creationTime);
                return rightTimestamp - leftTimestamp;
            })
            .slice(0, RECENT_RESEARCH_RESPONSES_LIMIT)
            .map((entry) => {
                const userId = String(entry.userId || "").trim();
                const profile = profileByUserId.get(userId);
                return {
                    responseId: String(entry._id),
                    userId,
                    email: normalizeEmail(entry.email) || null,
                    campaign: String(entry.campaign || "").trim() || "unknown",
                    cohort: String(entry.cohort || "").trim() || null,
                    howUsingApp: normalizeFeedbackMessage(entry.howUsingApp),
                    wantedFeatures: normalizeFeedbackMessage(entry.wantedFeatures),
                    additionalNotes: normalizeFeedbackMessage(entry.additionalNotes),
                    source: String(entry.source || "").trim() || null,
                    createdAt: toTimestamp(entry.createdAt, entry._creationTime),
                    fullName: profile?.fullName || null,
                    department: profile?.department || null,
                };
            });
        const recentProductResearchUserIds = Array.from(
            new Set(
                recentProductResearchResponsesBase
                    .map((entry) => String(entry.userId || "").trim())
                    .filter(Boolean)
            )
        );
        const recentProductResearchAuthUsers = await fetchAuthUsersByIds(ctx, recentProductResearchUserIds);
        const recentProductResearchAuthUsersById = new Map(
            recentProductResearchAuthUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );
        const recentProductResearchResponses = recentProductResearchResponsesBase.map((entry) => {
            const authUser = recentProductResearchAuthUsersById.get(entry.userId);
            const additionalNotes = normalizeFeedbackMessage(entry.additionalNotes);
            return {
                ...entry,
                email: normalizeEmail(authUser?.email) || entry.email || null,
                hasAdditionalNotes: Boolean(additionalNotes),
                additionalNotes,
            };
        });

        const latestLandingByCampaignUser = new Map<string, {
            landedAt: number;
            landingCount: number;
            source: string | null;
            medium: string | null;
            content: string | null;
            landingPath: string | null;
        }>();
        for (const event of campaignLandingEvents) {
            const campaignId = String(event.campaignId || "").trim();
            const userId = String(event.userId || "").trim();
            if (!campaignId || !userId) continue;
            const landedAt = toTimestamp(event.lastLandedAt, toTimestamp(event.firstLandedAt, 0));
            const key = buildCampaignUserKey(campaignId, userId);
            const existing = latestLandingByCampaignUser.get(key);
            if (existing && existing.landedAt >= landedAt) {
                continue;
            }
            latestLandingByCampaignUser.set(key, {
                landedAt,
                landingCount: toNonNegativeInteger(event.landingCount) || 1,
                source: String(event.source || "").trim() || null,
                medium: String(event.medium || "").trim() || null,
                content: String(event.content || "").trim() || null,
                landingPath: String(event.landingPath || "").trim() || null,
            });
        }

        const sentCampaignGrantByCampaignUser = new Map<string, {
            campaignId: string;
            userId: string;
            sentAt: number;
        }>();
        for (const grant of campaignCreditGrants) {
            const campaignId = String(grant.campaignId || "").trim();
            const userId = String(grant.userId || "").trim();
            const sentAt = toTimestamp(grant.emailSentAt, 0);
            if (!campaignId || !userId || sentAt <= 0) continue;

            const key = buildCampaignUserKey(campaignId, userId);
            const existing = sentCampaignGrantByCampaignUser.get(key);
            if (!existing || sentAt > existing.sentAt) {
                sentCampaignGrantByCampaignUser.set(key, {
                    campaignId,
                    userId,
                    sentAt,
                });
            }
        }

        const sentGrantsByCampaign = new Map<string, Array<{
            campaignId: string;
            userId: string;
            sentAt: number;
        }>>();
        for (const grant of sentCampaignGrantByCampaignUser.values()) {
            const existing = sentGrantsByCampaign.get(grant.campaignId) || [];
            existing.push(grant);
            sentGrantsByCampaign.set(grant.campaignId, existing);
        }

        const buildRate = (count: number, total: number) =>
            total > 0 ? Math.round((count / total) * 1000) / 1000 : 0;

        const campaignPerformanceReports = [...sentGrantsByCampaign.entries()]
            .map(([campaignId, sentGrants]) => {
                let attributedLandingCount = 0;
                let totalAttributedLandings = 0;
                let returnedCount = 0;
                let uploadedCount = 0;
                let activatedCount = 0;
                let paidCount = 0;
                let firstSentAt = 0;
                let lastSentAt = 0;
                let lastAttributedLandingAt = 0;

                for (const grant of sentGrants) {
                    const sentAt = grant.sentAt;
                    const userId = grant.userId;
                    if (firstSentAt === 0 || sentAt < firstSentAt) {
                        firstSentAt = sentAt;
                    }
                    if (sentAt > lastSentAt) {
                        lastSentAt = sentAt;
                    }

                    const landingInfo = latestLandingByCampaignUser.get(
                        buildCampaignUserKey(campaignId, userId)
                    ) || null;
                    const hasAttributedLanding = Boolean(
                        landingInfo && landingInfo.landedAt >= sentAt
                    );
                    if (hasAttributedLanding && landingInfo) {
                        attributedLandingCount += 1;
                        totalAttributedLandings += Math.max(1, landingInfo.landingCount);
                        if (landingInfo.landedAt > lastAttributedLandingAt) {
                            lastAttributedLandingAt = landingInfo.landedAt;
                        }
                    }

                    const latestPresenceAt = latestPresenceByUser.get(userId) || 0;
                    const latestUploadAt = latestUploadByUser.get(userId) || 0;
                    const latestActivationAt = latestActivationByUser.get(userId) || 0;
                    const latestPaidAt = latestPaymentByUser.get(userId) || 0;

                    const hasReturned =
                        hasAttributedLanding
                        || latestPresenceAt >= sentAt
                        || latestUploadAt >= sentAt
                        || latestActivationAt >= sentAt
                        || latestPaidAt >= sentAt;
                    if (hasReturned) {
                        returnedCount += 1;
                    }
                    if (latestUploadAt >= sentAt) {
                        uploadedCount += 1;
                    }
                    if (latestActivationAt >= sentAt) {
                        activatedCount += 1;
                    }
                    if (latestPaidAt >= sentAt) {
                        paidCount += 1;
                    }
                }

                const sentCount = sentGrants.length;
                return {
                    campaignId,
                    sentCount,
                    attributedLandingCount,
                    totalAttributedLandings,
                    returnedCount,
                    uploadedCount,
                    activatedCount,
                    paidCount,
                    firstSentAt,
                    lastSentAt,
                    lastAttributedLandingAt: lastAttributedLandingAt || null,
                    rates: {
                        attributedLanding: buildRate(attributedLandingCount, sentCount),
                        returned: buildRate(returnedCount, sentCount),
                        uploaded: buildRate(uploadedCount, sentCount),
                        activated: buildRate(activatedCount, sentCount),
                        paid: buildRate(paidCount, sentCount),
                    },
                };
            })
            .sort((left, right) => {
                if ((right.lastSentAt || 0) !== (left.lastSentAt || 0)) {
                    return (right.lastSentAt || 0) - (left.lastSentAt || 0);
                }
                return left.campaignId.localeCompare(right.campaignId);
            });

        const sessionStatsByUser = new Map<string, { count: number; latestAt: number }>();
        for (const session of activeSessions) {
            const userId = normalizeSessionUserId(session);
            if (!userId) continue;
            const timestampMs = toTimestamp(session.updatedAt, toTimestamp(session.createdAt, 0));
            const current = sessionStatsByUser.get(userId) || { count: 0, latestAt: 0 };
            current.count += 1;
            current.latestAt = Math.max(current.latestAt, timestampMs);
            sessionStatsByUser.set(userId, current);
        }

        const activeSessionUserIds = Array.from(sessionStatsByUser.keys());
        const authUsers = await fetchAuthUsersByIds(ctx, activeSessionUserIds);
        const authUsersById = new Map(
            authUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );

        const signedInUsers = activeSessionUserIds
            .map((userId) => {
                const stats = sessionStatsByUser.get(userId);
                if (!stats) return null;
                const authUser = authUsersById.get(userId);
                const profile = profileByUserId.get(userId);
                const llmUsage = getUserLlmUsage(userId);
                const historicalEstimate = getUserHistoricalLlmEstimate(userId);
                return {
                    userId,
                    email: normalizeEmail(authUser?.email) || null,
                    fullName: profile?.fullName || authUser?.name || userId,
                    emailVerified: Boolean(authUser?.emailVerified),
                    createdAt: toTimestamp(authUser?.createdAt, profile?._creationTime || 0),
                    lastSessionAt: stats.latestAt,
                    activeSessionCount: stats.count,
                    department: profile?.department || null,
                    llmTokensTotal: llmUsage.totalTokens,
                    llmTokensLastWindow: llmUsage.totalTokensLastWindow,
                    llmRequestsTotal: llmUsage.requestCount,
                    llmRequestsLastWindow: llmUsage.requestCountLastWindow,
                    estimatedHistoricalTokensTotal: historicalEstimate.estimatedTokensTotal,
                    estimatedHistoricalTokensLastWindow: historicalEstimate.estimatedTokensLastWindow,
                };
            })
            .filter((record): record is NonNullable<typeof record> => Boolean(record))
            .sort((left, right) => right.lastSessionAt - left.lastSessionAt);

        const totalTrackedUploads = [...uploadChannelStats.values()].reduce(
            (sum, stats) => sum + stats.total,
            0
        );
        const channelLabelByKey: Record<string, string> = {
            study_materials: "Study materials",
            assignment_helper: "Assignment helper",
        };
        const uploadBreakdownByChannel = [...uploadChannelStats.entries()]
            .map(([channelKey, stats]) => {
                const percent = totalTrackedUploads > 0
                    ? Math.round((stats.total / totalTrackedUploads) * 1000) / 10
                    : 0;
                const readyRatePercent = stats.total > 0
                    ? Math.round((stats.ready / stats.total) * 1000) / 10
                    : 0;
                return {
                    key: channelKey,
                    label: channelLabelByKey[channelKey] || channelKey,
                    count: stats.total,
                    percent,
                    readyRatePercent,
                    statuses: {
                        ready: stats.ready,
                        processing: stats.processing,
                        error: stats.error,
                        other: stats.other,
                    },
                };
            })
            .sort((left, right) => right.count - left.count);

        const uploadBreakdownByFileType = [...uploadFileTypeCounts.entries()]
            .map(([fileType, count]) => ({
                fileType,
                count,
                percent: totalTrackedUploads > 0
                    ? Math.round((count / totalTrackedUploads) * 1000) / 10
                    : 0,
            }))
            .sort((left, right) => {
                if (right.count !== left.count) return right.count - left.count;
                return left.fileType.localeCompare(right.fileType);
            })
            .slice(0, 8);

        const topUploadUsersBase = [...uploadStatsByUser.entries()]
            .map(([userId, stats]) => {
                const profile = profileByUserId.get(userId);
                return {
                    userId,
                    fullName: profile?.fullName || null,
                    department: profile?.department || null,
                    totalUploads: stats.totalUploads,
                    studyUploads: stats.studyUploads,
                    assignmentUploads: stats.assignmentUploads,
                    readyUploads: stats.readyUploads,
                    processingUploads: stats.processingUploads,
                    errorUploads: stats.errorUploads,
                    otherUploads: stats.otherUploads,
                };
            })
            .sort((left, right) => {
                if (right.totalUploads !== left.totalUploads) return right.totalUploads - left.totalUploads;
                if (right.readyUploads !== left.readyUploads) return right.readyUploads - left.readyUploads;
                return left.userId.localeCompare(right.userId);
            })
            .slice(0, 10);
        const topUploadUserIds = Array.from(
            new Set(
                topUploadUsersBase
                    .map((entry) => String(entry.userId || "").trim())
                    .filter(Boolean)
            )
        );
        const topUploadAuthUsers = await fetchAuthUsersByIds(ctx, topUploadUserIds);
        const topUploadAuthUsersById = new Map(
            topUploadAuthUsers
                .map((authUser) => [normalizeAuthUserId(authUser), authUser] as const)
                .filter(([userId]) => Boolean(userId))
        );
        const topUploadUsers = topUploadUsersBase.map((entry) => ({
            ...entry,
            email: normalizeEmail(topUploadAuthUsersById.get(entry.userId)?.email) || null,
        }));

        const latestQuestionTargetAuditRun = questionTargetAuditRuns[0] || null;
        const latestQuestionTargetAuditWithRebases =
            questionTargetAuditRuns.find((run: any) => Array.isArray(run?.rebasedTopics) && run.rebasedTopics.length > 0)
            || latestQuestionTargetAuditRun;
        const mapQuestionTargetAuditRun = (run: any) => {
            if (!run) return null;
            return {
                dryRun: run.dryRun === true,
                startedAt: toTimestamp(run.startedAt, 0),
                finishedAt: toTimestamp(run.finishedAt, 0),
                staleHours: Number(run.staleHours) || 0,
                maxTopicsPerFormat: Number(run.maxTopicsPerFormat) || 0,
                mcqSummary: {
                    scannedTopicCount: Number(run?.mcqSummary?.scannedTopicCount) || 0,
                    candidateTopicCount: Number(run?.mcqSummary?.candidateTopicCount) || 0,
                    rebasedTopicCount: Number(run?.mcqSummary?.rebasedTopicCount) || 0,
                    scheduledTopicCount: Number(run?.mcqSummary?.scheduledTopicCount) || 0,
                    totalTargetReduction: Number(run?.mcqSummary?.totalTargetReduction) || 0,
                },
                essaySummary: {
                    scannedTopicCount: Number(run?.essaySummary?.scannedTopicCount) || 0,
                    candidateTopicCount: Number(run?.essaySummary?.candidateTopicCount) || 0,
                    rebasedTopicCount: Number(run?.essaySummary?.rebasedTopicCount) || 0,
                    scheduledTopicCount: Number(run?.essaySummary?.scheduledTopicCount) || 0,
                    totalTargetReduction: Number(run?.essaySummary?.totalTargetReduction) || 0,
                },
                totalRebasedTopics: Array.isArray(run?.rebasedTopics) ? run.rebasedTopics.length : 0,
                rebasedTopics: (Array.isArray(run?.rebasedTopics) ? run.rebasedTopics : [])
                    .slice(0, 20)
                    .map((topic: any) => ({
                        format: String(topic?.format || ""),
                        topicId: String(topic?.topicId || ""),
                        topicTitle: String(topic?.topicTitle || "Unknown Topic"),
                        currentTarget: Number(topic?.currentTarget) || 0,
                        recalculatedTarget: Number(topic?.recalculatedTarget) || 0,
                        usableObjectiveCount: Number(topic?.usableObjectiveCount ?? topic?.usableMcqCount) || 0,
                        usableMcqCount: Number(topic?.usableMcqCount) || 0,
                        usableEssayCount: Number(topic?.usableEssayCount) || 0,
                        fillRatio: Number(topic?.fillRatio) || 0,
                        scheduled: topic?.scheduled === true,
                        wordCountTarget: Number.isFinite(Number(topic?.wordCountTarget))
                            ? Number(topic.wordCountTarget)
                            : null,
                        evidenceRichnessCap: Number.isFinite(Number(topic?.evidenceRichnessCap))
                            ? Number(topic.evidenceRichnessCap)
                            : null,
                        evidenceCapBroadTopicPenaltyApplied: topic?.evidenceCapBroadTopicPenaltyApplied === true,
                        retrievedEvidencePassageCount: Number.isFinite(Number(topic?.retrievedEvidencePassageCount))
                            ? Number(topic.retrievedEvidencePassageCount)
                            : null,
                    })),
            };
        };

        const paymentProviderSetting = await readPaymentProviderSetting(ctx);

        return {
            allowed: true as const,
            generatedAt: now,
            paymentProviderConfig: {
                selected: paymentProviderSetting.provider,
                selectedLabel: getPaymentProviderDisplayName(paymentProviderSetting.provider),
                updatedAt: paymentProviderSetting.updatedAt,
                updatedByUserId: paymentProviderSetting.updatedByUserId,
                options: PAYMENT_PROVIDER_OPTIONS.map((option) => ({
                    id: option.id,
                    label: option.label,
                    requiresKey: option.requiresKey,
                })),
            },
            windows: {
                newUsersDays: NEW_USER_WINDOW_DAYS,
                activeUsersDays: ACTIVE_USER_WINDOW_DAYS,
            },
            totals: {
                userProfiles: profiles.length,
                signedInUsersNow: sessionStatsByUser.size,
                signedInUsersResolved: signedInUsers.length,
                activeUsersLast5Minutes: activeUsersLast5Minutes.size,
                premiumUsersTotal: subscriptionAnalytics.premiumUsersTotal,
                premiumUsersActive: subscriptionAnalytics.premiumUsersActive,
                newUsersLastWindow,
                newUsersPrevWindow,
                activeUsersLastWindow: activeUsersLastWindow.size,
                activeUsersPrevWindow: activeUsersPrevWindow.size,
                documentsProcessedTotal: uploadReadyTotal + assignmentReadyTotal,
                documentsProcessedLastWindow: uploadReadyLastWindow + assignmentReadyLastWindow,
                feedbackTotal,
                feedbackLastWindow,
                feedbackWithMessageTotal,
                feedbackWithMessageLastWindow,
                averageFeedbackRating,
                productResearchResponsesTotal,
                productResearchResponsesLastWindow,
                productResearchResponsesWithNotesTotal,
                productResearchResponsesWithNotesLastWindow,
                productResearchRespondersTotal,
                llmTrackedUsers: llmUsageByUser.size,
                llmRequestsTotal,
                llmRequestsLastWindow,
                llmTokensTotal,
                llmTokensLastWindow,
                llmHistoricalEstimatedUsers: historicalLlmEstimateByUser.size,
                llmHistoricalEstimatedTokensTotal: historicalEstimatedTokensTotal,
                llmHistoricalEstimatedTokensLastWindow: historicalEstimatedTokensLastWindow,
            },
            documents: {
                uploads: {
                    total: uploads.length,
                    ready: uploadReadyTotal,
                    processing: uploads.filter((upload) => upload.status === "processing").length,
                    error: uploads.filter((upload) => upload.status === "error").length,
                },
                assignments: {
                    total: assignmentThreads.length,
                    ready: assignmentReadyTotal,
                    processing: assignmentThreads.filter((thread) => thread.status === "processing").length,
                    error: assignmentThreads.filter((thread) => thread.status === "error").length,
                },
            },
            flags: {
                activeSessionsTruncated: activeSessionsResult.truncated,
            },
            uploadBreakdown: {
                total: totalTrackedUploads,
                channels: uploadBreakdownByChannel,
                fileTypes: uploadBreakdownByFileType,
                topUsers: topUploadUsers,
            },
            questionTargetAudit: {
                latestRun: mapQuestionTargetAuditRun(latestQuestionTargetAuditRun),
                latestRunWithRebases: mapQuestionTargetAuditRun(latestQuestionTargetAuditWithRebases),
            },
            llmUsageAnalytics: {
                trackedUsers: llmUsageByUser.size,
                requestCountTotal: llmRequestsTotal,
                requestCountLastWindow: llmRequestsLastWindow,
                promptTokensTotal: llmPromptTokensTotal,
                promptTokensLastWindow: llmPromptTokensLastWindow,
                completionTokensTotal: llmCompletionTokensTotal,
                completionTokensLastWindow: llmCompletionTokensLastWindow,
                totalTokens: llmTokensTotal,
                totalTokensLastWindow: llmTokensLastWindow,
                firstTrackedAt: llmUsageFirstTrackedAt || null,
                lastTrackedAt: llmUsageLastTrackedAt || null,
            },
            historicalLlmEstimateAnalytics: {
                estimatedUsers: historicalLlmEstimateByUser.size,
                requestCountTotal: historicalEstimatedRequestCountTotal,
                requestCountLastWindow: historicalEstimatedRequestCountLastWindow,
                aiMessageCountTotal: historicalAiMessageCountTotal,
                aiMessageCountLastWindow: historicalAiMessageCountLastWindow,
                humanizerCountTotal: historicalHumanizerCountTotal,
                humanizerCountLastWindow: historicalHumanizerCountLastWindow,
                totalTokens: historicalEstimatedTokensTotal,
                totalTokensLastWindow: historicalEstimatedTokensLastWindow,
                estimatedAiMessageTokensPerRequest: historicalAiMessageTokensPerRequest,
                estimatedHumanizerTokensPerRequest: historicalHumanizerTokensPerRequest,
                coverage:
                    "Estimated from historical AI message and humanizer quota counters recorded before provider token tracking was enabled.",
            },
            productResearchAnalytics: {
                responseTotal: productResearchResponsesTotal,
                responsesLastWindow: productResearchResponsesLastWindow,
                respondersTotal: productResearchRespondersTotal,
                withNotesTotal: productResearchResponsesWithNotesTotal,
                withNotesLastWindow: productResearchResponsesWithNotesLastWindow,
                campaignBreakdown: [...productResearchCampaignCounts.entries()]
                    .map(([campaign, count]) => ({ campaign, count }))
                    .sort((left, right) => right.count - left.count),
            },
            campaignPerformanceReports,
            adminEmails: access.adminEmails,
            recentUsers,
            recentFeedback,
            recentProductResearchResponses,
            signedInUsers,
            premiumUsers,
            examAnalytics,
            conceptAnalytics,
            subscriptionAnalytics,
            revenueAnalytics,
            billingRecovery,
            contentAnalytics,
            engagementAnalytics,
        };
    },
});
