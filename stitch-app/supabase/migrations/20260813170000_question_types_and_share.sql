-- Hard cutover: typed in-lesson questions plus owner-opt-in public share links.
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "question_type" TEXT NOT NULL DEFAULT 'multiple_choice',
  ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "hint" TEXT;

UPDATE "questions"
SET "question_type" = 'multiple_choice'
WHERE "question_type" IS NULL OR "question_type" = '';

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "share_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_share_token_unique"
  ON "courses" ("share_token")
  WHERE "share_token" IS NOT NULL;
