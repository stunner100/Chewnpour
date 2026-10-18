-- One row per lifecycle email sent (kind: 'review_reminder'), so the
-- reminder cron can space emails out and never double-send.
CREATE TABLE IF NOT EXISTS "email_sends" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "provider_id" TEXT,
  "sent_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "email_sends_by_user_kind"
  ON "email_sends" ("user_id", "kind", "sent_at" DESC);

ALTER TABLE "email_sends" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "email_sends" FROM anon, authenticated;
