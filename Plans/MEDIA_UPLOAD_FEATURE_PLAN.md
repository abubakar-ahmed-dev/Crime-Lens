# Image & Video Upload Feature for Crime Reports

## Context

This feature adds optional image and video upload functionality to crime report submissions. Citizens can attach evidence (up to 5 images and 2 videos, max 5MB each) when submitting crime reports. Each media item can have an optional caption. Police officers can view all media during verification and have full edit control (add, remove, replace, change visibility). Media items have a visibility flag (public/police_only) that defaults to public. Public maps show only public media, while police/admin maps show all media regardless of visibility.

**Current State:** Crime reports are text-only with location data. No media attachments exist.

**Desired State:** Rich crime reports with visual evidence, visibility-based access control (public vs police-only media), citizen caption input, and comprehensive media management during verification. Media updates/deletes trigger Crime.latestUpdatedBy updates.

---

## Technical Architecture

### Storage Solution: Cloudinary

**Why Cloudinary:**
- Seamless integration with Node.js/Express
- Built-in image transformations (thumbnails, cropping, resizing)
- Video transcoding and thumbnail generation
- CDN delivery for fast loading
- Generous free tier (25GB storage, 25GB bandwidth/month)
- Supports signed URLs for temporary access
- Easy media management and deletion

**Alternative:** AWS S3 + CloudFront (if Cloudinary limits are exceeded)

### File Limits (Based on User Selection)

- **Images:** Max 5 files, 5MB each (~25MB total)
- **Videos:** Max 2 files, 5MB each (~10MB total)
- **Total per report:** ~35MB maximum

**File Types:**
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.mov`, `.webm` (`.avi` discouraged - browser support poor)

---

## Database Schema Changes

### New Table: CrimeMedia

```sql
CREATE TABLE "CrimeMedia" (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "CrimeId" BIGINT NOT NULL REFERENCES "Crime"(id) ON DELETE CASCADE,
  "publicId" VARCHAR(255) NOT NULL UNIQUE,  -- Cloudinary public ID
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileType" VARCHAR(20) NOT NULL,  -- 'image' or 'video'
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "duration" INTEGER,  -- For videos (seconds)
  "uploadedBy" VARCHAR(255),  -- 'citizen' or 'police'
  "uploadedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "visibility" VARCHAR(20) DEFAULT 'public',  -- 'public' or 'police_only'
  "caption" TEXT,  -- Optional description from citizen or police
  "evidenceMarked" BOOLEAN DEFAULT FALSE  -- Police can mark as evidence
);

CREATE INDEX idx_crime_media_crime_id ON "CrimeMedia"("CrimeId");
CREATE INDEX idx_crime_media_file_type ON "CrimeMedia"("fileType");
CREATE INDEX idx_crime_media_visibility ON "CrimeMedia"("visibility");
```

### Modify Crime Table

```sql
ALTER TABLE "Crime"
ADD COLUMN "mediaCount" INTEGER DEFAULT 0,
ADD COLUMN "thumbnailUrl" TEXT;  -- Primary thumbnail for map view
```

---

## Backend Implementation

### New Files to Create

1. **`config/cloudinaryConfig.js`**
   - Cloudinary SDK initialization
   - Configuration for upload presets, transformations

2. **`config/multerMediaConfig.js`**
   - Multer configuration for multipart uploads
   - File type validation (images + videos)
   - File size limits (5MB per file)

3. **`controllers/mediaController.js`**
   - Upload handler (citizen submission with captions)
   - Media retrieval (filtered by visibility: public only vs all)
   - Media management (police add/remove/replace/visibility toggle)
   - Crime.latestUpdatedBy update on media changes
   - Thumbnail generation
   - Video thumbnail extraction

4. **`models/CrimeMedia.js`**
   - Sequelize model definition
   - Associations with Crime model

5. **`routes/mediaRoutes.js`**
   - `POST /api/media/upload` - Upload files with optional captions
   - `GET /api/media/:id/thumbnail` - Get thumbnail
   - `GET /api/media/crime/:crimeId` - Get media for crime (filtered by user role)
   - `DELETE /api/media/:id` - Delete media (updates Crime.latestUpdatedBy)
   - `PUT /api/media/:id` - Update caption/visibility/evidence flag (updates Crime.latestUpdatedBy)
   - `POST /api/crimes/:crimeId/media` - Add media to existing crime (updates Crime.latestUpdatedBy)
   - `DELETE /api/crimes/:crimeId/media/:mediaId` - Remove from crime (updates Crime.latestUpdatedBy)

### Files to Modify

1. **`models/Crime.js`**
   - Add `mediaCount` and `thumbnailUrl` fields
   - Add association to CrimeMedia model

2. **`models/index.js`**
   - Import and initialize CrimeMedia model

3. **`controllers/CrimeControllers.js`**
   - Modify `reportCrime` to handle media array from request
   - Update `getCrimesForMap` to include thumbnail URLs
   - Update `getPendingSubmissions` to include media
   - Modify `approveCrimeReport` to handle media edits
   - Update `getAllCrimes` to include full media URLs

4. **`routes/userRoutes.js`**
   - Add media upload endpoint

5. **`routes/crimeRoutes.js`**
   - Add media management endpoints for police

---

## Frontend Implementation

### New Components to Create

1. **`src/components/MediaUploader.tsx`**
   - Drag & drop file upload zone
   - File type/size validation
   - Preview thumbnails for selected files
   - Optional caption input for each file
   - Progress indicators for upload
   - Remove file option
   - Error handling and user feedback

2. **`src/components/MediaGallery.tsx`**
   - Grid layout for displaying images/videos
   - Lightbox/modal for full-size viewing
   - Video player component
   - Thumbnail display for videos

3. **`src/components/MediaVisibilityToggle.tsx`**
   - Toggle switch for public/police_only visibility
   - Visual indicator for current visibility setting
   - Tooltip explaining visibility implications

4. **`src/components/PoliceMediaEditor.tsx`**
   - Add new media button
   - Remove media button
   - Replace media option
   - Visibility toggle (public/police_only)
   - Caption editor
   - Mark as evidence toggle
   - Upload progress

### Files to Modify

1. **`src/pages/ReportCrimePage/component/ReportCrimeCard.tsx`**
   - Add MediaUploader component after description field
   - Update form submission to use FormData
   - Track uploaded files in state
   - Validate file counts before submission

2. **`src/pages/MapViewPage/components/CrimeMarkers.tsx`**
   - Add thumbnail display to map popups (public media only)
   - Show media count indicator on markers
   - Display only public visibility media for citizens
   - Display all media for police/admin users

3. **`src/pages/VerificationPage/component/VerificationCard.tsx`**
   - Add MediaGallery component for full media view
   - Add PoliceMediaEditor for verification workflow
   - Update approval modal to include media review

4. **`src/pages/AllRecordsPage/component/DetailsPopup.tsx`**
   - Add MediaGallery + PoliceMediaEditor
   - Allow media management during record updates

5. **`src/services/api.ts`**
   - Add media upload functions
   - Add media management API calls
   - Support FormData for multipart uploads

6. **`src/pages/MapViewPage/components/types.tsx`**
   - Add thumbnailUrl to Crime interface
   - Add mediaCount field
   - Add media array type definition

---

## API Endpoints Specification

### Upload Endpoints

#### POST /api/media/upload
**Purpose:** Upload files to Cloudinary and create media records

**Request:** multipart/form-data
- `files`: File[] (array of files)
- `captions`: string[] (array of captions, same length as files, optional)
- `crimeId`: number (optional - if uploading after initial submission)

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": 123,
      "publicId": "crimes/abc123",
      "url": "https://res.cloudinary.com/...",
      "thumbnailUrl": "https://res.cloudinary.com/.../w_200,h_200/",
      "fileType": "image",
      "originalName": "evidence.jpg",
      "fileSize": 2048576,
      "visibility": "public",
      "caption": "Damage to property front entrance"
    }
  ]
}
```

**Authentication:** Citizen (Supabase) or Police (JWT)

**Validation:**
- Max 5 images + 2 videos per request
- Max 5MB per file
- Allowed mime types only
- Captions array length must match files array length if provided

### Media Retrieval Endpoints

#### GET /api/media/:id/thumbnail
**Purpose:** Get thumbnail for map view (public)

**Response:** Redirect to Cloudinary URL

#### GET /api/media/crime/:crimeId
**Purpose:** Get all media for a crime, filtered by user role

**Authentication:** Optional (public) or Police JWT

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": 123,
      "fileType": "image",
      "thumbnailUrl": "https://...",
      "url": "https://...",
      "visibility": "public",
      "caption": "Scene description"
    }
  ]
}
```

**Behavior:**
- Public users: Only returns media with `visibility = 'public'`
- Police/Admin: Returns all media regardless of visibility

### Media Management (Police Only)

#### POST /api/crimes/:crimeId/media
**Purpose:** Add additional media to existing crime report

**Request:** multipart/form-data with files and optional captions

**Authentication:** Police JWT

**Side Effect:** Updates `Crime.latestUpdatedBy` with police user ID

#### DELETE /api/crimes/:crimeId/media/:mediaId
**Purpose:** Remove media from crime report

**Authentication:** Police JWT

**Side Effect:** Updates `Crime.latestUpdatedBy` with police user ID

#### PUT /api/media/:id
**Purpose:** Update media metadata

**Request Body:**
```json
{
  "caption": "Updated description",
  "visibility": "police_only",
  "evidenceMarked": true
}
```

**Authentication:** Police JWT

**Side Effect:** Updates `Crime.latestUpdatedBy` with police user ID

#### DELETE /api/media/:id
**Purpose:** Delete media file completely

**Authentication:** Police JWT

**Side Effect:** Updates `Crime.latestUpdatedBy` with police user ID

---

## User Experience Flow

### Citizen Submission Flow

1. **On Report Crime Page:**
   - User fills out crime details (existing fields)
   - New "Attach Evidence" section with drag-drop zone
   - Helper text: "Add up to 5 images and 2 videos (max 5MB each)"
   - User sees preview of selected files with remove buttons
   - Each file has optional caption input field
   - File count indicator: "3/5 images, 1/2 videos"
   - Note: "All media will be visible to public by default"

2. **File Selection:**
   - User drags files OR clicks to browse
   - Immediate validation feedback (type/size errors)
   - Image previews shown instantly
   - Videos show first frame thumbnail
   - Each file has remove button and caption input
   - Caption placeholder: "Describe this image/video (optional)"

3. **Submission:**
   - Files and captions upload together with progress bars
   - Form disabled during upload
   - Success confirmation with file count
   - Backend creates CrimeMedia records with visibility='public' and provided captions

### Police Verification Flow

1. **Viewing Pending Report:**
   - VerificationCard shows media gallery section
   - All images/videos visible at full resolution
   - Each item shows: caption, visibility badge, edit options
   - "Evidence" badge shown if marked

2. **Verification Actions:**
   - Can add new media via "Add Evidence" button (with caption)
   - Can remove inappropriate content
   - Can replace blurry images
   - Can toggle visibility: Public ↔ Police Only
   - Can edit captions
   - Can mark items as "official evidence"
   - All actions trigger Crime.latestUpdatedBy update

3. **Approval Process:**
   - ConfirmationPopup includes media review with visibility toggles
   - Final chance to adjust visibility before approval
   - Media with visibility='public' will appear on public map
   - Media with visibility='police_only' only visible to police/admin
   - Media becomes part of approved record

### Public View Flow

1. **Map View (Citizens):**
   - Crime markers show small image icon if public media present
   - Popup shows thumbnails of public visibility media only
   - Shows captions provided by citizen
   - No indication of police-only media existence
   - All media fully accessible (no blur)

2. **Map View (Police/Admin):**
   - Crime markers show total media count
   - Popup shows all media regardless of visibility
   - Visibility badges shown: "Public" or "Police Only"
   - Can toggle visibility directly from map view
   - All actions update Crime.latestUpdatedBy

3. **Statistics:**
   - No change - aggregates only

### Updating Approved Crimes

1. **Police Edit Flow:**
   - Opening DetailsPopup shows all media
   - Can add new media with captions
   - Can remove existing media
   - Can change visibility of any media
   - Can edit captions
   - Each change updates Crime.latestUpdatedBy
   - Changes immediately reflect on map (public sees new public media)

2. **Crime Deletion:**
   - When Crime is soft-deleted (status='deleted')
   - All associated CrimeMedia records cascade deleted
   - Cloudinary files deleted via webhook or cleanup job

---

## Security & Privacy

1. **Access Control:**
   - Public media: Accessible via standard URLs (no authentication required)
   - Police-only media: JWT-required for access, filtered from public queries
   - Original uploads: Protected by Cloudinary auto-access rules
   - Visibility enforcement: Server-side filtering prevents unauthorized access

2. **Content Moderation:**
   - Police can change visibility from public to police-only
   - Police can remove inappropriate content
   - All media logged to UploadLog table
   - Audit trail: who uploaded, when, visibility changes, and deletions

3. **Data Privacy:**
   - Original filenames stored but not displayed publicly
   - EXIF data stripped from images on upload
   - No facial recognition or biometric tagging
   - Citizens cannot change visibility after submission (police control only)

4. **Audit Trail:**
   - Crime.latestUpdatedBy tracks all media additions/deletes/visibility changes
   - Each media record has uploadedBy field ('citizen' or 'police')
   - Visibility changes logged with timestamp and police user ID

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Set up Cloudinary account and configuration
- Create CrimeMedia table with visibility field (migration)
- Implement CrimeMedia model with associations
- Create mediaController scaffold
- Set up multer media config
- Add mediaCount, thumbnailUrl fields to Crime model

### Phase 2: Upload Functionality (Week 2)
- Implement `/api/media/upload` endpoint with caption support
- Create MediaUploader frontend component with caption inputs
- Update ReportCrimeCard to include media upload and captions
- Implement file validation (type, size, count)
- Add upload progress indicators
- Test end-to-end citizen submission with captions

### Phase 3: Display & Retrieval (Week 2)
- Implement `/api/media/crime/:crimeId` with role-based filtering
- Create MediaGallery component
- Create MediaVisibilityToggle component
- Update CrimeMarkers for map display with visibility filtering
- Update VerificationCard for police view
- Test public vs police access control

### Phase 4: Police Media Management (Week 3)
- Implement add/remove/replace endpoints with Crime.latestUpdatedBy updates
- Implement visibility toggle endpoint
- Create PoliceMediaEditor component with visibility toggle
- Update VerificationCard approval flow with visibility controls
- Update DetailsPopup for existing records with visibility management
- Implement evidence marking
- Test Crime.latestUpdatedBy updates on all media changes
- Test cascade delete on crime deletion

### Phase 5: Integration & Testing (Week 3)
- Update API responses across all endpoints
- Add media to crime detail responses with visibility filtering
- Comprehensive testing:
  - Multi-file uploads with captions
  - Visibility toggle functionality
  - Crime.latestUpdatedBy tracking verification
  - Cascade delete on crime soft-delete
  - Large file handling
  - Error scenarios
  - Access control verification
  - Mobile responsiveness

---

## Critical Files Summary

### Backend Files to Create:
- `config/cloudinaryConfig.js`
- `config/multerMediaConfig.js`
- `controllers/mediaController.js`
- `models/CrimeMedia.js`
- `routes/mediaRoutes.js`

### Backend Files to Modify:
- `models/Crime.js` - Add mediaCount, thumbnailUrl
- `models/index.js` - Import CrimeMedia
- `controllers/CrimeControllers.js` - Update reportCrime, getCrimesForMap, getPendingSubmissions
- `routes/userRoutes.js` - Add upload endpoint
- `routes/crimeRoutes.js` - Add media management

### Frontend Files to Create:
- `src/components/MediaUploader.tsx` - With caption inputs
- `src/components/MediaGallery.tsx` - Role-based display
- `src/components/MediaVisibilityToggle.tsx` - Public/Police toggle
- `src/components/PoliceMediaEditor.tsx` - Full edit with visibility

### Frontend Files to Modify:
- `src/pages/ReportCrimePage/component/ReportCrimeCard.tsx` - Add upload with captions
- `src/pages/MapViewPage/components/CrimeMarkers.tsx` - Add visibility-filtered display
- `src/pages/MapViewPage/components/types.tsx` - Update interfaces with visibility field
- `src/pages/VerificationPage/component/VerificationCard.tsx` - Add gallery with visibility controls
- `src/pages/AllRecordsPage/component/DetailsPopup.tsx` - Add editor with visibility toggle
- `src/services/api.ts` - Add media functions with visibility support

---

## Verification Plan

### Manual Testing Checklist

**Citizen Submission:**
- [ ] Upload 1 image successfully with caption
- [ ] Upload 5 images successfully with captions
- [ ] Attempt 6th image - rejected
- [ ] Upload 1 video successfully with caption
- [ ] Upload 2 videos successfully with captions
- [ ] Attempt 3rd video - rejected
- [ ] Attempt file > 5MB - rejected with error
- [ ] Attempt invalid file type - rejected
- [ ] Remove file before submission works
- [ ] Drag & drop works
- [ ] File browser works
- [ ] Caption input works (optional field)
- [ ] Progress bars show correctly
- [ ] Submit without media works (optional)
- [ ] All uploads default to visibility='public'

**Police Verification:**
- [ ] View pending report - media visible
- [ ] View pending report - thumbnails correct
- [ ] Add new media during verification with caption
- [ ] Remove media during verification
- [ ] Replace media during verification
- [ ] Toggle visibility from public to police_only
- [ ] Toggle visibility from police_only to public
- [ ] Edit caption works
- [ ] Mark as evidence toggle works
- [ ] Approval includes media changes
- [ ] Rejection still preserves media (for audit)
- [ ] Crime.latestUpdatedBy updated on media changes
- [ ] Crime.latestUpdatedBy unchanged if no media changes

**Public View (Citizens):**
- [ ] Map shows thumbnail icon for crimes with public media
- [ ] Popup shows only public visibility media
- [ ] Police-only media not visible on public map
- [ ] No indication of police-only media existence
- [ ] Captions displayed for public media
- [ ] No blur applied (clear thumbnails)

**Public View (Police/Admin):**
- [ ] Map shows all media (public + police_only)
- [ ] Visibility badges shown on each media item
- [ ] Can toggle visibility from map view
- [ ] All actions update Crime.latestUpdatedBy

**Crime Deletion:**
- [ ] Soft-delete crime triggers media cascade delete
- [ ] Cloudinary files removed via cleanup
- [ ] Media count updated correctly

**Edge Cases:**
- [ ] Upload then edit form - files and captions preserved
- [ ] Network error during upload - graceful handling
- [ ] Invalid Cloudinary response - error shown
- [ ] Database error - upload rolled back
- [ ] Concurrent uploads - handled correctly
- [ ] Mobile upload - works on mobile devices
- [ ] Empty caption submits successfully
- [ ] Long caption handled correctly

**Performance:**
- [ ] Large file uploads don't block UI
- [ ] Thumbnail generation completes quickly
- [ ] Map performance unaffected by visibility filtering
- [ ] Multiple concurrent uploads work

### API Testing

Use Postman/Thunder Client:
```bash
# Upload media with captions
POST /api/media/upload
- Upload single image with caption
- Upload multiple images with captions
- Upload video with caption
- Upload mixed files with captions
- Verify visibility defaults to 'public'

# Test retrieval (public)
GET /api/media/:id/thumbnail
GET /api/media/crime/:crimeId (no auth - only public media returned)

# Test retrieval (police)
GET /api/media/crime/:crimeId (with police JWT - all media returned)

# Test visibility management
PUT /api/media/:id
- Toggle visibility: public ↔ police_only
- Update caption
- Mark as evidence

# Test management
POST /api/crimes/:crimeId/media
DELETE /api/crimes/:crimeId/media/:mediaId
DELETE /api/media/:id

# Verify Crime.latestUpdatedBy
- Check Crime record before and after media operations
- Verify latestUpdatedBy updated after add/remove/visibility change
```

### Database Verification

```sql
-- Check media was created
SELECT * FROM "CrimeMedia" WHERE "CrimeId" = ?;

-- Verify media count updated
SELECT "mediaCount", "thumbnailUrl" FROM "Crime" WHERE id = ?;

-- Check cascade delete works
DELETE FROM "Crime" WHERE id = ?;
-- Verify CrimeMedia records deleted
```

### Cloudinary Dashboard Verification

- Check Media Library for uploaded files
- Verify transformations applied
- Check storage usage
- Verify auto-access rules working

---

## Dependencies

### New Backend Dependencies
```json
{
  "cloudinary": "^2.0.0",
  "multer": "^2.0.2"  // Already installed, just new config
}
```

### New Frontend Dependencies
```json
{
  "react-image-gallery": "^1.3.0",  // Optional - for gallery view
  "yet-another-react-lightbox": "^3.15.0"  // Optional - for lightbox
}
```

---

## Rollout Plan

1. **Development:** Implement in dev environment with Cloudinary test account
2. **Staging:** Test with sample data, verify all flows
3. **Production:**
   - Run database migration during maintenance window
   - Deploy backend with Cloudinary production credentials
   - Deploy frontend with new components
   - Monitor Cloudinary usage and costs
   - Have rollback plan ready (media columns are optional)

---

## Cost Considerations

### Cloudinary Free Tier
- 25GB storage
- 25GB bandwidth/month
- Should handle ~500-1000 crime reports with media

### Estimated Costs (if exceeded)
- Storage: ~$0.015/GB/month after free tier
- Bandwidth: ~$0.01/GB after free tier
- Transformations: 1000 free/month, then ~$0.001/transform

### Monitoring
- Track storage usage daily
- Alert at 80% of free tier
- Consider monthly cleanup of rejected/deleted crime media

---

## Future Enhancements (Out of Scope)

- Video thumbnail extraction at specific timestamps
- Image editing (crop, rotate) before upload
- PDF document support
- Audio recording support
- Bulk media operations
- Media expiration/auto-deletion
- Advanced image analysis (AI detection)
- Multi-language support for captions
- Citizen ability to edit visibility after submission
- Visibility expiry (auto-change to police_only after time period)
