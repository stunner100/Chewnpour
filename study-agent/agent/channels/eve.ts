import {
  extractBearerToken,
  ForbiddenError,
  localDev,
  type AuthFn,
  vercelOidc,
  verifyJwtHmac,
} from "eve/channels/auth";
import { defaultEveAuth, eveChannel } from "eve/channels/eve";
import { getSessionOwner, recordSessionOwner } from "../lib/sessionOwnership";

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
  String(process.env.STUDY_WORKER_JWT_SECRET || "").trim();

// Session-scoped routes carry the durable session id in the path. The create
// route (`/eve/v1/session`) has none, so it never matches here.
const extractSessionIdFromUrl = (url: string): string | null => {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/eve\/v1\/session\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

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

    const principalId = result.sessionAuth.principalId;

    // Eve does not bind a durable session to its initiating principal, so
    // without this check any caller holding their own valid token could
    // continue (and read the history of) another student's session.
    const sessionId = extractSessionIdFromUrl(request.url);
    if (sessionId) {
      const owner = await getSessionOwner(sessionId);
      if (owner && owner !== principalId) {
        throw new ForbiddenError({
          message: "This study session belongs to another student.",
        });
      }
    }

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
      principalId,
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
      "x-eve-session-id",
      "x-eve-stream-format",
      "x-eve-stream-tail-index",
      "x-eve-stream-version",
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
  events: {
    async "turn.started"(_data, _channel, ctx) {
      const sessionId = ctx.session.id;
      const initiator = ctx.session.auth.initiator;
      if (!sessionId || !initiator || initiator.principalType !== "user") return;
      await recordSessionOwner(sessionId, initiator.principalId);
    },
  },
});
