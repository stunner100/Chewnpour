-- Topic notes + study progress (greenfield cutover from Convex)
CREATE TABLE IF NOT EXISTS "topic_notes" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "topic_id")
);

CREATE INDEX IF NOT EXISTS "topic_notes_by_user_updated"
  ON "topic_notes" ("user_id", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "topic_progress" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "course_id" TEXT REFERENCES "courses"("id") ON DELETE SET NULL,
  "completed_at" TIMESTAMPTZ,
  "last_studied_at" TIMESTAMPTZ,
  "terms_starred" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "best_score" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "topic_id")
);

CREATE INDEX IF NOT EXISTS "topic_progress_by_user_studied"
  ON "topic_progress" ("user_id", "last_studied_at" DESC);

ALTER TABLE "topic_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topic_progress" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "topic_notes" FROM anon, authenticated;
REVOKE ALL ON TABLE "topic_progress" FROM anon, authenticated;
