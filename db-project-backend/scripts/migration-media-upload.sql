-- ============================================================================
-- CrimeLens Media Upload Feature - Database Migration
-- ============================================================================
-- Purpose: Add support for image and video uploads to crime reports
--
-- Changes:
-- 1. Create CrimeMedia table to store media file metadata
-- 2. Add mediaCount and thumbnailUrl columns to Crime table
-- 3. Create indexes for performance optimization
-- 4. Add constraints for data integrity
-- 5. Create triggers for automatic media count maintenance
--
-- Rollback: See ROLLBACK section at bottom of this file
-- ============================================================================

-- ============================================================================
-- 1. CREATE CRIMEMEDIA TABLE
-- ============================================================================
-- Purpose: Store metadata for all uploaded media files (images and videos)
--
-- Fields:
-- - id: Unique identifier for each media record
-- - CrimeId: Foreign key reference to Crime table (cascade delete)
-- - publicId: Cloudinary public ID for the uploaded file
-- - originalName: Original filename from user's device
-- - mimeType: MIME type of the file (e.g., 'image/jpeg', 'video/mp4')
-- - fileSize: Size of the file in bytes
-- - fileType: Either 'image' or 'video'
-- - url: Full Cloudinary URL to access the file
-- - thumbnailUrl: URL to thumbnail version (200x200 for images, first frame for videos)
-- - width: Image/video width in pixels
-- - height: Image/video height in pixels
-- - duration: Video duration in seconds (NULL for images)
-- - uploadedBy: Who uploaded the media ('citizen' or 'police')
-- - uploadedAt: Timestamp when the file was uploaded
-- - visibility: Who can see this media ('public' or 'police_only')
-- - caption: Optional description provided by citizen or police
-- - evidenceMarked: Whether police has marked this as official evidence
-- ============================================================================

CREATE TABLE "CrimeMedia" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Foreign Key to Crime table
  "CrimeId" BIGINT NOT NULL REFERENCES "Crime"(id) ON DELETE CASCADE,

  -- Cloudinary identification
  "publicId" VARCHAR(255) NOT NULL UNIQUE,

  -- Original file information
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "fileSize" INTEGER NOT NULL,

  -- File classification
  "fileType" VARCHAR(20) NOT NULL,

  -- URL information
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,

  -- Media dimensions
  "width" INTEGER,
  "height" INTEGER,

  -- Video-specific field (NULL for images)
  "duration" INTEGER,

  -- Upload metadata
  "uploadedBy" VARCHAR(255),
  "uploadedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Access control
  "visibility" VARCHAR(20) DEFAULT 'public',

  -- Additional information
  "caption" TEXT,
  "evidenceMarked" BOOLEAN DEFAULT FALSE,

  -- Constraints
  CONSTRAINT "check_crime_media_visibility"
    CHECK ("visibility" IN ('public', 'police_only')),

  CONSTRAINT "check_crime_media_file_type"
    CHECK ("fileType" IN ('image', 'video'))
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on CrimeId for fast lookups of all media for a specific crime
CREATE INDEX idx_crime_media_crime_id ON "CrimeMedia"("CrimeId");

-- Index on fileType for filtering by image vs video
CREATE INDEX idx_crime_media_file_type ON "CrimeMedia"("fileType");

-- Index on visibility for filtering public vs police-only media
CREATE INDEX idx_crime_media_visibility ON "CrimeMedia"("visibility");

-- Composite index for common query pattern (crime + visibility)
CREATE INDEX idx_crime_media_crime_visibility ON "CrimeMedia"("CrimeId", "visibility");

-- ============================================================================
-- 3. UPDATE CRIME TABLE
-- ============================================================================
-- Add columns to track media associated with crime reports

-- Add mediaCount: Number of media files attached to this crime
ALTER TABLE "Crime"
ADD COLUMN IF NOT EXISTS "mediaCount" INTEGER DEFAULT 0;

-- Add thumbnailUrl: URL to primary thumbnail for map display
ALTER TABLE "Crime"
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Add constraint to ensure mediaCount is never negative
ALTER TABLE "Crime"
ADD CONSTRAINT "check_crime_media_count"
CHECK ("mediaCount" >= 0);

-- ============================================================================
-- 4. CREATE TRIGGER FOR MEDIA COUNT MAINTENANCE
-- ============================================================================
-- Purpose: Automatically maintain Crime.mediaCount when CrimeMedia records
-- are added or removed. This ensures data consistency without manual updates.

-- Function to increment media count
CREATE OR REPLACE FUNCTION update_crime_media_count_increment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Crime"
  SET "mediaCount" = "mediaCount" + 1
  WHERE id = NEW."CrimeId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement media count
CREATE OR REPLACE FUNCTION update_crime_media_count_decrement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Crime"
  SET "mediaCount" = GREATEST("mediaCount" - 1, 0)
  WHERE id = OLD."CrimeId";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_crime_media_insert
  AFTER INSERT ON "CrimeMedia"
  FOR EACH ROW
  EXECUTE FUNCTION update_crime_media_count_increment();

CREATE TRIGGER trigger_crime_media_delete
  AFTER DELETE ON "CrimeMedia"
  FOR EACH ROW
  EXECUTE FUNCTION update_crime_media_count_decrement();

-- ============================================================================
-- 5. CREATE FUNCTION FOR THUMBNAIL UPDATE
-- ============================================================================
-- Purpose: Update Crime.thumbnailUrl when media is added or updated
-- This ensures the crime always has a valid thumbnail for map display

CREATE OR REPLACE FUNCTION update_crime_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if this is an image (not video)
  IF NEW."fileType" = 'image' THEN
    UPDATE "Crime"
    SET "thumbnailUrl" = NEW."thumbnailUrl"
    WHERE id = NEW."CrimeId"
      AND ("thumbnailUrl" IS NULL OR "thumbnailUrl" = '');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for thumbnail update on insert
CREATE TRIGGER trigger_crime_thumbnail_insert
  AFTER INSERT ON "CrimeMedia"
  FOR EACH ROW
  EXECUTE FUNCTION update_crime_thumbnail();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify success:

-- Check CrimeMedia table exists and has correct structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'CrimeMedia'
-- ORDER BY ordinal_position;

-- Check Crime table has new columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'Crime'
--   AND column_name IN ('mediaCount', 'thumbnailUrl');

-- Check indexes were created
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE tablename = 'CrimeMedia';

-- Check triggers were created
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name LIKE 'trigger_crime_media%';

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================
-- WARNING: This will permanently delete all media data and schema changes
-- Only run this if you need to completely remove the media upload feature

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_crime_media_insert ON "CrimeMedia";
DROP TRIGGER IF EXISTS trigger_crime_media_delete ON "CrimeMedia";
DROP TRIGGER IF EXISTS trigger_crime_thumbnail_insert ON "CrimeMedia";

-- Drop functions
DROP FUNCTION IF EXISTS update_crime_media_count_increment();
DROP FUNCTION IF EXISTS update_crime_media_count_decrement();
DROP FUNCTION IF EXISTS update_crime_thumbnail();

-- Drop indexes
DROP INDEX IF EXISTS idx_crime_media_crime_id;
DROP INDEX IF EXISTS idx_crime_media_file_type;
DROP INDEX IF EXISTS idx_crime_media_visibility;
DROP INDEX IF EXISTS idx_crime_media_crime_visibility;

-- Drop CrimeMedia table
DROP TABLE IF EXISTS "CrimeMedia" CASCADE;

-- Remove columns from Crime table
ALTER TABLE "Crime" DROP CONSTRAINT IF EXISTS "check_crime_media_count";
ALTER TABLE "Crime" DROP COLUMN IF EXISTS "mediaCount";
ALTER TABLE "Crime" DROP COLUMN IF EXISTS "thumbnailUrl";

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this script in Supabase SQL Editor or via migration tool
-- 2. Verify all objects created successfully
-- 3. Test with sample data
-- 4. Deploy backend code that uses these new tables
-- ============================================================================