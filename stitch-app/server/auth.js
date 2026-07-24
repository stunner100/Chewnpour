import { betterAuth } from "better-auth";
import { getPool } from "./db.js";
import { ensureProfile } from "./profiles.js";
import { ensureBillingAccount } from "./billing.js";

const LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
];

const PRODUCTION_ORIGINS = [
    "https://www.chewnpour.com",
    "https://chewnpour.com",
    "https://staging.chewnpour.com",
];

const normalizeOrigin = (value) => {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const parseConfiguredFrontendOrigins = () => {
    const values = [
        process.env.APP_BASE_URL,
        process.env.FRONTEND_URL,
        ...(process.env.FRONTEND_URLS || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    ];

    return Array.from(
        new Set(
            values
                .map((value) => normalizeOrigin(value))
                .filter(Boolean),
        ),
    );
};

const googleConfigured =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);

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
        autoSignIn: true,
    },
    socialProviders: googleConfigured
        ? {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
        }
        : undefined,
    trustedOrigins: async (request) => {
        const dynamicOrigin = normalizeOrigin(
            request?.headers.get("origin") ||
            request?.headers.get("referer"),
        );
        const configuredFrontends = parseConfiguredFrontendOrigins();
        const origins = [
            ...LOCAL_ORIGINS,
            ...PRODUCTION_ORIGINS,
            ...configuredFrontends,
        ];

        if (
            dynamicOrigin &&
            (
                LOCAL_ORIGINS.includes(dynamicOrigin) ||
                PRODUCTION_ORIGINS.includes(dynamicOrigin) ||
                configuredFrontends.includes(dynamicOrigin) ||
                dynamicOrigin.endsWith(".vercel.app")
            )
        ) {
            origins.push(dynamicOrigin);
        }

        return Array.from(new Set(origins));
    },
});
