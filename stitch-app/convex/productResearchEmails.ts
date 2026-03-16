"use node";

import { internalAction } from "./_generated/server";
import { components, internal } from "./_generated/api";

const APP_NAME = "ChewnPour";
const APP_URL = "https://chewnpour.com";
const RESEARCH_EMAIL_TYPE = "product_research";
const BETTER_AUTH_USER_CHUNK_SIZE = 100;
const MAX_EMAILS_PER_RUN = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const normalizeEmail = (value: unknown): string => {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!normalized || !EMAIL_PATTERN.test(normalized)) return "";
    return normalized;
};

const encode = (value: string) => encodeURIComponent(value);

const buildResearchUrl = (token: string, campaign: string, cohort: string) =>
    `${APP_URL}/research?token=${encode(token)}&campaign=${encode(campaign)}&cohort=${encode(cohort)}`;

const buildUnsubscribeUrl = (token: string) =>
    `${APP_URL}/unsubscribe?token=${encode(token)}&type=product_research`;

const researchInviteTemplate = (
    displayName: string,
    researchUrl: string,
    unsubscribeUrl: string,
) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${APP_NAME}</title>
<style>
  body { margin:0; padding:0; background:#f5f7fb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .container { max-width:560px; margin:24px auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
  .header { padding:24px; background:#111827; color:#ffffff; }
  .body { padding:24px; color:#1f2937; line-height:1.6; font-size:15px; }
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
      <p>We are improving ${APP_NAME} and want direct input from people actively using it.</p>
      <p>Could you share how you use the app and what you want to see next? It takes under 1 minute.</p>
      <a class="cta" href="${researchUrl}">Share Feedback</a>
    </div>
    <div class="footer">
      <p>You received this because product research emails are enabled on your account.</p>
      <p><a href="${unsubscribeUrl}">Unsubscribe</a> from product research emails.</p>
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
        console.warn("[productResearch] RESEND_API_KEY not set -- skipping outreach send.");
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
            console.error("[productResearch] Resend API error", {
                status: response.status,
                body: body.slice(0, 500),
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error("[productResearch] Failed to send outreach email", {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};

const fetchAuthUsersByIds = async (ctx: any, userIds: string[]) => {
    const normalizedIds = Array.from(
        new Set(
            userIds
                .map((userId) => String(userId || "").trim())
                .filter(Boolean),
        ),
    );
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
            const id = String(authUser?.id || "").trim();
            if (id) {
                usersById.set(id, authUser);
            }
        }
    }

    return normalizedIds
        .map((id) => usersById.get(id))
        .filter((user): user is NonNullable<typeof user> => Boolean(user));
};

export const sendOutreachEmails = internalAction({
    args: {},
    handler: async (ctx) => {
        const candidates: any[] = await ctx.runQuery(internal.productResearch.getOutreachCandidates, {
            limit: MAX_EMAILS_PER_RUN * 2,
        });
        if (candidates.length === 0) {
            return { processed: 0, sent: 0, skipped: 0 };
        }

        const authUsers = await fetchAuthUsersByIds(
            ctx,
            candidates.map((candidate) => String(candidate.userId || "")),
        );
        const authUsersById = new Map(
            authUsers.map((user) => [String(user.id || "").trim(), user]),
        );

        let processed = 0;
        let sent = 0;
        let skipped = 0;
        let skippedNoEmail = 0;
        let skippedToken = 0;

        for (const candidate of candidates) {
            if (sent >= MAX_EMAILS_PER_RUN) break;

            const userId = String(candidate.userId || "").trim();
            if (!userId) {
                skipped += 1;
                continue;
            }
            processed += 1;

            const authUser = authUsersById.get(userId);
            const email = normalizeEmail(authUser?.email);
            if (!email) {
                skipped += 1;
                skippedNoEmail += 1;
                continue;
            }

            const tokenFromCandidate = String(candidate.productResearchToken || "").trim();
            const token = tokenFromCandidate
                || await ctx.runMutation(internal.productResearch.ensureProductResearchToken, { userId });
            if (!token) {
                skipped += 1;
                skippedToken += 1;
                continue;
            }

            const unsubscribeToken = await ctx.runMutation(internal.emailHelpers.ensureUnsubscribeToken, { userId });
            if (!unsubscribeToken) {
                skipped += 1;
                continue;
            }

            const campaign = String(candidate.campaign || "product_research_v1").trim() || "product_research_v1";
            const cohort = String(candidate.cohort || "general").trim() || "general";
            const researchUrl = buildResearchUrl(token, campaign, cohort);
            const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
            const displayName =
                String(candidate.fullName || authUser?.name || email.split("@")[0] || "there").trim() || "there";

            const html = researchInviteTemplate(displayName, researchUrl, unsubscribeUrl);
            const ok = await sendEmailViaResend({
                to: email,
                subject: "Quick question: how are you using ChewnPour?",
                html,
            });
            if (!ok) {
                skipped += 1;
                continue;
            }

            await ctx.runMutation(internal.emailHelpers.logEmailSent, {
                userId,
                emailType: RESEARCH_EMAIL_TYPE,
            });
            sent += 1;
        }

        console.log("[productResearch] outreach run complete", {
            candidates: candidates.length,
            processed,
            sent,
            skipped,
            skippedNoEmail,
            skippedToken,
        });
        return {
            candidates: candidates.length,
            processed,
            sent,
            skipped,
            skippedNoEmail,
            skippedToken,
        };
    },
});
