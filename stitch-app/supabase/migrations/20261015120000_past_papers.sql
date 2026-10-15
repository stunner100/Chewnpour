-- Admin-curated past exam papers students can browse, open, and practise.
CREATE TABLE IF NOT EXISTS "past_papers" (
  "id" TEXT PRIMARY KEY,
  "institution" TEXT NOT NULL,
  "course_code" TEXT NOT NULL,
  "course_title" TEXT NOT NULL DEFAULT '',
  "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1950 AND 2100),
  "semester" TEXT NOT NULL DEFAULT '',
  "level" TEXT NOT NULL DEFAULT '',
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_size" BIGINT NOT NULL DEFAULT 0,
  "content_type" TEXT,
  "storage_bucket" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published')),
  "uploaded_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "past_papers_browse"
  ON "past_papers" ("status", "institution", "course_code", "year" DESC);

ALTER TABLE "past_papers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "past_papers" FROM anon, authenticated;

-- A student's practice copy of a past paper runs through the normal upload
-- pipeline; one copy per student per paper.
ALTER TABLE "uploads"
  ADD COLUMN IF NOT EXISTS "source_past_paper_id" TEXT
  REFERENCES "past_papers"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uploads_user_past_paper_unique"
  ON "uploads" ("user_id", "source_past_paper_id")
  WHERE "source_past_paper_id" IS NOT NULL;

-- Private bucket; files are served through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'past-papers',
  'past-papers',
  FALSE,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
