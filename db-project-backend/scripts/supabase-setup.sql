-- ============================================
-- CrimeLens Database Schema for Supabase
-- Version: 3.0 (Updated for Citizen Authentication)
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Create ENUM Types
-- ============================================

CREATE TYPE "enum_Crime_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "enum_PoliceAgentRequest_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "enum_UploadLog_status" AS ENUM ('completed', 'failed', 'uploaded');
CREATE TYPE "enum_ProfileStatus" AS ENUM ('pending', 'complete');

-- ============================================
-- Create Tables
-- ============================================

-- Role table
CREATE TABLE IF NOT EXISTS "Role" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT
);

-- Zone table
CREATE TABLE IF NOT EXISTS "Zone" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "boundary" GEOMETRY(polygon, 4326)
);

-- CrimeType table
CREATE TABLE IF NOT EXISTS "CrimeType" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "severity" INTEGER NOT NULL DEFAULT 1
);

-- User table (Admin/Police users with JWT auth)
CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "username" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "isActive" BOOLEAN DEFAULT TRUE,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CrimeReportsSubmitter table (Citizen Profile)
CREATE TABLE IF NOT EXISTS "CrimeReportsSubmitter" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "supabaseUserId" TEXT UNIQUE,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT,
    "submitterCnic" TEXT UNIQUE,
    "fullName" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PoliceBranch table
CREATE TABLE IF NOT EXISTS "PoliceBranch" (
    "id" SERIAL PRIMARY KEY,
    "branchHeadUserId" INTEGER,
    "zoneId" INTEGER NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "location" GEOMETRY(point, 4326) NOT NULL,
    CONSTRAINT "PoliceBranch_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PoliceBranch_branchHeadUserId_fkey" FOREIGN KEY ("branchHeadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Crime table
CREATE TABLE IF NOT EXISTS "Crime" (
    "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "crimeTypeId" INTEGER NOT NULL,
    "incidentDate" TIMESTAMP WITH TIME ZONE NOT NULL,
    "reportedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "status" "enum_Crime_status" NOT NULL DEFAULT 'pending',
    "location" GEOMETRY(point, 4326),
    "address" TEXT,
    "zoneId" INTEGER,
    CONSTRAINT "Crime_crimeTypeId_fkey" FOREIGN KEY ("crimeTypeId") REFERENCES "CrimeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Crime_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CrimeSubmission table
CREATE TABLE IF NOT EXISTS "CrimeSubmission" (
    "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "submitterCnic" TEXT,
    "submitterId" UUID NOT NULL,
    "userId" TEXT,
    "submittedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CrimeId" BIGINT NOT NULL,
    CONSTRAINT "CrimeSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "CrimeReportsSubmitter"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrimeSubmission_CrimeId_fkey" FOREIGN KEY ("CrimeId") REFERENCES "Crime"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- PoliceAgentRequestsTemp table
CREATE TABLE IF NOT EXISTS "PoliceAgentRequestsTemp" (
    "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PoliceAgentRequest table
CREATE TABLE IF NOT EXISTS "PoliceAgentRequest" (
    "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "policeAgentRequestsTempId" BIGINT,
    "userId" INTEGER,
    "branchId" INTEGER,
    "status" "enum_PoliceAgentRequest_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoliceAgentRequest_policeAgentRequestsTempId_fkey" FOREIGN KEY ("policeAgentRequestsTempId") REFERENCES "PoliceAgentRequestsTemp"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PoliceAgentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PoliceAgentRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "PoliceBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- UploadLog table
CREATE TABLE IF NOT EXISTS "UploadLog" (
    "id" SERIAL PRIMARY KEY,
    "filename" TEXT,
    "status" "enum_UploadLog_status" NOT NULL DEFAULT 'uploaded',
    "totalRecords" INTEGER,
    "recordsUploaded" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ActivityLog table (for audit trail)
CREATE TABLE IF NOT EXISTS "activitylog" (
    "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "tablename" TEXT NOT NULL,
    "recordid" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdat" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Create Indexes
-- ============================================

-- B-tree indexes for common queries
CREATE INDEX IF NOT EXISTS "Crime_crimeTypeId_idx" ON "Crime"("crimeTypeId");
CREATE INDEX IF NOT EXISTS "Crime_reportedAt_idx" ON "Crime"("reportedAt");
CREATE INDEX IF NOT EXISTS "Crime_status_idx" ON "Crime"("status");
CREATE INDEX IF NOT EXISTS "Crime_zoneId_reportedAt_idx" ON "Crime"("zoneId", "reportedAt");
CREATE INDEX IF NOT EXISTS "activitylog_tablename_recordid_idx" ON "activitylog"("tablename", "recordid");

-- Citizen-specific indexes
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_userId_idx" ON "CrimeReportsSubmitter"("id");
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_supabaseUserId_idx" ON "CrimeReportsSubmitter"("supabaseUserId");
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_email_idx" ON "CrimeReportsSubmitter"("email");
CREATE INDEX IF NOT EXISTS "CrimeReportsSubmitter_isProfileComplete_idx" ON "CrimeReportsSubmitter"("isProfileComplete");
CREATE INDEX IF NOT EXISTS "CrimeSubmission_submitterId_idx" ON "CrimeSubmission"("submitterId");
CREATE INDEX IF NOT EXISTS "CrimeSubmission_userId_idx" ON "CrimeSubmission"("userId");

-- PostGIS indexes for geospatial queries
CREATE INDEX IF NOT EXISTS "idx_crime_location" ON "Crime" USING GIST(location);
CREATE INDEX IF NOT EXISTS "idx_policebranch_location" ON "PoliceBranch" USING GIST(location);
CREATE INDEX IF NOT EXISTS "idx_zone_boundary" ON "Zone" USING GIST(boundary);

-- ============================================
-- Seed Initial Data
-- ============================================

-- Insert default roles
INSERT INTO "Role" ("name", "description") VALUES
    ('admin', 'System administrator with full access'),
    ('police', 'Police officer with limited access'),
    ('user', 'Regular citizen user')
ON CONFLICT ("name") DO NOTHING;

-- Insert default crime types
INSERT INTO "CrimeType" ("name", "severity") VALUES
    ('Theft', 1),
    ('Assault', 2),
    ('Robbery', 3),
    ('Burglary', 2),
    ('Vandalism', 1),
    ('Fraud', 2),
    ('Other', 1)
ON CONFLICT ("name") DO NOTHING;

-- ============================================
-- Verification Query
-- ============================================

-- Display created tables and row counts
SELECT
    schemaname,
    tablename,
    CASE tablename
        WHEN 'Role' THEN (SELECT COUNT(*) FROM "Role")
        WHEN 'CrimeType' THEN (SELECT COUNT(*) FROM "CrimeType")
        WHEN 'User' THEN (SELECT COUNT(*) FROM "User")
        WHEN 'Zone' THEN (SELECT COUNT(*) FROM "Zone")
        WHEN 'Crime' THEN (SELECT COUNT(*) FROM "Crime")
        WHEN 'PoliceBranch' THEN (SELECT COUNT(*) FROM "PoliceBranch")
        WHEN 'CrimeSubmission' THEN (SELECT COUNT(*) FROM "CrimeSubmission")
        WHEN 'PoliceAgentRequest' THEN (SELECT COUNT(*) FROM "PoliceAgentRequest")
        WHEN 'UploadLog' THEN (SELECT COUNT(*) FROM "UploadLog")
        WHEN 'activitylog' THEN (SELECT COUNT(*) FROM "activitylog")
        WHEN 'CrimeReportsSubmitter' THEN (SELECT COUNT(*) FROM "CrimeReportsSubmitter")
        ELSE 0
    END as row_count
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('Role', 'User', 'Zone', 'CrimeType', 'Crime', 'PoliceBranch', 'CrimeReportsSubmitter', 'CrimeSubmission', 'PoliceAgentRequestsTemp', 'PoliceAgentRequest', 'UploadLog', 'activitylog')
ORDER BY tablename;
