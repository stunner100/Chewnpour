import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const STUDY_WORKER_ISSUER = "chewnpour";
export const STUDY_WORKER_AUDIENCE = "study-worker";
export const STUDY_WORKER_TOKEN_TTL_SEC = 15 * 60;

const base64Url = (value) =>
    Buffer.from(value).toString("base64url");

export const getStudyWorkerJwtSecret = () =>
    String(process.env.STUDY_WORKER_JWT_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();

export const signStudyWorkerToken = ({
    userId,
    topicId,
    courseId,
    persona,
    ttlSec = STUDY_WORKER_TOKEN_TTL_SEC,
}) => {
    const secret = getStudyWorkerJwtSecret();
    if (!secret) {
        const error = new Error("Study worker is not configured.");
        error.status = 503;
        throw error;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: STUDY_WORKER_ISSUER,
        aud: STUDY_WORKER_AUDIENCE,
        sub: String(userId),
        topicId: String(topicId),
        courseId: String(courseId || ""),
        persona: String(persona || "coach"),
        iat: now,
        exp: now + Number(ttlSec),
    };

    const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64Url(JSON.stringify(payload));
    const data = `${header}.${body}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("base64url");

    return {
        token: `${data}.${signature}`,
        expiresAt: payload.exp * 1000,
        topicId: payload.topicId,
        courseId: payload.courseId,
        persona: payload.persona,
    };
};
