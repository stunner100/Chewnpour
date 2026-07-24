-- Courses, topics, and quiz questions (greenfield cutover from Convex)
CREATE TABLE IF NOT EXISTS "courses" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upload_id" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "courses_by_user_created"
  ON "courses" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "courses_by_upload"
  ON "courses" ("upload_id");

CREATE TABLE IF NOT EXISTS "topics" (
  "id" TEXT PRIMARY KEY,
  "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upload_id" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "topics_by_course_order"
  ON "topics" ("course_id", "sort_order");
CREATE INDEX IF NOT EXISTS "topics_by_user"
  ON "topics" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "questions" (
  "id" TEXT PRIMARY KEY,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_index" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "questions_by_topic_order"
  ON "questions" ("topic_id", "sort_order");

CREATE TABLE IF NOT EXISTS "quiz_attempts" (
  "id" TEXT PRIMARY KEY,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "answers" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "score" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "quiz_attempts_by_user_created"
  ON "quiz_attempts" ("user_id", "created_at" DESC);

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "courses" FROM anon, authenticated;
REVOKE ALL ON TABLE "topics" FROM anon, authenticated;
REVOKE ALL ON TABLE "questions" FROM anon, authenticated;
REVOKE ALL ON TABLE "quiz_attempts" FROM anon, authenticated;
