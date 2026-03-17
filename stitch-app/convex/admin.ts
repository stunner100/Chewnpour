import { action, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";

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

        const [profiles, uploads, assignmentThreads, examAttempts, conceptAttempts, feedbackEntries, productResearchResponses, activeSessionsResult, subscriptions, paymentTransactions, courses, humanizerUsage, aiMessageUsage, llmUsageDaily, userPresence, questionTargetAuditRuns] =
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
                ctx.db
                    .query("questionTargetAuditRuns")
                    .withIndex("by_finishedAt")
                    .order("desc")
                    .take(10),
            ]);
        // Topics can contain very large generated content, so avoid full-table
        // scans here and derive admin content metrics from lightweight records.
        const topics: any[] = [];

        const activeSessions = activeSessionsResult.rows;

        const activeUsersLast5Minutes = new Set(
            userPresence
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

        for (const attempt of examAttempts) {
            const userId = String(attempt.userId || "").trim();
            const timestampMs = toTimestamp(attempt._creationTime, 0);
            if (!userId) continue;
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

        for (const attempt of conceptAttempts) {
            const userId = String(attempt.userId || "").trim();
            const timestampMs = toTimestamp(attempt._creationTime, 0);
            if (!userId) continue;
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

        const profileByUserId = new Map(
            profiles
                .map((profile) => [String(profile.userId || "").trim(), profile] as const)
                .filter(([userId]) => Boolean(userId))
        );

        // ── Exam Analytics ──
        const examAttemptsLastWindow = examAttempts.filter((a) => a._creationTime >= sevenDaysAgo).length;
        const mcqAttempts = examAttempts.filter((a) => a.examFormat === "mcq").length;
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
            mcqAttempts,
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
        const totalMcq = hasTopicRows
            ? topics.reduce((sum, topic) => sum + toNonNegativeNumber(topic.usableMcqCount), 0)
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
            averageMcqPerTopic: hasTopicRows ? Math.round((totalMcq / topicCount) * 10) / 10 : 0,
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

        return {
            allowed: true as const,
            generatedAt: now,
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
            contentAnalytics,
            engagementAnalytics,
        };
    },
});
