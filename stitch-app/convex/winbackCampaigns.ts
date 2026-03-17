import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { components, internal } from "./_generated/api";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHURN_THRESHOLD_DAYS = 30;
const WINBACK_CREDITS = 2;
const DEFAULT_CAMPAIGN_ID = "winback_inactive30_bonus2_2026_03_16";
const WINBACK_EMAIL_TYPE = "winback_offers";
const CREDIT_TYPE = "upload_credits";
const DEFAULT_CURRENCY = "GHS";
const APP_NAME = "ChewnPour";
const APP_URL = "https://chewnpour.com";
const BETTER_AUTH_USER_CHUNK_SIZE = 100;
const MAX_RECIPIENTS_PER_RUN = 100;
const MAX_PREVIEW_SAMPLE = 25;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeString = (value: unknown, maxLength = 200) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return "";
    return normalized.slice(0, maxLength);
};

const normalizeUserId = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

const normalizeEmail = (value: unknown) => {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!normalized || !EMAIL_PATTERN.test(normalized)) return "";
    return normalized;
};

const toPositiveInt = (value: unknown, fallback: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, Math.floor(parsed)));
};

const toNonNegativeInt = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < arr.length; index += size) {
        chunks.push(arr.slice(index, index + size));
    }
    return chunks;
};

const encode = (value: string) => encodeURIComponent(value);

const buildDashboardUrl = () => `${APP_URL}/dashboard`;

const buildUnsubscribeUrl = (token: string) =>
    `${APP_URL}/unsubscribe?token=${encode(token)}&type=winback_offers`;

const buildWinbackTemplate = (displayName: string, unsubscribeUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${APP_NAME}</title>
<style>
  body { margin:0; padding:0; background:#f5f7fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .container { max-width:560px; margin:24px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
  .header { padding:24px; background:#0f172a; color:#ffffff; }
  .body { padding:24px; color:#1f2937; line-height:1.6; font-size:15px; }
  .highlight { margin:16px 0; padding:16px; border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-weight:700; }
  .cta { display:inline-block; margin-top:16px; padding:12px 24px; border-radius:8px; text-decoration:none; background:#2563eb; color:#ffffff !important; font-weight:600; }
  .footer { padding:16px 24px 24px; color:#6b7280; font-size:12px; }
  .footer a { color:#6b7280; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><strong>${APP_NAME}</strong></div>
    <div class="body">
      <p>Hi ${displayName},</p>
      <p>It has been a while since you last studied on ${APP_NAME}, so we added a small welcome-back bonus to your account.</p>
      <div class="highlight">+${WINBACK_CREDITS} upload credits have already been added.</div>
      <p>Upload a document, generate a lesson, and get back into study mode.</p>
      <a class="cta" href="${buildDashboardUrl()}">Use My Credits</a>
    </div>
    <div class="footer">
      <p>You received this because win-back offers are enabled on your account.</p>
      <p><a href="${unsubscribeUrl}">Unsubscribe</a> from win-back offers.</p>
    </div>
  </div>
</body>
</html>`;

const sendEmailViaResend = async (params: {
    to: string;
    subject: string;
    html: string;
}): Promise<boolean> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn("[winbackCampaigns] RESEND_API_KEY not set -- skipping send.");
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
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
            console.error("[winbackCampaigns] Resend API error", {
                status: response.status,
                body: body.slice(0, 500),
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error("[winbackCampaigns] Failed to send email", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

const fetchAuthUsersByIds = async (ctx: any, userIds: string[]) => {
    const normalizedIds = Array.from(new Set(userIds.map((userId) => normalizeUserId(userId)).filter(Boolean)));
    if (normalizedIds.length === 0) return [];

    const usersById = new Map<string, any>();
    const idChunks = chunkArray(normalizedIds, BETTER_AUTH_USER_CHUNK_SIZE);

    for (const idChunk of idChunks) {
        const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
            model: "user",
            where: [{ field: "id", operator: "in", value: idChunk }],
            paginationOpts: { cursor: null, numItems: idChunk.length },
        });
        const pageRows = Array.isArray(result?.page) ? result.page : [];
        for (const authUser of pageRows) {
            const id = normalizeUserId(authUser?.id);
            if (id) {
                usersById.set(id, authUser);
            }
        }
    }

    return normalizedIds
        .map((id) => usersById.get(id))
        .filter((user): user is NonNullable<typeof user> => Boolean(user));
};

const getCampaignId = (campaignId: unknown) =>
    normalizeString(campaignId, 120) || DEFAULT_CAMPAIGN_ID;

export const getEligibleChurnedUsersInternal = internalQuery({
    args: {
        campaignId: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const inactivityThresholdMs = CHURN_THRESHOLD_DAYS * DAY_MS;
        const effectiveCampaignId = getCampaignId(args.campaignId);
        const limit = toPositiveInt(args.limit, MAX_PREVIEW_SAMPLE, 500);

        const [
            profiles,
            uploads,
            assignmentThreads,
            examAttempts,
            conceptAttempts,
            userPresence,
            grants,
        ] = await Promise.all([
            ctx.db.query("profiles").collect(),
            ctx.db.query("uploads").collect(),
            ctx.db.query("assignmentThreads").collect(),
            ctx.db.query("examAttempts").collect(),
            ctx.db.query("conceptAttempts").collect(),
            ctx.db.query("userPresence").collect(),
            ctx.db.query("campaignCreditGrants").collect(),
        ]);

        const lastActivityByUser = new Map<string, number>();
        const updateLastActivity = (userId: unknown, timestamp: unknown) => {
            const normalizedUserId = normalizeUserId(userId);
            const parsedTimestamp = Number(timestamp);
            if (!normalizedUserId || !Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
                return;
            }
            const previousTimestamp = lastActivityByUser.get(normalizedUserId) || 0;
            if (parsedTimestamp > previousTimestamp) {
                lastActivityByUser.set(normalizedUserId, parsedTimestamp);
            }
        };

        for (const upload of uploads) updateLastActivity(upload.userId, upload._creationTime);
        for (const thread of assignmentThreads) updateLastActivity(thread.userId, thread._creationTime);
        for (const attempt of examAttempts) updateLastActivity(attempt.userId, attempt._creationTime);
        for (const attempt of conceptAttempts) updateLastActivity(attempt.userId, attempt._creationTime);
        for (const presence of userPresence) updateLastActivity(presence.userId, presence.lastSeenAt);

        const grantByUserId = new Map<string, any>();
        for (const grant of grants) {
            if (String(grant.campaignId || "").trim() !== effectiveCampaignId) continue;
            const userId = normalizeUserId(grant.userId);
            if (!userId || grantByUserId.has(userId)) continue;
            grantByUserId.set(userId, grant);
        }

        const candidates = profiles
            .map((profile) => {
                const userId = normalizeUserId(profile.userId);
                if (!userId) return null;

                const prefs = profile.emailPreferences ?? {
                    streakReminders: true,
                    streakBroken: true,
                    weeklySummary: true,
                    productResearch: true,
                    winbackOffers: true,
                };
                if (!prefs.winbackOffers) return null;

                const lastActivityAt = lastActivityByUser.get(userId) || 0;
                if (lastActivityAt <= 0) return null;

                const inactiveMs = now - lastActivityAt;
                if (inactiveMs < inactivityThresholdMs) return null;

                const existingGrant = grantByUserId.get(userId) || null;
                if (existingGrant && Number(existingGrant.emailSentAt || 0) > 0) return null;

                return {
                    userId,
                    fullName: normalizeString(profile.fullName, 120) || null,
                    lastActivityAt,
                    daysInactive: Math.floor(inactiveMs / DAY_MS),
                    grantId: existingGrant?._id || null,
                    alreadyGranted: Boolean(existingGrant),
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((left, right) => right.daysInactive - left.daysInactive);

        return {
            campaignId: effectiveCampaignId,
            churnThresholdDays: CHURN_THRESHOLD_DAYS,
            grantCredits: WINBACK_CREDITS,
            totalEligible: candidates.length,
            candidates: candidates.slice(0, limit),
        };
    },
});

export const getChurnBreakdownRowsInternal = internalQuery({
    args: {
        campaignId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const effectiveCampaignId = getCampaignId(args.campaignId);

        const [
            profiles,
            uploads,
            assignmentThreads,
            examAttempts,
            conceptAttempts,
            userPresence,
            grants,
        ] = await Promise.all([
            ctx.db.query("profiles").collect(),
            ctx.db.query("uploads").collect(),
            ctx.db.query("assignmentThreads").collect(),
            ctx.db.query("examAttempts").collect(),
            ctx.db.query("conceptAttempts").collect(),
            ctx.db.query("userPresence").collect(),
            ctx.db.query("campaignCreditGrants").collect(),
        ]);

        const lastActivityByUser = new Map<string, number>();
        const updateLastActivity = (userId: unknown, timestamp: unknown) => {
            const normalizedUserId = normalizeUserId(userId);
            const parsedTimestamp = Number(timestamp);
            if (!normalizedUserId || !Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
                return;
            }
            const previousTimestamp = lastActivityByUser.get(normalizedUserId) || 0;
            if (parsedTimestamp > previousTimestamp) {
                lastActivityByUser.set(normalizedUserId, parsedTimestamp);
            }
        };

        for (const upload of uploads) updateLastActivity(upload.userId, upload._creationTime);
        for (const thread of assignmentThreads) updateLastActivity(thread.userId, thread._creationTime);
        for (const attempt of examAttempts) updateLastActivity(attempt.userId, attempt._creationTime);
        for (const attempt of conceptAttempts) updateLastActivity(attempt.userId, attempt._creationTime);
        for (const presence of userPresence) updateLastActivity(presence.userId, presence.lastSeenAt);

        const processedCampaignUsers = new Set<string>();
        for (const grant of grants) {
            if (String(grant.campaignId || "").trim() !== effectiveCampaignId) continue;
            const userId = normalizeUserId(grant.userId);
            if (!userId) continue;
            processedCampaignUsers.add(userId);
        }

        return profiles.map((profile) => {
            const userId = normalizeUserId(profile.userId);
            const prefs = profile.emailPreferences ?? {
                streakReminders: true,
                streakBroken: true,
                weeklySummary: true,
                productResearch: true,
                winbackOffers: true,
            };
            const lastActivityAt = lastActivityByUser.get(userId) || 0;
            const hasTrackedActivity = lastActivityAt > 0;
            const daysInactive = hasTrackedActivity
                ? Math.floor(Math.max(0, now - lastActivityAt) / DAY_MS)
                : null;

            return {
                userId,
                fullName: normalizeString(profile.fullName, 120) || null,
                hasTrackedActivity,
                lastActivityAt: hasTrackedActivity ? lastActivityAt : null,
                daysInactive,
                winbackOffersEnabled: prefs.winbackOffers !== false,
                alreadyProcessedForCampaign: processedCampaignUsers.has(userId),
            };
        });
    },
});

export const ensureCampaignCreditGrantInternal = internalMutation({
    args: {
        campaignId: v.string(),
        userId: v.string(),
        email: v.optional(v.string()),
        lastActivityAt: v.number(),
        daysInactive: v.number(),
    },
    handler: async (ctx, args) => {
        const campaignId = getCampaignId(args.campaignId);
        const userId = normalizeUserId(args.userId);
        if (!campaignId || !userId) {
            throw new Error("Campaign id and user id are required.");
        }

        const existingGrant = await ctx.db
            .query("campaignCreditGrants")
            .withIndex("by_userId_campaignId", (q) => q.eq("userId", userId).eq("campaignId", campaignId))
            .first();
        if (existingGrant) {
            return {
                grantId: existingGrant._id,
                alreadyGranted: true as const,
                emailSentAt: Number(existingGrant.emailSentAt || 0) || null,
                grantedCredits: Number(existingGrant.grantedCredits || 0) || WINBACK_CREDITS,
            };
        }

        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        const purchasedUploadCredits = toNonNegativeInt(subscription?.purchasedUploadCredits);
        const consumedUploadCredits = toNonNegativeInt(subscription?.consumedUploadCredits);
        const nextPurchasedUploadCredits = purchasedUploadCredits + WINBACK_CREDITS;

        if (subscription) {
            await ctx.db.patch(subscription._id, {
                purchasedUploadCredits: nextPurchasedUploadCredits,
                consumedUploadCredits,
                plan: normalizeString(subscription.plan, 40) || "free",
                status: normalizeString(subscription.status, 40) || "active",
                amount: typeof subscription.amount === "number" ? subscription.amount : 0,
                currency: normalizeString(subscription.currency, 12) || DEFAULT_CURRENCY,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId,
                plan: "free",
                status: "active",
                amount: 0,
                currency: DEFAULT_CURRENCY,
                purchasedUploadCredits: WINBACK_CREDITS,
                consumedUploadCredits: 0,
            });
        }

        const grantId = await ctx.db.insert("campaignCreditGrants", {
            campaignId,
            userId,
            email: normalizeEmail(args.email) || undefined,
            creditType: CREDIT_TYPE,
            grantedCredits: WINBACK_CREDITS,
            grantedAt: Date.now(),
            lastActivityAt: toNonNegativeInt(args.lastActivityAt),
            daysInactive: toNonNegativeInt(args.daysInactive),
            emailType: WINBACK_EMAIL_TYPE,
            source: "churn_winback_campaign",
        });

        return {
            grantId,
            alreadyGranted: false as const,
            emailSentAt: null,
            grantedCredits: WINBACK_CREDITS,
        };
    },
});

export const markCampaignCreditGrantEmailSentInternal = internalMutation({
    args: {
        grantId: v.id("campaignCreditGrants"),
        email: v.optional(v.string()),
        emailedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const emailedAt = toNonNegativeInt(args.emailedAt) || Date.now();
        await ctx.db.patch(args.grantId, {
            email: normalizeEmail(args.email) || undefined,
            emailSentAt: emailedAt,
        });
        return { ok: true as const, emailedAt };
    },
});

export const sendChurnWinbackCampaignInternal = internalAction({
    args: {
        campaignId: v.optional(v.string()),
        dryRun: v.optional(v.boolean()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const campaignId = getCampaignId(args.campaignId);
        const dryRun = args.dryRun === true;
        const limit = toPositiveInt(args.limit, MAX_RECIPIENTS_PER_RUN, MAX_RECIPIENTS_PER_RUN);
        const preview = await ctx.runQuery(internal.winbackCampaigns.getEligibleChurnedUsersInternal, {
            campaignId,
            limit,
        });

        const authUsers = await fetchAuthUsersByIds(
            ctx,
            preview.candidates.map((candidate: any) => String(candidate.userId || "")),
        );
        const authUsersById = new Map(
            authUsers
                .map((authUser) => [normalizeUserId(authUser?.id), authUser] as const)
                .filter(([userId]) => Boolean(userId)),
        );

        const sendableCandidates = preview.candidates
            .map((candidate: any) => {
                const authUser = authUsersById.get(candidate.userId);
                const email = normalizeEmail(authUser?.email);
                return {
                    ...candidate,
                    email: email || null,
                    displayName: normalizeString(candidate.fullName, 120)
                        || normalizeString(authUser?.name, 120)
                        || (email ? email.split("@")[0] : "there"),
                };
            })
            .filter((candidate: any) => Boolean(candidate.email))
            .slice(0, limit);
        const missingEmailCandidates = preview.candidates
            .map((candidate: any) => {
                const authUser = authUsersById.get(candidate.userId);
                const email = normalizeEmail(authUser?.email);
                return {
                    ...candidate,
                    email: email || null,
                };
            })
            .filter((candidate: any) => !candidate.email)
            .slice(0, MAX_PREVIEW_SAMPLE);

        if (dryRun) {
            return {
                campaignId,
                dryRun: true as const,
                churnThresholdDays: preview.churnThresholdDays,
                grantCredits: preview.grantCredits,
                grantableCount: preview.totalEligible,
                totalEligible: preview.totalEligible,
                sendableCount: sendableCandidates.length,
                missingEmailCount: Math.max(0, preview.totalEligible - sendableCandidates.length),
                preview: sendableCandidates.slice(0, MAX_PREVIEW_SAMPLE).map((candidate: any) => ({
                    userId: candidate.userId,
                    email: candidate.email,
                    fullName: candidate.fullName,
                    daysInactive: candidate.daysInactive,
                    lastActivityAt: candidate.lastActivityAt,
                    alreadyGranted: candidate.alreadyGranted,
                })),
                missingEmailPreview: missingEmailCandidates.map((candidate: any) => ({
                    userId: candidate.userId,
                    fullName: candidate.fullName,
                    daysInactive: candidate.daysInactive,
                    lastActivityAt: candidate.lastActivityAt,
                    alreadyGranted: candidate.alreadyGranted,
                })),
            };
        }

        let granted = 0;
        let emailed = 0;
        let skippedNoEmail = 0;
        let grantedWithoutEmail = 0;
        let emailFailures = 0;
        const recipients: Array<{ userId: string; email: string; alreadyGranted: boolean }> = [];

        for (const candidate of preview.candidates) {
            const authUser = authUsersById.get(candidate.userId);
            const email = normalizeEmail(authUser?.email);

            const grant = await ctx.runMutation(internal.winbackCampaigns.ensureCampaignCreditGrantInternal, {
                campaignId,
                userId: candidate.userId,
                email: email || undefined,
                lastActivityAt: candidate.lastActivityAt,
                daysInactive: candidate.daysInactive,
            });
            if (!grant.alreadyGranted) {
                granted += 1;
            }
            if (grant.emailSentAt) {
                continue;
            }
            if (!email) {
                skippedNoEmail += 1;
                grantedWithoutEmail += 1;
                continue;
            }
            if (emailed >= limit) {
                continue;
            }

            const unsubscribeToken = await ctx.runMutation(internal.emailHelpers.ensureUnsubscribeToken, {
                userId: candidate.userId,
            });
            if (!unsubscribeToken) {
                emailFailures += 1;
                continue;
            }

            const html = buildWinbackTemplate(
                normalizeString(candidate.fullName, 120)
                    || normalizeString(authUser?.name, 120)
                    || email.split("@")[0]
                    || "there",
                buildUnsubscribeUrl(unsubscribeToken),
            );

            const ok = await sendEmailViaResend({
                to: email,
                subject: `We added +${WINBACK_CREDITS} upload credits to your ${APP_NAME} account`,
                html,
            });
            if (!ok) {
                emailFailures += 1;
                continue;
            }

            await ctx.runMutation(internal.winbackCampaigns.markCampaignCreditGrantEmailSentInternal, {
                grantId: grant.grantId,
                email,
                emailedAt: Date.now(),
            });
            emailed += 1;
            recipients.push({
                userId: candidate.userId,
                email,
                alreadyGranted: grant.alreadyGranted,
            });
        }

        return {
            campaignId,
            dryRun: false as const,
            churnThresholdDays: preview.churnThresholdDays,
            grantCredits: preview.grantCredits,
            totalEligible: preview.totalEligible,
            granted,
            emailed,
            skippedNoEmail,
            grantedWithoutEmail,
            emailFailures,
            recipients,
        };
    },
});

const assertAdminAccess = async (ctx: any) => {
    const access = await ctx.runQuery(internal.admin.getAdminAccessStatusInternal, {});
    if (!access?.authUserId) {
        throw new Error("Admin sign-in required.");
    }
    if (!access.allowlistConfigured || !access.isAllowed) {
        throw new Error("Admin access required.");
    }
};

export const previewChurnWinbackCampaign = action({
    args: {
        campaignId: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await assertAdminAccess(ctx);
        return await ctx.runAction(internal.winbackCampaigns.sendChurnWinbackCampaignInternal, {
            campaignId: args.campaignId,
            dryRun: true,
            limit: args.limit,
        });
    },
});

export const getChurnBreakdown = action({
    args: {
        campaignId: v.optional(v.string()),
        sampleLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await assertAdminAccess(ctx);

        const campaignId = getCampaignId(args.campaignId);
        const sampleLimit = toPositiveInt(args.sampleLimit, 10, 50);
        const rows = await ctx.runQuery(internal.winbackCampaigns.getChurnBreakdownRowsInternal, {
            campaignId,
        });
        const authUsers = await fetchAuthUsersByIds(
            ctx,
            rows.map((row: any) => String(row.userId || "")),
        );
        const authUsersById = new Map(
            authUsers
                .map((authUser) => [normalizeUserId(authUser?.id), authUser] as const)
                .filter(([userId]) => Boolean(userId)),
        );

        const enrichedRows = rows.map((row: any) => {
            const authUser = authUsersById.get(row.userId);
            const email = normalizeEmail(authUser?.email);
            return {
                ...row,
                email: email || null,
            };
        });

        const neverActivated = enrichedRows.filter((row: any) => !row.hasTrackedActivity);
        const activated = enrichedRows.filter((row: any) => row.hasTrackedActivity);
        const inactive30 = activated.filter((row: any) => Number(row.daysInactive) >= 30);
        const inactive60 = activated.filter((row: any) => Number(row.daysInactive) >= 60);
        const inactive30WithEmail = inactive30.filter((row: any) => Boolean(row.email));
        const inactive30WithoutEmail = inactive30.filter((row: any) => !row.email);
        const inactive30OptedOut = inactive30.filter((row: any) => row.winbackOffersEnabled === false);
        const inactive30OptedIn = inactive30.filter((row: any) => row.winbackOffersEnabled !== false);
        const inactive30Processed = inactive30.filter((row: any) => row.alreadyProcessedForCampaign === true);
        const inactive30Sendable = inactive30.filter((row: any) =>
            Boolean(row.email)
            && row.winbackOffersEnabled !== false
            && row.alreadyProcessedForCampaign !== true
        );

        const sampleRows = (items: any[]) => items
            .slice(0, sampleLimit)
            .map((row) => ({
                userId: row.userId,
                fullName: row.fullName,
                email: row.email,
                daysInactive: row.daysInactive,
                lastActivityAt: row.lastActivityAt,
                winbackOffersEnabled: row.winbackOffersEnabled,
                alreadyProcessedForCampaign: row.alreadyProcessedForCampaign,
            }));

        return {
            campaignId,
            asOf: Date.now(),
            thresholds: {
                inactive30Days: 30,
                inactive60Days: 60,
            },
            counts: {
                totalProfiles: enrichedRows.length,
                activatedUsers: activated.length,
                neverActivatedUsers: neverActivated.length,
                inactive30Users: inactive30.length,
                inactive60Users: inactive60.length,
                inactive30WithEmail: inactive30WithEmail.length,
                inactive30WithoutEmail: inactive30WithoutEmail.length,
                inactive30OptedOut: inactive30OptedOut.length,
                inactive30OptedIn: inactive30OptedIn.length,
                inactive30AlreadyProcessed: inactive30Processed.length,
                inactive30SendableNow: inactive30Sendable.length,
            },
            samples: {
                neverActivated: sampleRows(neverActivated),
                inactive30Sendable: sampleRows(inactive30Sendable),
                inactive30WithoutEmail: sampleRows(inactive30WithoutEmail),
            },
        };
    },
});

export const getNeverActivatedUsers = action({
    args: {
        campaignId: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await assertAdminAccess(ctx);

        const campaignId = getCampaignId(args.campaignId);
        const limit = toPositiveInt(args.limit, 100, 500);
        const rows = await ctx.runQuery(internal.winbackCampaigns.getChurnBreakdownRowsInternal, {
            campaignId,
        });
        const neverActivatedRows = rows.filter((row: any) => !row.hasTrackedActivity);
        const authUsers = await fetchAuthUsersByIds(
            ctx,
            neverActivatedRows.map((row: any) => String(row.userId || "")),
        );
        const authUsersById = new Map(
            authUsers
                .map((authUser) => [normalizeUserId(authUser?.id), authUser] as const)
                .filter(([userId]) => Boolean(userId)),
        );

        const users = neverActivatedRows
            .map((row: any) => {
                const authUser = authUsersById.get(row.userId);
                return {
                    userId: row.userId,
                    fullName: row.fullName,
                    email: normalizeEmail(authUser?.email) || null,
                    winbackOffersEnabled: row.winbackOffersEnabled,
                    alreadyProcessedForCampaign: row.alreadyProcessedForCampaign,
                };
            });

        const withEmail = users.filter((user) => Boolean(user.email));
        const withoutEmail = users.filter((user) => !user.email);

        return {
            campaignId,
            totalNeverActivated: users.length,
            withEmailCount: withEmail.length,
            withoutEmailCount: withoutEmail.length,
            users: users.slice(0, limit),
        };
    },
});

export const runChurnWinbackCampaign = action({
    args: {
        campaignId: v.optional(v.string()),
        dryRun: v.optional(v.boolean()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await assertAdminAccess(ctx);
        return await ctx.runAction(internal.winbackCampaigns.sendChurnWinbackCampaignInternal, {
            campaignId: args.campaignId,
            dryRun: args.dryRun,
            limit: args.limit,
        });
    },
});
