import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { processGenerationJob } from "../server/generationJobs.js";

// Background lesson-generation worker (server/generationJobs.js). Called by
// the app itself (kickGenerationWorker) with GENERATION_WORKER_SECRET, so
// each job run gets a fresh function and time limit. It answers 202 at once
// and keeps working through waitUntil.
export const config = {
    api: {
        bodyParser: false,
    },
    maxDuration: 300,
};

const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    return raw ? JSON.parse(raw) : {};
};

const authorized = (req) => {
    const secret = String(process.env.GENERATION_WORKER_SECRET || "").trim();
    const header = String(req.headers?.authorization || "");
    if (!secret || !header.startsWith("Bearer ")) return false;
    const given = Buffer.from(header.slice("Bearer ".length));
    const expected = Buffer.from(secret);
    return given.length === expected.length && timingSafeEqual(given, expected);
};

export default async function handler(req, res) {
    if (String(req.method || "GET").toUpperCase() !== "POST") {
        res.setHeader("Allow", "POST");
        return sendJson(res, 405, { error: "Method not allowed" });
    }
    if (!authorized(req)) {
        return sendJson(res, 401, { error: "Unauthorized" });
    }
    let body;
    try {
        body = await readJsonBody(req);
    } catch {
        return sendJson(res, 400, { error: "Invalid JSON" });
    }
    const jobId = typeof body?.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : null;
    waitUntil(processGenerationJob({ jobId }).catch((error) => {
        console.error("[api/generation-worker]", { jobId, message: error?.message || String(error) });
    }));
    return sendJson(res, 202, { accepted: true, jobId });
}
