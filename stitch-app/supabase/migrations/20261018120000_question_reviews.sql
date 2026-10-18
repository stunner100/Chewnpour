-- Spaced review queue: one row per question a student has missed. `box` walks
-- up the interval ladder in server/reviewSchedule.js on each correct review;
-- a miss drops it back to box 0. `due_at` is NULL once the question graduates.
CREATE TABLE IF NOT EXISTS "question_reviews" (
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "question_id" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "box" SMALLINT NOT NULL DEFAULT 0,
  "due_at" TIMESTAMPTZ,
  "lapses" INTEGER NOT NULL DEFAULT 0,
  "last_reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("user_id", "question_id")
);

CREATE INDEX IF NOT EXISTS "question_reviews_due"
  ON "question_reviews" ("user_id", "due_at")
  WHERE "due_at" IS NOT NULL;

ALTER TABLE "question_reviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "question_reviews" FROM anon, authenticated;
