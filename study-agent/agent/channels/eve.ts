import {
  extractBearerToken,
  localDev,
  type AuthFn,
  vercelOidc,
  verifyJwtHmac,
} from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";

const ISSUER = "chewnpour";
const AUDIENCE = "study-worker";

const PERSONA_PROMPTS: Record<string, string> = {
  coach:
    "Adopt the voice of an encouraging exam coach. Be direct, practical, and focused on helping the student improve quickly.",
  socratic:
    "Adopt the voice of a Socratic tutor. Lead with 1-2 short guiding questions before explaining.",
  patient:
    "Adopt the voice of a patient explainer. Use simple language, short sentences, and step-by-step teaching.",
  concise:
    "Adopt the voice of a concise tutor. Keep answers compact, clear, and high-signal.",
};

const BROWSER_ORIGINS = [
  "https://www.chewnpour.com",
  "https://chewnpour.com",
  "https://staging.chewnpour.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

const asString = (value: unknown) => String(value || "").trim();

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
};

const jwtSecret = () =>
  String(process.env.STUDY_WORKER_JWT_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();

const studyWorkerAuth = (): AuthFn<Request> => {
  return async (request) => {
    const secret = jwtSecret();
    if (!secret) return null;
    const token = extractBearerToken(request.headers.get("authorization"));
    const result = await verifyJwtHmac(token, {
      algorithm: "HS256",
      issuer: ISSUER,
      audiences: [AUDIENCE],
      secret,
    });
    if (!result.ok || !token) return null;

    const payload = decodeJwtPayload(token);
    const topicId =
      asString(request.headers.get("x-chewnpour-topic-id")) ||
      asString(payload.topicId);
    const courseId =
      asString(request.headers.get("x-chewnpour-course-id")) ||
      asString(payload.courseId);
    const persona = asString(payload.persona) || "coach";

    return {
      authenticator: "chewnpour",
      principalId: result.sessionAuth.principalId,
      principalType: "user",
      issuer: ISSUER,
      attributes: {
        ...result.sessionAuth.attributes,
        topicId,
        courseId,
        persona,
      },
    };
  };
};

export default eveChannel({
  auth: [studyWorkerAuth(), vercelOidc(), localDev()],
  cors: {
    origin: BROWSER_ORIGINS,
    methods: ["GET", "POST"],
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-chewnpour-topic-id",
      "x-chewnpour-course-id",
    ],
  },
  onMessage(ctx) {
    const caller = ctx.eve.caller;
    const topicId = asString(caller?.attributes?.topicId);
    const persona = asString(caller?.attributes?.persona) || "coach";
    const personaPrompt = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.coach;
    return {
      auth: defaultEveAuth(ctx),
      context: [
        `ChewnPour lesson id: ${topicId || "unknown"}. Stay inside this student's materials.`,
        personaPrompt,
      ],
    };
  },
});
