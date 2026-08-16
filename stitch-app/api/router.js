import { toNodeHandler } from "better-auth/node";
import { auth } from "../server/auth.js";
import { handleAdminRequest } from "../server/adminHttp.js";
import { handleBillingRequest } from "../server/billingHttp.js";
import {
    handleCoursesRequest,
    handleQuizAttemptsRequest,
    handleShareRequest,
    handleTopicsRequest,
} from "../server/courseHttp.js";
import { handleExamsRequest } from "../server/examHttp.js";
import { handlePodcastsRequest } from "../server/podcastHttp.js";
import { handleProfileRequest } from "../server/profileHttp.js";
import { handleProgressRequest } from "../server/progressHttp.js";
import { handleUploadsRequest } from "../server/uploadHttp.js";

// Better Auth must parse the raw body itself.
// Include anydoc NAPI binaries — file tracing often skips optionalDependencies.
export const config = {
    api: {
        bodyParser: false,
    },
    // OCR.space + anydoc finalize can exceed the default serverless limit.
    maxDuration: 300,
    includeFiles: [
        "node_modules/@firecrawl/anydoc/**",
        "node_modules/@firecrawl/anydoc-linux-x64-gnu/**",
        "node_modules/@firecrawl/anydoc-linux-arm64-gnu/**",
        "node_modules/@firecrawl/anydoc-linux-x64-musl/**",
        "node_modules/@firecrawl/anydoc-linux-arm64-musl/**",
    ],
};

const authHandler = toNodeHandler(auth);

const restoreOriginalUrl = (req) => {
    const current = String(req.url || "/");
    const url = new URL(current, "http://localhost");
    const encoded = url.searchParams.get("__path");
    if (!encoded) return;

    url.searchParams.delete("__path");
    const qs = url.searchParams.toString();
    req.url = `/api/${encoded}${qs ? `?${qs}` : ""}`;
};

/**
 * Single API entrypoint. Vercel Hobby / non-Next catch-alls only reliably match
 * one path segment, so multi-segment routes (/api/auth/sign-in/social) are
 * rewritten here via vercel.json.
 */
export default async function handler(req, res) {
    restoreOriginalUrl(req);
    const pathname = String(req.url || "").split("?")[0];

    if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
        return authHandler(req, res);
    }
    if (pathname === "/api/profile" || pathname.startsWith("/api/profile/")) {
        return handleProfileRequest(req, res);
    }
    if (pathname === "/api/uploads" || pathname.startsWith("/api/uploads/")) {
        return handleUploadsRequest(req, res);
    }
    if (pathname === "/api/courses" || pathname.startsWith("/api/courses/")) {
        return handleCoursesRequest(req, res);
    }
    if (pathname === "/api/share" || pathname.startsWith("/api/share/")) {
        return handleShareRequest(req, res);
    }
    if (pathname === "/api/exams" || pathname.startsWith("/api/exams/")) {
        return handleExamsRequest(req, res);
    }
    if (pathname === "/api/podcasts" || pathname.startsWith("/api/podcasts/")) {
        return handlePodcastsRequest(req, res);
    }
    if (pathname === "/api/topics" || pathname.startsWith("/api/topics/")) {
        return handleTopicsRequest(req, res);
    }
    if (
        pathname === "/api/quiz-attempts" ||
        pathname.startsWith("/api/quiz-attempts/")
    ) {
        return handleQuizAttemptsRequest(req, res);
    }
    if (pathname === "/api/billing" || pathname.startsWith("/api/billing/")) {
        return handleBillingRequest(req, res);
    }
    if (pathname === "/api/progress" || pathname.startsWith("/api/progress/")) {
        return handleProgressRequest(req, res);
    }
    if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
        return handleAdminRequest(req, res);
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Not found", path: pathname }));
}
