// Origins Better Auth trusts for CSRF checks and redirect targets
// (callbackURL, password-reset redirectTo).
//
// Never trust *.vercel.app or any origin taken from the request: vercel.app is
// shared hosting, so anyone could host a page there and receive reset tokens.
// Preview deployments are trusted only through their own system env vars.

export const LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
];

export const PRODUCTION_ORIGINS = [
    "https://www.chewnpour.com",
    "https://chewnpour.com",
    "https://staging.chewnpour.com",
];

export const normalizeOrigin = (value) => {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const hostToOrigin = (host) => {
    const value = String(host || "").trim();
    if (!value) return null;
    return normalizeOrigin(/^https?:\/\//.test(value) ? value : `https://${value}`);
};

export const buildTrustedOrigins = (env = process.env) => {
    const configured = [
        env.APP_BASE_URL,
        env.FRONTEND_URL,
        ...String(env.FRONTEND_URLS || "")
            .split(",")
            .map((value) => value.trim()),
    ].map(normalizeOrigin);

    // This deployment's own URLs (set by Vercel at runtime).
    const deployment = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].map(hostToOrigin);

    return Array.from(
        new Set(
            [...LOCAL_ORIGINS, ...PRODUCTION_ORIGINS, ...configured, ...deployment].filter(Boolean),
        ),
    );
};
