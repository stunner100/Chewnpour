-- Paystack top-up payments (hard cutover from Convex paymentTransactions)
CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "reference" TEXT NOT NULL UNIQUE,
  "plan_id" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "credits" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'initialized',
  "provider" TEXT NOT NULL DEFAULT 'paystack',
  "customer_email" TEXT,
  "source" TEXT,
  "event_type" TEXT,
  "payload_hash" TEXT,
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "payments_by_user_created"
  ON "payments" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "payments_by_status_created"
  ON "payments" ("status", "created_at" DESC);

ALTER TABLE "billing_accounts"
  ADD COLUMN IF NOT EXISTS "last_payment_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "last_payment_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_top_up_plan_id" TEXT;

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "payments" FROM anon, authenticated;
