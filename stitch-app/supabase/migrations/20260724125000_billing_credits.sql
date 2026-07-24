-- Upload credits / billing (greenfield cutover from Convex subscriptions)
CREATE TABLE IF NOT EXISTS "billing_accounts" (
  "user_id" TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "purchased_upload_credits" INTEGER NOT NULL DEFAULT 0,
  "consumed_upload_credits" INTEGER NOT NULL DEFAULT 0,
  "starter_granted" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "credit_ledger" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "entry_type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "upload_id" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
  "balance_after" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "credit_ledger_by_user_created"
  ON "credit_ledger" ("user_id", "created_at" DESC);

ALTER TABLE "billing_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "billing_accounts" FROM anon, authenticated;
REVOKE ALL ON TABLE "credit_ledger" FROM anon, authenticated;
