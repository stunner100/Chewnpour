import { betterAuth } from "better-auth";
import { getPool } from "./db.js";
import { ensureProfile } from "./profiles.js";
import { ensureBillingAccount } from "./billing.js";
import { isResendConfigured, sendPasswordResetEmail } from "./email.js";
import { buildTrustedOrigins } from "./authOrigins.js";

const googleConfigured =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);

const oauthErrorURL = (() => {
    const base = String(process.env.BETTER_AUTH_URL || "").trim().replace(/\/$/, "");
    return base ? `${base}/login` : "/login";
})();

export const auth = betterAuth({
    database: getPool(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    // Existing Postgres migration uses snake_case columns.
    user: {
        fields: {
            emailVerified: "email_verified",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
            ipAddress: "ip_address",
            userAgent: "user_agent",
            userId: "user_id",
        },
    },
    account: {
        fields: {
            accountId: "account_id",
            providerId: "provider_id",
            userId: "user_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            idToken: "id_token",
            accessTokenExpiresAt: "access_token_expires_at",
            refreshTokenExpiresAt: "refresh_token_expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
        storeStateStrategy: "database",
        // WebKit bounce tracking can drop the OAuth state cookie on return from
        // Google. State still has to match a verification row in Postgres.
        skipStateCookieCheck: true,
    },
    onAPIError: {
        errorURL: oauthErrorURL,
    },
    verification: {
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    databaseHooks: {
        user: {
            create: {
                async after(user) {
                    try {
                        await ensureProfile({
                            userId: String(user.id),
                            fullName: String(user.name || "").trim(),
                            avatarUrl: user.image || null,
                        });
                    } catch (error) {
                        console.warn("[auth] failed to create profile after signup", {
                            userId: String(user?.id || ""),
                            message: error?.message || String(error),
                        });
                    }
                    try {
                        await ensureBillingAccount(String(user.id));
                    } catch (error) {
                        console.warn("[auth] failed to create billing account after signup", {
                            userId: String(user?.id || ""),
                            message: error?.message || String(error),
                        });
                    }
                },
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        autoSignIn: true,
        resetPasswordTokenExpiresIn: 3600,
        sendResetPassword: async ({ user, url }) => {
            if (!isResendConfigured()) {
                console.warn("[auth] password reset requested but Resend is not configured");
                return;
            }
            // Do not await — avoids timing attacks and keeps auth response snappy.
            void sendPasswordResetEmail({
                to: user.email,
                url,
                userName: user.name,
            }).catch((error) => {
                console.warn("[auth] failed to send reset password email", {
                    email: user?.email,
                    message: error?.message || String(error),
                });
            });
        },
    },
    socialProviders: googleConfigured
        ? {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
        }
        : undefined,
    trustedOrigins: buildTrustedOrigins(),
});
