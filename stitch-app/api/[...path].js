import { handleBillingRequest } from "../server/billingHttp.js";
import {
    handleCoursesRequest,
    handleQuizAttemptsRequest,
    handleTopicsRequest,
} from "../server/courseHttp.js";
import { handleProfileRequest } from "../server/profileHttp.js";
import { handleProgressRequest } from "../server/progressHttp.js";
import { handleUploadsRequest } from "../server/uploadHttp.js";

/**
 * Single catch-all for product APIs so Hobby stays under the 12-function limit.
 * Better Auth stays at api/auth/[...all].js; paystack + sentry keep dedicated files.
 */
export default async function handler(req, res) {
    const pathname = String(req.url || "").split("?")[0];

    if (pathname === "/api/profile" || pathname.startsWith("/api/profile/")) {
        return handleProfileRequest(req, res);
    }
    if (pathname === "/api/uploads" || pathname.startsWith("/api/uploads/")) {
        return handleUploadsRequest(req, res);
    }
    if (pathname === "/api/courses" || pathname.startsWith("/api/courses/")) {
        return handleCoursesRequest(req, res);
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

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Not found" }));
}
