import process from "node:process";

export const GOOGLE_OAUTH_START_PATH = "/api/auth/google-start";
const DEFAULT_CALLBACK_PATH = "/dashboard";
const MAX_CALLBACK_PATH_LENGTH = 2048;
const GOOGLE_AUTHORIZE_ORIGIN = "https://accounts.google.com";

const TRUSTED_CALLBACK_ORIGINS = new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "https://www.chewnpour.com",
    "https://chewnpour.com",
    "https://staging.chewnpour.com",
]);

const firstHeaderValue = (value) => {
    if (Array.isArray(value)) return String(value[0] || "").trim();
    return String(value || "").trim();
};

const originFromEnvValue = (value) => {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

export const getAuthBaseUrl = (req) => {
    const configured = String(process.env.BETTER_AUTH_URL || "").trim().replace(/\/$/, "");
    if (configured) return configured;

    const host = firstHeaderValue(req?.headers?.["x-forwarded-host"])
        || firstHeaderValue(req?.headers?.host);
    if (!host) return "http://localhost:5173";

    const forwardedProto = firstHeaderValue(req?.headers?.["x-forwarded-proto"]).split(",")[0];
    const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const proto = forwardedProto === "http" || isLocal ? "http" : "https";
    return `${proto}://${host}`;
};

const extraTrustedOrigins = () => {
    const origins = [
        originFromEnvValue(process.env.BETTER_AUTH_URL),
        originFromEnvValue(process.env.APP_BASE_URL),
        originFromEnvValue(process.env.FRONTEND_URL),
        ...(process.env.FRONTEND_URLS || "")
            .split(",")
            .map((value) => originFromEnvValue(value.trim()))
            .filter(Boolean),
    ].filter(Boolean);
    return new Set(origins);
};

const isTrustedCallbackOrigin = (origin) => {
    if (!origin) return false;
    if (TRUSTED_CALLBACK_ORIGINS.has(origin)) return true;
    if (origin.endsWith(".vercel.app")) return true;
    return extraTrustedOrigins().has(origin);
};

const isSafeRelativeCallbackPath = (value) => {
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
        return false;
    }
    if (value.length > MAX_CALLBACK_PATH_LENGTH) return false;
    if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(value.slice(1))) return false;
    return true;
};

export const sanitizeCallbackPath = (raw) => {
    if (typeof raw !== "string") return DEFAULT_CALLBACK_PATH;
    const trimmed = raw.trim();
    if (!trimmed) return DEFAULT_CALLBACK_PATH;

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            if (!isTrustedCallbackOrigin(url.origin)) return DEFAULT_CALLBACK_PATH;
            const path = `${url.pathname}${url.search}${url.hash}` || "/";
            return isSafeRelativeCallbackPath(path) ? path : DEFAULT_CALLBACK_PATH;
        } catch {
            return DEFAULT_CALLBACK_PATH;
        }
    }

    return isSafeRelativeCallbackPath(trimmed) ? trimmed : DEFAULT_CALLBACK_PATH;
};

export const loginErrorLocation = (authBaseUrl, errorCode) => {
    const origin = String(authBaseUrl || "").replace(/\/$/, "");
    const query = `error=${encodeURIComponent(errorCode)}`;
    if (!/^https?:\/\//i.test(origin)) return `/login?${query}`;
    return `${origin}/login?${query}`;
};

export const isGoogleAuthorizationUrl = (value) => {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:" && url.origin === GOOGLE_AUTHORIZE_ORIGIN;
    } catch {
        return false;
    }
};

const escapeHtmlAttr = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

export const buildGoogleContinueHtml = (googleUrl) => {
    const href = escapeHtmlAttr(googleUrl);
    const jsUrl = JSON.stringify(googleUrl);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${href}">
  <title>Continue to Google</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fff; color: #0A0A0A; }
    a { color: #007AFF; font-weight: 600; }
    p { font-size: 15px; }
  </style>
</head>
<body>
  <p>Continuing to Google… <a href="${href}">Continue</a></p>
  <script>window.location.replace(${jsUrl});</script>
</body>
</html>`;
};

export const copySetCookieHeaders = (fromWebHeaders, res) => {
    if (!fromWebHeaders || !res) return;
    const cookies = [
        ...(typeof fromWebHeaders.getSetCookie === "function"
            ? fromWebHeaders.getSetCookie()
            : []),
    ];
    if (cookies.length === 0) {
        const single = fromWebHeaders.get?.("set-cookie");
        if (single) cookies.push(single);
    }
    for (const cookie of cookies) {
        if (!cookie) continue;
        if (typeof res.appendHeader === "function") {
            res.appendHeader("Set-Cookie", cookie);
            continue;
        }
        const current = res.getHeader("Set-Cookie");
        if (!current) {
            res.setHeader("Set-Cookie", cookie);
        } else if (Array.isArray(current)) {
            res.setHeader("Set-Cookie", [...current, cookie]);
        } else {
            res.setHeader("Set-Cookie", [current, cookie]);
        }
    }
};
