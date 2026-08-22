import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import {
    GOOGLE_OAUTH_START_PATH,
    buildGoogleContinueHtml,
    copySetCookieHeaders,
    getAuthBaseUrl,
    isGoogleAuthorizationUrl,
    loginErrorLocation,
    sanitizeCallbackPath,
} from "./googleOAuthStartUtils.js";

const redirectToLogin = (res, authBaseUrl, errorCode) => {
    res.statusCode = 302;
    res.setHeader("Location", loginErrorLocation(authBaseUrl, errorCode));
    res.setHeader("Cache-Control", "no-store");
    res.end();
};

export const handleGoogleOAuthStart = async (req, res) => {
    const authBaseUrl = getAuthBaseUrl(req);
    const method = String(req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD");
        res.setHeader("Cache-Control", "no-store");
        res.end("Method not allowed");
        return;
    }

    const incoming = new URL(req.url || GOOGLE_OAUTH_START_PATH, "http://localhost");
    const callbackPath = sanitizeCallbackPath(incoming.searchParams.get("callbackURL"));
    const callbackURL = `${authBaseUrl}${callbackPath}`;
    const errorCallbackURL = `${authBaseUrl}/login`;
    const requestOrigin = new URL(authBaseUrl).origin;

    const requestHeaders = fromNodeHeaders(req.headers);
    requestHeaders.delete("content-length");
    requestHeaders.delete("transfer-encoding");
    requestHeaders.set("content-type", "application/json");
    requestHeaders.set("accept", "application/json");
    requestHeaders.set("origin", requestOrigin);

    const baRequest = new Request(`${authBaseUrl}/api/auth/sign-in/social`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify({
            provider: "google",
            callbackURL,
            errorCallbackURL,
            disableRedirect: true,
        }),
    });

    let baResponse;
    try {
        baResponse = await auth.handler(baRequest);
    } catch (error) {
        console.warn("[auth] google-start failed to create Google authorization URL", {
            message: error?.message || String(error),
        });
        return redirectToLogin(res, authBaseUrl, "please_restart_the_process");
    }

    copySetCookieHeaders(baResponse.headers, res);

    if (!baResponse.ok) {
        let errorCode = "please_restart_the_process";
        try {
            const payload = await baResponse.json();
            const message = String(payload?.message || payload?.error || "").toLowerCase();
            if (message.includes("provider")) errorCode = "oauth_provider_not_found";
        } catch {
            void 0;
        }
        return redirectToLogin(res, authBaseUrl, errorCode);
    }

    let payload = {};
    try {
        payload = await baResponse.json();
    } catch (error) {
        console.warn("[auth] google-start returned a non-JSON body", {
            message: error?.message || String(error),
        });
        return redirectToLogin(res, authBaseUrl, "please_restart_the_process");
    }

    const googleUrl = typeof payload?.url === "string" ? payload.url : "";
    if (!isGoogleAuthorizationUrl(googleUrl)) {
        console.warn("[auth] google-start did not return a Google authorization URL");
        return redirectToLogin(res, authBaseUrl, "please_restart_the_process");
    }

    if (method === "HEAD") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end();
        return;
    }

    const html = buildGoogleContinueHtml(googleUrl);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
};
