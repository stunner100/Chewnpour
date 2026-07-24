-- App profiles (Better Auth user extension)
CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "full_name" TEXT,
  "education_level" TEXT,
  "department" TEXT,
  "avatar_url" TEXT,
  "avatar_gradient" INTEGER,
  "voice_mode_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "onboarding_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "study_preferences" JSONB,
  "streak_days" INTEGER NOT NULL DEFAULT 0,
  "total_study_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "profiles" FROM anon, authenticated;
