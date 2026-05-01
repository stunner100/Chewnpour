import { httpRouter } from "convex/server";
import { authComponent } from "./auth";
import { createAuth } from "./authConfig";
import { streamTopicVoiceHttp } from "./voiceHttp";

const http = httpRouter();
const AUTH_CORS_ALLOWED_ORIGINS = [
    "https://www.chewnpour.com",
    "https://chewnpour.com",
    "https://staging.chewnpour.com",
    "https://stitch-app-git-staging-stunner100s-projects.vercel.app",
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

// Register Better Auth routes with CORS enabled
// The allowedOrigins here are appended to trustedOrigins from authConfig.ts
authComponent.registerRoutes(http, createAuth, {
    cors: {
        allowedOrigins: AUTH_CORS_ALLOWED_ORIGINS,
    },
});

http.route({
    path: "/voice/stream",
    method: "GET",
    handler: streamTopicVoiceHttp,
});

export default http;
