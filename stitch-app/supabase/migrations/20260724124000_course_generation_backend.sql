-- Track how course curriculum was generated
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "generation_backend" TEXT;
