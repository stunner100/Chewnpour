import { httpRouter } from "convex/server";
import { authComponent } from "./auth";
import { createAuth } from "./authConfig";
import { streamTopicVoiceHttp } from "./voiceHttp";

const http = httpRouter();

// Vite picks the next free port when 5173 is taken, so a fixed short list
// silently breaks local auth (CORS) the moment a second dev server is running.
// Cover the whole range Vite hands out for both localhost and 127.0.0.1.
const LOCAL_DEV_PORT_START = 5173;
const LOCAL_DEV_PORT_END = 5199;
const buildLocalDevOrigins = () => {
    const origins: string[] = [];
    for (let port = LOCAL_DEV_PORT_START; port <= LOCAL_DEV_PORT_END; port += 1) {
        origins.push(`http://localhost:${port}`);
        origins.push(`http://127.0.0.1:${port}`);
    }
    return origins;
};

const AUTH_CORS_ALLOWED_ORIGINS = [
    "https://www.chewnpour.com",
    "https://chewnpour.com",
    "https://staging.chewnpour.com",
    "https://stitch-app-git-staging-stunner100s-projects.vercel.app",
    ...buildLocalDevOrigins(),
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
