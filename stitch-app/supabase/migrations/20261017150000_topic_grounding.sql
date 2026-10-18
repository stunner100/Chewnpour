-- What the source check found when a lesson was written: whether a core
-- section could not be matched to the upload (needsReview), and which
-- optional sections and word bank terms were dropped for the same reason.
-- Lessons written before this check have an empty report.
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "grounding" JSONB NOT NULL DEFAULT '{}'::JSONB;
