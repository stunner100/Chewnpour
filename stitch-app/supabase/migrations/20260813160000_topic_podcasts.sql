-- Study podcasts generated from topic lessons (Deepgram TTS + Storage)
CREATE TABLE IF NOT EXISTS "topic_podcasts" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "course_id" TEXT REFERENCES "courses"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "script" TEXT,
  "script_word_count" INTEGER,
  "duration_seconds" INTEGER,
  "voice_model" TEXT,
  "storage_bucket" TEXT,
  "storage_path" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "topic_podcasts_by_user_created"
  ON "topic_podcasts" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "topic_podcasts_by_topic_created"
  ON "topic_podcasts" ("topic_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "topic_podcasts_by_status_started"
  ON "topic_podcasts" ("status", "started_at");

ALTER TABLE "topic_podcasts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "topic_podcasts" FROM anon, authenticated;
