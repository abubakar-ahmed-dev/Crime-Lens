-- ============================================
-- CrimeLens Migration - Soft Delete Crimes
-- Run this manually in the Supabase SQL editor.
--
-- Goal:
-- - Allow Crime.status = 'deleted'.
-- - Keep CrimeSubmission.CrimeId non-null and prevent FK nulling behavior.
-- - App delete operations should update Crime.status instead of deleting rows.
-- ============================================

BEGIN;

ALTER TYPE "enum_Crime_status" ADD VALUE IF NOT EXISTS 'deleted';

ALTER TABLE "CrimeSubmission"
DROP CONSTRAINT IF EXISTS "CrimeSubmission_CrimeId_fkey";

ALTER TABLE "CrimeSubmission"
ADD CONSTRAINT "CrimeSubmission_CrimeId_fkey"
FOREIGN KEY ("CrimeId")
REFERENCES "Crime"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMIT;
