-- Study uploads metadata (Supabase Storage + Docling extract pipeline)
CREATE TABLE IF NOT EXISTS "uploads" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_size" BIGINT NOT NULL DEFAULT 0,
  "content_type" TEXT,
  "storage_bucket" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "processing_step" TEXT,
  "extraction_status" TEXT,
  "extracted_text" TEXT,
  "extraction_warnings" JSONB,
  "extraction_backend" TEXT,
  "extraction_parser" TEXT,
  "page_count" INTEGER,
  "char_count" INTEGER,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "uploads_by_user_created"
  ON "uploads" ("user_id", "created_at" DESC);

ALTER TABLE "uploads" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "uploads" FROM anon, authenticated;

-- Private study-upload bucket (service-role access from API only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-uploads',
  'study-uploads',
  FALSE,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
