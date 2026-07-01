-- ============================================
-- CrimeLens Migration - Citizen Profile UUID Primary Key
-- Run this manually in the Supabase SQL editor.
--
-- Goal:
-- - CrimeReportsSubmitter.id becomes the stable primary key.
-- - CrimeReportsSubmitter.submitterCnic becomes nullable profile data.
-- - CrimeSubmission.submitterId references CrimeReportsSubmitter.id.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Add stable UUID identity to citizen profiles.
ALTER TABLE "CrimeReportsSubmitter"
ADD COLUMN IF NOT EXISTS "id" UUID DEFAULT gen_random_uuid();

UPDATE "CrimeReportsSubmitter"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;

ALTER TABLE "CrimeReportsSubmitter"
ALTER COLUMN "id" SET NOT NULL;

-- 2) Drop existing CrimeSubmission foreign keys that reference submitterCnic.
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"CrimeSubmission"'::regclass
      AND confrelid = '"CrimeReportsSubmitter"'::regclass
  LOOP
    EXECUTE format('ALTER TABLE "CrimeSubmission" DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

-- 3) Replace CNIC primary key with UUID primary key.
ALTER TABLE "CrimeReportsSubmitter"
DROP CONSTRAINT IF EXISTS "CrimeReportsSubmitter_pkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = '"CrimeReportsSubmitter"'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "CrimeReportsSubmitter"
    ADD CONSTRAINT "CrimeReportsSubmitter_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- 4) CNIC is now profile data. It may be NULL until profile completion.
ALTER TABLE "CrimeReportsSubmitter"
ALTER COLUMN "submitterCnic" DROP NOT NULL;

-- 5) Add stable profile reference to crime submissions.
ALTER TABLE "CrimeSubmission"
ADD COLUMN IF NOT EXISTS "submitterId" UUID;

-- Backfill existing submissions from old CNIC/userId values.
UPDATE "CrimeSubmission" cs
SET "submitterId" = crs."id"
FROM "CrimeReportsSubmitter" crs
WHERE cs."submitterId" IS NULL
  AND (
    cs."submitterCnic" = crs."submitterCnic"
    OR cs."userId" = crs."submitterCnic"
  );

-- Remove placeholder CNICs after ownership is backfilled.
-- Any temp CNIC means the profile still needs a real CNIC.
UPDATE "CrimeReportsSubmitter"
SET "submitterCnic" = NULL,
    "isProfileComplete" = FALSE
WHERE "submitterCnic" LIKE 'temp_%';

CREATE UNIQUE INDEX IF NOT EXISTS "CrimeReportsSubmitter_submitterCnic_unique"
ON "CrimeReportsSubmitter"("submitterCnic")
WHERE "submitterCnic" IS NOT NULL;

-- If this query returns rows, resolve them before enforcing NOT NULL.
-- SELECT * FROM "CrimeSubmission" WHERE "submitterId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CrimeSubmission" WHERE "submitterId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce CrimeSubmission.submitterId NOT NULL: some rows could not be backfilled.';
  END IF;
END $$;

ALTER TABLE "CrimeSubmission"
ALTER COLUMN "submitterId" SET NOT NULL;

ALTER TABLE "CrimeSubmission"
ALTER COLUMN "submitterCnic" DROP NOT NULL;

ALTER TABLE "CrimeSubmission"
DROP CONSTRAINT IF EXISTS "CrimeSubmission_submitterId_fkey";

ALTER TABLE "CrimeSubmission"
ADD CONSTRAINT "CrimeSubmission_submitterId_fkey"
FOREIGN KEY ("submitterId")
REFERENCES "CrimeReportsSubmitter"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CrimeSubmission_submitterId_idx"
ON "CrimeSubmission"("submitterId");

COMMIT;
