-- One row per minted live tutor (Gemini Live) session: enforces per-student
-- session limits and records usage for the admin dashboard.
CREATE TABLE IF NOT EXISTS "live_tutor_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "topic_id" TEXT REFERENCES "topics"("id") ON DELETE SET NULL,
  "model" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ended_at" TIMESTAMPTZ,
  "outcome" TEXT,
  "answered" INTEGER
);

CREATE INDEX IF NOT EXISTS "live_tutor_sessions_by_user_created"
  ON "live_tutor_sessions" ("user_id", "created_at" DESC);

ALTER TABLE "live_tutor_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "live_tutor_sessions" FROM anon, authenticated;
