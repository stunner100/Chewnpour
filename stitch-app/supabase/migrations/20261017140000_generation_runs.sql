-- One row per model call: what it was for, which provider and model served
-- it, tokens, latency and how it ended. Used to see what a course costs and
-- which providers fail.
CREATE TABLE IF NOT EXISTS "generation_runs" (
  "id" TEXT PRIMARY KEY,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "purpose" TEXT NOT NULL,
  "label" TEXT,
  "user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "course_id" TEXT REFERENCES "courses"("id") ON DELETE SET NULL,
  "upload_id" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
  "topic_id" TEXT REFERENCES "topics"("id") ON DELETE SET NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  -- ok | truncated | http_error | empty | timeout | aborted | network_error
  "outcome" TEXT NOT NULL,
  "finish_reason" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "latency_ms" INTEGER NOT NULL,
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS "generation_runs_by_course" ON "generation_runs" ("course_id", "created_at");
CREATE INDEX IF NOT EXISTS "generation_runs_by_time" ON "generation_runs" ("created_at");

ALTER TABLE "generation_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "generation_runs" FROM anon, authenticated;
