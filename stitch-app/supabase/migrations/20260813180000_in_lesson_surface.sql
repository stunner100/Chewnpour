-- Hard cutover: in-lesson checks are distinct from the quiz/exam bank.
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'quiz';

UPDATE "questions"
SET "surface" = 'quiz'
WHERE "surface" IS NULL OR "surface" = '';

UPDATE "questions"
SET "surface" = 'in_lesson'
WHERE "question_type" = 'ordering';

ALTER TABLE "topic_progress"
  ADD COLUMN IF NOT EXISTS "lesson_checks" JSONB NOT NULL DEFAULT '{}'::jsonb;
