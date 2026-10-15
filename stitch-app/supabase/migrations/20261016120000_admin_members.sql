-- Admins granted from the admin dashboard. Bound to a user id (not an email)
-- so access can't be claimed by registering an address. Bootstrap and
-- ADMIN_EMAILS / ADMIN_USER_IDS admins stay in code and env.
CREATE TABLE IF NOT EXISTS "admin_members" (
  "user_id" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "added_by" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "admin_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "admin_members" FROM anon, authenticated;
