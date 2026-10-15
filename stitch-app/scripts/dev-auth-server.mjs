import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, "..");

// DEV_ENV_FILE (e.g. .env.localdb) loads first so it wins over .env.local;
// dotenv never overrides a variable that is already set.
if (process.env.DEV_ENV_FILE) {
    loadEnv({ path: path.resolve(root, process.env.DEV_ENV_FILE) });
}
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

if (!process.env.BETTER_AUTH_URL) {
    process.env.BETTER_AUTH_URL = "http://localhost:5173";
}

const importApi = async (file) =>
    (await import(pathToFileURL(path.join(root, "api", file)).href)).default;

// Mirror production: vercel.json sends every /api/* path to api/router.js,
// except these standalone functions.
const router = await importApi("router.js");
const standalone = {
    "/api/topic-voice": await importApi("topic-voice.js"),
    "/api/podcast-generate": await importApi("podcast-generate.js"),
    "/api/paystack-webhook": await importApi("paystack-webhook.js"),
    "/api/sentry-tunnel": await importApi("sentry-tunnel.js"),
};

const port = Number(process.env.AUTH_DEV_PORT || 8787);

const server = http.createServer((req, res) => {
    const pathname = String(req.url || "").split("?")[0];
    const handler = standalone[pathname] || router;
    Promise.resolve(handler(req, res)).catch((error) => {
        console.error("[dev-api]", pathname, error);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.end("Internal error");
        }
    });
});

server.listen(port, "127.0.0.1", () => {
    console.log(
        `[dev-api] listening on http://127.0.0.1:${port} (all /api routes via api/router.js)`,
    );
});
