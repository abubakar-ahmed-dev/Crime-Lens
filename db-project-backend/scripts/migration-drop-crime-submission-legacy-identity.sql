-- ============================================
-- CrimeLens Migration - Drop Legacy CrimeSubmission Identity Columns
-- Run this manually in the Supabase SQL editor after updating views to use
-- CrimeSubmission.submitterId -> CrimeReportsSubmitter.id.
-- ============================================

BEGIN;

-- Drop old indexes if they exist.
DROP INDEX IF EXISTS "CrimeSubmission_userId_idx";

-- Drop any remaining foreign keys on legacy identity columns.
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"CrimeSubmission"'::regclass
      AND conname IN (
        'CrimeSubmission_submitterCnic_fkey',
        'CrimeSubmission_userId_fkey'
      )
  LOOP
    EXECUTE format('ALTER TABLE "CrimeSubmission" DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE "CrimeSubmission"
DROP COLUMN IF EXISTS "userId",
DROP COLUMN IF EXISTS "submitterCnic";

COMMIT;
