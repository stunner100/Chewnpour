import { betterAuth } from "better-auth";
import { authComponent } from "./auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";

// The frontend URL - where users should be redirected after auth
// In development, this is localhost; in production, this would be your app URL
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
];

const PREVIEW_HOST_SUFFIXES = [".vercel.app"];
const PREVIEW_TRUSTED_PATTERNS = ["https://*.vercel.app"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const parseConfiguredFrontendOrigins = () => {
    const values = [
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

// Create the Better Auth instance for request handling
export const createAuth = (ctx: any) =>
    betterAuth({
        database: authComponent.adapter(ctx),
        secret: process.env.BETTER_AUTH_SECRET,
        emailAndPassword: {
            enabled: true,
            autoSignIn: true,
            // Dev-only: log reset URL; replace with real email provider in production.
            sendResetPassword: async ({ user, url }) => {
                console.log(
                    `[better-auth] Password reset requested for ${user.email}.`
                );
                console.log(`[better-auth] Reset URL: ${url}`);
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
