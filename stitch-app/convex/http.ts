import { httpRouter } from "convex/server";
import { authComponent } from "./auth";
import { createAuth } from "./authConfig";

const http = httpRouter();

// Register Better Auth routes with CORS enabled
// The allowedOrigins here are appended to trustedOrigins from authConfig.ts
authComponent.registerRoutes(http, createAuth, {
    cors: {
        allowedOrigins: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ],
    },
});

export default http;
