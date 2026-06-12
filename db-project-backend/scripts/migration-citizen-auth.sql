-- ============================================
-- CrimeLens Database Migration - Citizen Authentication
-- Run these ALTER TABLE commands in Supabase SQL Editor
-- ============================================

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- Create ENUM Types
-- ============================================

CREATE TYPE IF NOT EXISTS "enum_Crime_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE IF NOT EXISTS "enum_PoliceAgentRequest_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE IF NOT EXISTS "enum_UploadLog_status" AS ENUM ('completed', 'failed', 'uploaded');

-- ============================================
-- Alter CrimeReportsSubmitter Table (Citizen Profile)
-- ============================================

-- Add new columns for citizen authentication
ALTER TABLE "CrimeReportsSubmitter"
ADD COLUMN IF NOT EXISTS "supabaseUserId" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "password" TEXT,
ADD COLUMN IF NOT EXISTS "fullName" TEXT,
ADD COLUMN IF NOT EXISTS "contact" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "isProfileComplete" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Make email unique and NOT NULL (may fail if existing nulls, handle carefully)
DO $$
BEGIN
    -- Remove existing unique constraint if exists
    ALTER TABLE "CrimeReportsSubmitter" DROP CONSTRAINT IF EXISTS "CrimeReportsSubmitter_email_key";

    -- Make email nullable first to avoid issues
    ALTER TABLE "CrimeReportsSubmitter" ALTER COLUMN "email" DROP NOT NULL;

    -- Add unique constraint
    ALTER TABLE "CrimeReportsSubmitter" ADD CONSTRAINT "CrimeReportsSubmitter_email_key" UNIQUE ("email");
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Update existing records to have a default fullName from submitterName
UPDATE "CrimeReportsSubmitter"
SET "fullName" = COALESCE("fullName", "submitterName"),
    "contact" = COALESCE("contact", "submitterContact")
WHERE "fullName" IS NULL;

-- ============================================
-- Alter CrimeSubmission Table
-- ============================================

-- Add userId column for authenticated citizen submissions
ALTER TABLE "CrimeSubmission"
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- ============================================
-- Create Indexes for Citizen Authentication
-- ============================================

-- Supabase user ID index
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_supabaseUserId_idx"
ON "CrimeReportsSubmitter"("supabaseUserId");

-- Email index
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_email_idx"
ON "CrimeReportsSubmitter"("email");

-- Profile completion status index
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_isProfileComplete_idx"
ON "CrimeReportsSubmitter"("isProfileComplete");

-- User ID index on CrimeSubmission
CREATE INDEX IF NOT EXISTS "CrimeSubmission_userId_idx"
ON "CrimeSubmission"("userId");

-- ============================================
-- Verification Queries
-- ============================================

-- Check CrimeReportsSubmitter columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'CrimeReportsSubmitter'
AND column_name IN ('supabaseUserId', 'email', 'fullName', 'contact', 'address', 'isProfileComplete', 'createdAt', 'updatedAt')
ORDER BY ordinal_position;

-- Check CrimeSubmission columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'CrimeSubmission'
AND column_name = 'userId';

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('CrimeReportsSubmitter', 'CrimeSubmission')
AND indexname LIKE '%userId%' OR indexname LIKE '%email%' OR indexname LIKE '%supabaseUserId%';
