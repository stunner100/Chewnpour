-- Eve study-worker durable sessions, bound to the student who initiated them so
-- the worker can reject cross-user session follow-ups at the HTTP boundary.
CREATE TABLE IF NOT EXISTS "study_worker_sessions" (
  "session_id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "study_worker_sessions_by_user"
  ON "study_worker_sessions" ("user_id");

ALTER TABLE "study_worker_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "study_worker_sessions" FROM anon, authenticated;
