import { betterAuth } from "better-auth";
import { authComponent } from "./auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { sendEmail } from "./lib/emailSender";

// The frontend URL - where users should be redirected after auth
// In development, this is localhost; in production, this should be your app URL
const resolveFrontendUrl = () => {
    const configuredUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL;
    if (!configuredUrl) return "http://localhost:5173";
    try {
        return new URL(configuredUrl).origin;
    } catch {
        return "http://localhost:5173";
    }
};

const frontendUrl = resolveFrontendUrl();

const LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:5179",
    "http://localhost:5180",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
    "http://127.0.0.1:5177",
    "http://127.0.0.1:5178",
    "http://127.0.0.1:5179",
    "http://127.0.0.1:5180",
];

const PREVIEW_HOST_SUFFIXES = [".vercel.app"];
const PREVIEW_TRUSTED_PATTERNS = ["https://*.vercel.app"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const parseConfiguredFrontendOrigins = () => {
    const values = [
        process.env.APP_BASE_URL,
        process.env.FRONTEND_URL,
        ...(process.env.FRONTEND_URLS || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    ];

    const origins = values
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value));

    return Array.from(new Set(origins));
};

const normalizeOrigin = (value: string | null | undefined) => {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const isAllowedPreviewOrigin = (origin: string) => {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== "https:") return false;
        return PREVIEW_HOST_SUFFIXES.some((suffix) =>
            parsed.hostname === suffix.slice(1) || parsed.hostname.endsWith(suffix)
        );
    } catch {
        return false;
    }
};

const isLocalhostOrigin = (origin: string) => {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
        return LOCAL_HOSTS.has(parsed.hostname);
    } catch {
        return false;
    }
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const buildPasswordResetEmail = (params: { name: string; url: string }) => {
    const safeName = escapeHtml(params.name || "there");
    const safeUrl = escapeHtml(params.url);

    return {
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Reset your ChewnPour password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:28px 24px;background:#111827;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;line-height:1.2;">Reset your ChewnPour password</h1>
    </div>
    <div style="padding:28px 24px;color:#1f2937;font-size:15px;line-height:1.6;">
      <p>Hi ${safeName},</p>
      <p>Use the button below to set a new password for your ChewnPour account.</p>
      <p style="margin:28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;">Reset password</a>
      </p>
      <p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
    </div>
    <div style="padding:16px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;">If the button does not work, paste this link into your browser:</p>
      <p style="word-break:break-all;margin:8px 0 0;"><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
    </div>
  </div>
</body>
</html>`,
        text: [
            `Hi ${params.name || "there"},`,
            "",
            "Use this link to reset your ChewnPour password:",
            params.url,
            "",
            "This link expires in 1 hour. If you did not request a password reset, you can ignore this email.",
        ].join("\n"),
    };
};

const buildSignupWelcomeEmail = (params: { name: string }) => {
    const safeName = escapeHtml(params.name || "there");
    const dashboardUrl = `${frontendUrl}/dashboard`;
    const safeDashboardUrl = escapeHtml(dashboardUrl);

    return {
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Welcome to ChewnPour</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:28px 24px;background:#111827;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;line-height:1.2;">Welcome to ChewnPour</h1>
    </div>
    <div style="padding:28px 24px;color:#1f2937;font-size:15px;line-height:1.6;">
      <p>Hi ${safeName},</p>
      <p>Your ChewnPour workspace is ready. Upload your study material to generate lessons, quizzes, flashcards, podcasts, and tutor help from your own files.</p>
      <p style="margin:28px 0;">
        <a href="${safeDashboardUrl}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;">Open your workspace</a>
      </p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
        text: [
            `Hi ${params.name || "there"},`,
            "",
            "Your ChewnPour workspace is ready.",
            "Upload your study material to generate lessons, quizzes, flashcards, podcasts, and tutor help from your own files.",
            "",
            `Open your workspace: ${dashboardUrl}`,
            "",
            "If you did not create this account, you can ignore this email.",
        ].join("\n"),
    };
};

// Create the Better Auth instance for request handling
export const createAuth = (ctx: any) =>
    betterAuth({
        database: authComponent.adapter(ctx),
        secret: process.env.BETTER_AUTH_SECRET,
        databaseHooks: {
            user: {
                create: {
                    async after(user) {
                        const email = String(user?.email || "").trim();
                        if (!email) return;
                        const name = String(user?.name || email.split("@")[0] || "there").trim();
                        const { html, text } = buildSignupWelcomeEmail({ name });
                        const sent = await sendEmail({
                            to: email,
                            subject: "Welcome to ChewnPour",
                            html,
                            text,
                            context: "authSignupWelcome",
                        });
                        if (!sent) {
                            console.warn("[authSignupWelcome] failed or skipped welcome email", {
                                userId: String(user?.id || ""),
                            });
                        }
                    },
                },
            },
        },
        emailAndPassword: {
            enabled: true,
            autoSignIn: true,
            sendResetPassword: async ({ user, url }) => {
                const email = String(user.email || "").trim();
                const name = String(user.name || email.split("@")[0] || "there").trim();
                const { html, text } = buildPasswordResetEmail({ name, url });
                const sent = await sendEmail({
                    to: email,
                    subject: "Reset your ChewnPour password",
                    html,
                    text,
                    context: "authPasswordReset",
                });
                if (!sent) {
                    throw new Error("PASSWORD_RESET_EMAIL_FAILED");
                }
            },
            resetPasswordTokenExpiresIn: 60 * 60 * 1, // 1 hour
            revokeSessionsOnPasswordReset: true,
        },
        socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                google: {
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                },
            }
            : (() => {
                console.log('[Auth Config] Google OAuth not configured:', {
                    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
                    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
                });
                return undefined;
            })(),
        session: {
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            updateAge: 60 * 60 * 24, // 1 day
        },
        trustedOrigins: async (request) => {
            const dynamicOrigin = normalizeOrigin(
                request?.headers.get("origin") ||
                request?.headers.get("referer")
            );
            const configuredFrontends = parseConfiguredFrontendOrigins();

            const origins = [...LOCAL_ORIGINS, ...PREVIEW_TRUSTED_PATTERNS, ...configuredFrontends];
            if (
                dynamicOrigin &&
                (
                    isLocalhostOrigin(dynamicOrigin) ||
                    configuredFrontends.includes(dynamicOrigin) ||
                    isAllowedPreviewOrigin(dynamicOrigin)
                )
            ) {
                origins.push(dynamicOrigin);
            }
            return Array.from(new Set(origins));
        },
        plugins: [
            crossDomain({ siteUrl: frontendUrl }),
            convex({
                authConfig,
                jwksRotateOnTokenGenerationError: true,
            }),
        ],
    });
