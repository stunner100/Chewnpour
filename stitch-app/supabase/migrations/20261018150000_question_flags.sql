-- Students report a generated question that is wrong or unclear. One open
-- report per student per question; admins review and resolve them.
CREATE TABLE IF NOT EXISTS "question_flags" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "question_id")
);

CREATE INDEX IF NOT EXISTS "question_flags_open"
  ON "question_flags" ("created_at" DESC)
  WHERE "status" = 'open';

ALTER TABLE "question_flags" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "question_flags" FROM anon, authenticated;
