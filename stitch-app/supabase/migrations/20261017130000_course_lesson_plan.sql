-- The course's full lesson plan, in document order: every planned lesson with
-- its title, kind, source span (character offsets into the upload's
-- extracted text), status and, once written, its topic. Status is "written",
-- "failed" (the model could not write it) or "pending" (not written yet:
-- long uploads plan more lessons than are written at first). Courses created
-- before planning have an empty plan.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "lesson_plan" JSONB NOT NULL DEFAULT '[]'::JSONB;
