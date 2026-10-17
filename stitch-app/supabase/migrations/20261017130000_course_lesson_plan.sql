-- The course's full lesson plan, in document order: every planned lesson with
-- its title, kind and source span (character offsets into the upload's
-- extracted text), and the topic once that lesson has been written. Long
-- uploads plan more lessons than are written at first, so entries without a
-- topic are parts of the document that have no lesson yet. Courses created
-- before planning have an empty plan.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "lesson_plan" JSONB NOT NULL DEFAULT '[]'::JSONB;
