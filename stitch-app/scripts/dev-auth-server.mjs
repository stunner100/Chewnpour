import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { toNodeHandler } from "better-auth/node";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, "..");

loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

if (!process.env.BETTER_AUTH_URL) {
    process.env.BETTER_AUTH_URL = "http://localhost:5173";
}

const { auth } = await import(pathToFileURL(path.join(root, "server", "auth.js")).href);
const { handleProfileRequest } = await import(
    pathToFileURL(path.join(root, "server", "profileHttp.js")).href
);
const { handleUploadsRequest } = await import(
    pathToFileURL(path.join(root, "server", "uploadHttp.js")).href
);
const { handleCoursesRequest, handleTopicsRequest, handleQuizAttemptsRequest, handleShareRequest } = await import(
    pathToFileURL(path.join(root, "server", "courseHttp.js")).href
);
const { handleBillingRequest } = await import(
    pathToFileURL(path.join(root, "server", "billingHttp.js")).href
);
const { handleProgressRequest } = await import(
    pathToFileURL(path.join(root, "server", "progressHttp.js")).href
);
const authHandler = toNodeHandler(auth);

const port = Number(process.env.AUTH_DEV_PORT || 8787);

const server = http.createServer((req, res) => {
    const url = req.url || "";
    if (url.startsWith("/api/profile")) {
        return handleProfileRequest(req, res);
    }
    if (url.startsWith("/api/uploads")) {
        return handleUploadsRequest(req, res);
    }
    if (url.startsWith("/api/courses")) {
        return handleCoursesRequest(req, res);
    }
    if (url.startsWith("/api/share")) {
        return handleShareRequest(req, res);
    }
    if (url.startsWith("/api/topics")) {
        return handleTopicsRequest(req, res);
    }
    if (url.startsWith("/api/quiz-attempts")) {
        return handleQuizAttemptsRequest(req, res);
    }
    if (url.startsWith("/api/billing")) {
        return handleBillingRequest(req, res);
    }
    if (url.startsWith("/api/progress")) {
        return handleProgressRequest(req, res);
    }
    if (url.startsWith("/api/auth")) {
        return authHandler(req, res);
    }
    res.statusCode = 404;
    res.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
    console.log(
        `[dev-auth] listening on http://127.0.0.1:${port} (/api/auth, /api/profile, /api/uploads, /api/courses, /api/topics, /api/quiz-attempts, /api/billing, /api/progress)`,
    );
});
