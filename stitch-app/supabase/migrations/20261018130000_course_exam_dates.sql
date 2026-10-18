-- Exam-date planner: an optional exam day per course, set by the student.
-- A calendar date (no time zone); the countdown and daily plan are computed
-- from it in src/lib/examPlan.js, and server/reviews.js uses it to pull that
-- course's due questions to the front of the review queue.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "exam_date" DATE;

CREATE INDEX IF NOT EXISTS "courses_by_user_exam_date"
  ON "courses" ("user_id", "exam_date")
  WHERE "exam_date" IS NOT NULL;

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "courses" FROM anon, authenticated;
