-- Lesson generation runs as background jobs, not inside the upload request.
-- A "course" job plans the upload's lessons (when the course has no plan yet)
-- and writes the first lessons; a "lessons" job writes or rewrites the plan
-- entries listed in plan_indexes (Regenerate, or parts not written yet).
--
-- A worker claims a job by setting status 'running' and a short lease
-- (locked_until) that it renews while it works. A job whose lease has run out
-- belongs to a worker that was killed, and the next worker resumes it: the
-- lessons it already wrote are kept.
CREATE TABLE IF NOT EXISTS "generation_jobs" (
  "id" TEXT PRIMARY KEY,
  "course_id" TEXT NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "upload_id" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('course', 'lessons')),
  "plan_indexes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'running', 'done', 'failed')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finished_at" TIMESTAMPTZ
);

-- At most one queued or running job per course.
CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_one_active_per_course"
  ON "generation_jobs" ("course_id") WHERE "status" IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS "generation_jobs_due"
  ON "generation_jobs" ("status", "locked_until", "created_at");

ALTER TABLE "generation_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "generation_jobs" FROM anon, authenticated;
