-- Idempotency for course generation and credit spends per upload.
-- Deduplicate any legacy duplicates before adding unique indexes.

WITH ranked_courses AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY upload_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM courses
  WHERE upload_id IS NOT NULL
)
DELETE FROM courses
WHERE id IN (SELECT id FROM ranked_courses WHERE rn > 1);

WITH ranked_spend AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY upload_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM credit_ledger
  WHERE upload_id IS NOT NULL
    AND entry_type = 'spend'
)
DELETE FROM credit_ledger
WHERE id IN (SELECT id FROM ranked_spend WHERE rn > 1);

DROP INDEX IF EXISTS "courses_by_upload";

CREATE UNIQUE INDEX IF NOT EXISTS "courses_upload_id_unique"
  ON "courses" ("upload_id")
  WHERE "upload_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_spend_upload_unique"
  ON "credit_ledger" ("upload_id")
  WHERE "upload_id" IS NOT NULL AND "entry_type" = 'spend';
