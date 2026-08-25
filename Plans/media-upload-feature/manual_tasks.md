# Manual Tasks - Media Upload Feature

This document contains all tasks that require manual human intervention during the implementation of the media upload feature.

---

## Task 1: Cloudinary Account Setup

### Instructions

1. **Create Cloudinary Account**
   - Go to https://cloudinary.com
   - Click "Sign up" (use GitHub/Google for faster setup)
   - Choose "Free" plan (25GB storage, 25GB bandwidth)
   - Complete email verification

2. **Get API Credentials**
   - Log in to Cloudinary Dashboard
   - Navigate to: Settings → API Security
   - Copy the following values:
     - `Cloud name` (from dashboard main page)
     - `API Key` (from API Security page)
     - `API Secret` (from API Security page)

3. **Create Upload Preset**
   - Navigate to: Settings → Upload
   - Click "Add upload preset"
   - Preset name: `crime_media_upload`
   - Settings:
     - Signing mode: Unsigned (for citizen uploads)
     - Folder: No (will be set dynamically)
     - Allowed formats: jpg, png, gif, webp, mp4, mov, webm
     - Max file size: 5000000 (5MB)
     - Image transformations:
       - Quality: Auto
       - Format: Auto
     - Video transformations:
       - Quality: Auto
   - Save the preset
   - Copy the "Upload preset name" (unsigned version)

4. **Document for Team**
   - Save credentials in secure location
   - Do NOT commit to Git
   - Will be added to .env file later

### Expected Outcome
- Cloudinary account created and verified
- API credentials documented
- Upload preset configured
- Credentials ready for .env configuration

---

## Task 2: Environment Variables Configuration

### Instructions

1. **Backend .env Setup**
   - Open `db-project-backend/.env`
   - Add the following variables:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
CLOUDINARY_UPLOAD_PRESET=crime_media_upload

# Media Upload Limits
MAX_IMAGE_COUNT=5
MAX_VIDEO_COUNT=2
MAX_MEDIA_FILE_SIZE=5242880  # 5MB in bytes
```

2. **Frontend .env Setup**
   - Open `db-project-frontend/.env`
   - No additional variables needed (will use backend API)

3. **Restart Development Server**
   - Stop backend server (Ctrl+C)
   - Start backend server: `npm run start` (from db-project-backend)
   - Verify no environment errors

### Verification
```bash
# Test backend can load environment variables
# In db-project-backend directory:
node -e "console.log(process.env.CLOUDINARY_CLOUD_NAME)"
# Should output your cloud name
```

### Expected Outcome
- Backend .env configured with Cloudinary credentials
- Frontend .env unchanged
- Development server starts without errors
- Environment variables loaded correctly

---

## Task 3: Database Migration Execution

### Instructions

1. **Connect to Supabase Database**
   - Log in to Supabase Dashboard
   - Select your project
   - Navigate to: SQL Editor → New Query

2. **Execute Migration Script**

Run this SQL script in the SQL Editor:

```sql
-- Create CrimeMedia table
CREATE TABLE "CrimeMedia" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "CrimeId" BIGINT NOT NULL REFERENCES "Crime"(id) ON DELETE CASCADE,
  "publicId" VARCHAR(255) NOT NULL UNIQUE,
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileType" VARCHAR(20) NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "duration" INTEGER,
  "uploadedBy" VARCHAR(255),
  "uploadedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "visibility" VARCHAR(20) DEFAULT 'public',
  "caption" TEXT,
  "evidenceMarked" BOOLEAN DEFAULT FALSE,
  CONSTRAINT "check_visibility" CHECK ("visibility" IN ('public', 'police_only')),
  CONSTRAINT "check_fileType" CHECK ("fileType" IN ('image', 'video'))
);

-- Create indexes
CREATE INDEX idx_crime_media_crime_id ON "CrimeMedia"("CrimeId");
CREATE INDEX idx_crime_media_file_type ON "CrimeMedia"("fileType");
CREATE INDEX idx_crime_media_visibility ON "CrimeMedia"("visibility");

-- Add columns to Crime table
ALTER TABLE "Crime"
ADD COLUMN IF NOT EXISTS "mediaCount" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Update Crime table to enforce mediaCount non-negative
ALTER TABLE "Crime" ADD CONSTRAINT "check_mediaCount" CHECK ("mediaCount" >= 0);
```

3. **Verify Migration**
   - Check table created: `SELECT * FROM "CrimeMedia" LIMIT 1;` (should return empty result)
   - Check columns added to Crime: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Crime' AND column_name IN ('mediaCount', 'thumbnailUrl');`
   - Should show both columns

4. **Test Rollback Procedure** (Optional but Recommended)
   - Save rollback script for emergencies:

```sql
-- ROLLBACK SCRIPT - Save this but DO NOT execute unless needed
DROP TABLE IF EXISTS "CrimeMedia" CASCADE;
ALTER TABLE "Crime" DROP COLUMN IF EXISTS "mediaCount";
ALTER TABLE "Crime" DROP COLUMN IF EXISTS "thumbnailUrl";
```

### Expected Outcome
- CrimeMedia table created with all constraints
- Indexes created successfully
- Crime table updated with new columns
- Constraints working correctly
- Rollback script documented

---

## Task 4: Install Backend Dependencies

### Instructions

1. **Navigate to Backend Directory**
   ```bash
   cd db-project-backend
   ```

2. **Install Cloudinary Package**
   ```bash
   npm install cloudinary@^2.0.0
   ```

3. **Verify Installation**
   ```bash
   npm list cloudinary
   # Should show cloudinary@2.x.x
   ```

4. **Check package.json**
   - Open `db-project-backend/package.json`
   - Verify `"cloudinary": "^2.0.0"` in dependencies

### Expected Outcome
- Cloudinary package installed
- No dependency conflicts
- package.json updated

---

## Task 5: Install Frontend Dependencies

### Instructions

1. **Navigate to Frontend Directory**
   ```bash
   cd db-project-frontend
   ```

2. **Install Optional UI Libraries**
   ```bash
   npm install yet-another-react-lightbox@^3.15.0
   ```

3. **Verify Installation**
   ```bash
   npm list yet-another-react-lightbox
   # Should show yet-another-react-lightbox@3.x.x
   ```

4. **Check package.json**
   - Open `db-project-frontend/package.json`
   - Verify library in dependencies

### Expected Outcome
- Lightbox library installed
- No dependency conflicts
- Ready for gallery implementation

---

## Task 6: Create Git Branch for Feature

### Instructions

1. **Checkout to dev Branch** (if not already)
   ```bash
   git checkout dev
   git pull origin dev
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/media-upload
   ```

3. **Verify Branch**
   ```bash
   git branch
   # Should show * feature/media-upload
   ```

### Expected Outcome
- Feature branch created
- Working on clean dev branch
- Ready for implementation

---

## Task 7: Initial Implementation Log Creation

### Instructions

1. **Create Implementation Log Directory**
   ```bash
   mkdir -p Plans/media-upload-feature/implementation_log
   ```

2. **Create Phase 1 Log File**
   - Create file: `Plans/media-upload-feature/implementation_log/phase_1_implementation.md`
   - Add initial content:

```markdown
# Phase 1 Implementation Log

**Date:** [Current Date]
**Status:** Started

## Setup Completed
- Created Plans directory structure
- Created phase_wise_plan.md
- Created manual_tasks.md
- Created implementation_log directory

## Manual Tasks Completed
- [x] Task 1: Cloudinary Account Setup
- [ ] Task 2: Environment Variables Configuration
- [ ] Task 3: Database Migration Execution
- [ ] Task 4: Install Backend Dependencies
- [ ] Task 5: Install Frontend Dependencies
- [ ] Task 6: Create Git Branch

## Notes
- Ready to begin implementation phases
- Manual tasks must be completed before starting Phase 5
```

### Expected Outcome
- Implementation log structure created
- Ready to track progress
- Manual tasks documented

---

## Task 8: Testing Database Connection

### Instructions

1. **Test Migration with Sample Data**
   - Run in Supabase SQL Editor:

```sql
-- Test CrimeMedia table
INSERT INTO "CrimeMedia" ("CrimeId", "publicId", "originalName", "mimeType", "fileSize", "fileType", "url", "thumbnailUrl", "uploadedBy", "visibility", "caption")
VALUES (1, 'test_123', 'test.jpg', 'image/jpeg', 1024, 'image', 'https://res.cloudinary.com/test.jpg', 'https://res.cloudinary.com/test_thumb.jpg', 'citizen', 'public', 'Test image');

-- Verify insert
SELECT * FROM "CrimeMedia" WHERE "publicId" = 'test_123';

-- Clean up test data
DELETE FROM "CrimeMedia" WHERE "publicId" = 'test_123';
```

2. **Test Crime Table Columns**
   - Run in Supabase SQL Editor:

```sql
-- Test Crime columns
UPDATE "Crime" SET "mediaCount" = 1, "thumbnailUrl" = 'https://test.com/thumb.jpg' WHERE id = 1;

-- Verify update
SELECT "mediaCount", "thumbnailUrl" FROM "Crime" WHERE id = 1;

-- Reset test data
UPDATE "Crime" SET "mediaCount" = 0, "thumbnailUrl" = NULL WHERE id = 1;
```

### Expected Outcome
- Database writes successful
- Constraints working
- Ready for data insertion

---

## Task 9: Cloudinary Console Testing

### Instructions

1. **Test Upload Preset**
   - Use Cloudinary Console: https://cloudinary.com/console/media_library/upload
   - Upload a test image
   - Select your upload preset
   - Verify upload succeeds

2. **Test Transformations**
   - Find uploaded image in Media Library
   - Click on image → Transformations
   - Test: `w_200,h_200,c_fill`
   - Verify thumbnail generated

3. **Test Video Upload**
   - Upload a test video
   - Verify thumbnail auto-generated
   - Check transformations work

4. **Clean Up Test Files**
   - Delete test uploads from Media Library
   - Verify they're removed

### Expected Outcome
- Upload preset working
- Transformations working
- Ready for backend integration

---

## Task 10: Local Development Server Setup

### Instructions

1. **Start Backend Server**
   ```bash
   cd db-project-backend
   npm run start
   ```

2. **Start Frontend Server**
   ```bash
   cd db-project-frontend
   npm run dev
   ```

3. **Verify Both Running**
   - Backend: http://localhost:5001
   - Frontend: http://localhost:5173
   - Test health endpoint: http://localhost:5001/api

4. **Test CORS**
   - Open browser console on frontend
   - Verify no CORS errors
   - Check Network tab for successful API calls

### Expected Outcome
- Both servers running
- No CORS issues
- Ready for feature development

---

## Task Order Summary

### Must Complete BEFORE Implementation Starts
1. **Task 1:** Cloudinary Account Setup
2. **Task 3:** Database Migration Execution
3. **Task 4:** Install Backend Dependencies
4. **Task 5:** Install Frontend Dependencies
5. **Task 6:** Create Git Branch

### Complete During Implementation
6. **Task 2:** Environment Variables Configuration (after Phase 1)
7. **Task 7:** Implementation Log Creation (before starting Phase 1)
8. **Task 8:** Testing Database Connection (after Phase 2)
9. **Task 9:** Cloudinary Console Testing (after Phase 5)
10. **Task 10:** Local Development Server Setup (before Phase 11)

---

## Troubleshooting

### Cloudinary Setup Issues
- **Problem:** Upload preset not working
- **Solution:** Ensure "Unsigned" mode is selected for citizen uploads
- **Problem:** API key rejected
- **Solution:** Regenerate API secret in Cloudinary dashboard

### Database Migration Issues
- **Problem:** Foreign key constraint fails
- **Solution:** Ensure Crime table exists and has records
- **Problem:** Index creation fails
- **Solution:** Check for existing indexes with same name

### Dependency Installation Issues
- **Problem:** npm install fails
- **Solution:** Try `npm cache clean --force` then reinstall
- **Problem:** Version conflicts
- **Solution:** Check existing dependencies, adjust versions

### Environment Variable Issues
- **Problem:** Variables not loading
- **Solution:** Ensure .env file is in correct directory
- **Problem:** Server won't start
- **Solution:** Check for syntax errors in .env file

---

## Completion Checklist

Before starting Phase 1 implementation, verify:

- [ ] Cloudinary account created and credentials documented
- [ ] Upload preset configured and tested
- [ ] Database migration executed successfully
- [ ] All dependencies installed
- [ ] Feature branch created
- [ ] Implementation log initialized
- [ ] Environment variables documented
- [ ] Development servers running successfully

When all items checked, implementation can begin!
