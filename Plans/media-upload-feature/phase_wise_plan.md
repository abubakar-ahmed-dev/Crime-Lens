# Media Upload Feature - Phase Wise Implementation Plan

## Feature Overview
Add optional image/video upload functionality to crime report submissions with visibility-based access control, citizen caption input, and comprehensive police media management.

## Phase Structure
This implementation is broken down into 12 micro-phases designed for parallel execution where possible, with clear dependencies and separation of concerns.

---

## Phase 1: Cloudinary Setup & Configuration
**Status:** Remaining
**Type:** Manual/Backend
**Dependencies:** None
**Parallelizable:** No (blocks all media upload phases)

### Backend Tasks
- [ ] Create Cloudinary account
- [ ] Create upload preset with transformations
- [ ] Generate API keys (upload from .env)
- [ ] Document environment variables needed

### Deliverables
- Cloudinary credentials documented
- Upload preset configured
- Environment variable requirements known

---

## Phase 2: Database Schema Migration
**Status:** Remaining
**Type:** Database/Backend
**Dependencies:** None
**Parallelizable:** Yes (with Phase 1)

### Database Tasks
- [ ] Create CrimeMedia table SQL migration script
- [ ] Add mediaCount, thumbnailUrl columns to Crime table
- [ ] Create indexes for CrimeMedia
- [ ] Test migration on development database
- [ ] Document rollback procedure

### SQL Schema
```sql
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
  "evidenceMarked" BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_crime_media_crime_id ON "CrimeMedia"("CrimeId");
CREATE INDEX idx_crime_media_file_type ON "CrimeMedia"("fileType");
CREATE INDEX idx_crime_media_visibility ON "CrimeMedia"("visibility");

ALTER TABLE "Crime"
ADD COLUMN "mediaCount" INTEGER DEFAULT 0,
ADD COLUMN "thumbnailUrl" TEXT;
```

### Deliverables
- Migration script created
- Migration tested on dev database
- Rollback script documented

---

## Phase 3: Backend Models & Associations
**Status:** Remaining
**Type:** Backend
**Dependencies:** Phase 2 (database migration)
**Parallelizable:** No

### Backend Tasks
- [ ] Create `models/CrimeMedia.js` Sequelize model
- [ ] Add associations to Crime model
- [ ] Update `models/Crime.js` with mediaCount and thumbnailUrl
- [ ] Update `models/index.js` to import CrimeMedia
- [ ] Add cascade delete configuration
- [ ] Test model creation and associations

### CrimeMedia Model Structure
```javascript
// Key fields to implement
- id, CrimeId, publicId, originalName
- mimeType, fileSize, fileType
- url, thumbnailUrl, width, height, duration
- uploadedBy, uploadedAt, visibility, caption
- evidenceMarked

// Associations
Crime.hasMany(CrimeMedia, { onDelete: 'CASCADE' })
CrimeMedia.belongsTo(Crime)
```

### Deliverables
- CrimeMedia model created
- Crime model updated
- Associations configured
- Model tested successfully

---

## Phase 4: Multer Media Configuration
**Status:** Remaining
**Type:** Backend
**Dependencies:** None
**Parallelizable:** Yes (with Phases 1-3)

### Backend Tasks
- [ ] Create `config/multerMediaConfig.js`
- [ ] Configure file type validation (images + videos)
- [ ] Set file size limits (5MB per file)
- [ ] Configure memory storage with Cloudinary stream
- [ ] Add error handling for invalid files
- [ ] Test upload configuration

### File Type Validation
```javascript
const allowedMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
```

### Deliverables
- Multer media config created
- File validation implemented
- Error handling tested

---

## Phase 5: Cloudinary Service Integration
**Status:** Remaining
**Type:** Backend
**Dependencies:** Phase 1 (Cloudinary setup), Phase 4 (Multer config)
**Parallelizable:** No

### Backend Tasks
- [ ] Create `config/cloudinaryConfig.js`
- [ ] Configure Cloudinary SDK
- [ ] Implement upload function with transformations
- [ ] Implement thumbnail generation
- [ ] Implement video thumbnail extraction
- [ ] Implement delete function
- [ ] Add error handling for Cloudinary API failures

### Cloudinary Transformations
```javascript
// Thumbnail transformations
- Images: w_200,h_200,c_fill
- Videos: generate first frame thumbnail

// Upload options
- folder: 'crimes/{crimeId}'
- resource_type: 'auto'
- allowed_formats: ['jpg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm']
```

### Deliverables
- Cloudinary config created
- Upload function implemented
- Thumbnail generation working
- Delete function implemented

---

## Phase 6: Media Controller Implementation
**Status:** Remaining
**Type:** Backend
**Dependencies:** Phase 3 (models), Phase 5 (Cloudinary)
**Parallelizable:** No

### Backend Tasks
- [ ] Create `controllers/mediaController.js`
- [ ] Implement `uploadMedia` function (with captions)
- [ ] Implement `getCrimeMedia` function (visibility filtered)
- [ ] Implement `updateMedia` function (visibility, caption)
- [ ] Implement `deleteMedia` function (updates Crime.latestUpdatedBy)
- [ ] Implement `addMediaToCrime` function (updates Crime.latestUpdatedBy)
- [ ] Implement `removeMediaFromCrime` function (updates Crime.latestUpdatedBy)
- [ ] Add file count validation (5 images, 2 videos)
- [ ] Add comprehensive error handling
- [ ] Test all controller functions

### Controller Functions Specification
```javascript
// uploadMedia(files, captions, crimeId, userId)
- Validates file counts
- Uploads to Cloudinary
- Creates CrimeMedia records with visibility='public'
- Updates Crime.mediaCount and Crime.thumbnailUrl
- Returns media array with IDs

// getCrimeMedia(crimeId, userRole)
- Filters by visibility if userRole is not police/admin
- Returns public-only for citizens
- Returns all for police/admin

// updateMedia(mediaId, updates, userId)
- Updates visibility, caption, evidenceMarked
- Updates Crime.latestUpdatedBy with userId
- Returns updated media

// deleteMedia(mediaId, userId)
- Deletes from Cloudinary
- Deletes from database
- Updates Crime.mediaCount and thumbnailUrl
- Updates Crime.latestUpdatedBy with userId
```

### Deliverables
- Media controller created
- All CRUD functions implemented
- Crime.latestUpdatedBy integration tested
- Error handling comprehensive

---

## Phase 7: Media Routes Implementation
**Status:** Remaining
**Type:** Backend
**Dependencies:** Phase 6 (controller)
**Parallelizable:** No

### Backend Tasks
- [ ] Create `routes/mediaRoutes.js`
- [ ] Add `POST /api/media/upload` endpoint
- [ ] Add `GET /api/media/crime/:crimeId` endpoint
- [ ] Add `GET /api/media/:id/thumbnail` endpoint
- [ ] Add `PUT /api/media/:id` endpoint
- [ ] Add `DELETE /api/media/:id` endpoint
- [ ] Add `POST /api/crimes/:crimeId/media` endpoint
- [ ] Add `DELETE /api/crimes/:crimeId/media/:mediaId` endpoint
- [ ] Integrate authentication middleware
- [ ] Add request validation
- [ ] Test all endpoints with Postman

### Route Specifications
```javascript
// Public routes (no auth)
GET /api/media/:id/thumbnail - Public thumbnail access

// Citizen routes (Supabase auth)
POST /api/media/upload - Upload with captions
GET /api/media/crime/:crimeId - Get public media only

// Police routes (JWT auth)
PUT /api/media/:id - Update visibility, caption
DELETE /api/media/:id - Delete media
POST /api/crimes/:crimeId/media - Add to crime
DELETE /api/crimes/:crimeId/media/:mediaId - Remove from crime
```

### Deliverables
- Media routes created
- All endpoints implemented
- Authentication integrated
- Testing completed

---

## Phase 8: Update Crime Controllers for Media Integration
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Backend
**Dependencies:** Phase 3 (models), Phase 6 (media controller)
**Parallelizable:** Yes (with Phase 7)

### Backend Tasks
- [x] Update `reportCrime` to handle media array
- [x] Update `getCrimesForMap` to include thumbnailUrl
- [x] Update `getCrimesForMap` to filter media by visibility for public
- [x] Update `getPendingSubmissions` to include media
- [x] Update `approveCrimeReport` to handle media edits
- [x] Update `getAllCrimes` to include full media URLs
- [x] Update `updateCrime` to handle media changes
- [x] Update `deleteCrime` to handle media cascade
- [x] Test all updated functions

### Function Updates
```javascript
// reportCrime enhancements
- Accept mediaFiles array with captions
- Create CrimeMedia records with visibility='public'
- Update Crime.mediaCount and thumbnailUrl

// getCrimesForMap enhancements
- Include thumbnailUrl in response
- For public: filter media to visibility='public' only
- For police/admin: include all media

// approveCrimeReport enhancements
- Handle media visibility changes
- Handle caption updates
- Handle new media additions
- Update Crime.latestUpdatedBy

// updateCrime enhancements
- Update Crime.latestUpdatedBy on media changes
- Handle media operations in transaction

// deleteCrime enhancements
- Verify cascade delete of CrimeMedia
```

### Deliverables
- Crime controllers updated
- Media integration tested
- LatestUpdatedBy tracking verified

---

## Phase 9: Frontend Type Definitions & Interfaces
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Frontend
**Dependencies:** Phase 3 (backend models)
**Parallelizable:** Yes (with backend phases)

### Frontend Tasks
- [x] Update `src/pages/MapViewPage/components/types.tsx`
- [x] Add CrimeMedia interface
- [x] Add visibility field to Crime interface
- [x] Add mediaCount field to Crime interface
- [x] Add thumbnailUrl field to Crime interface
- [x] Create media-related types for API responses
- [x] Update other type files as needed

### Type Definitions
```typescript
interface CrimeMedia {
  id: number;
  CrimeId: number;
  publicId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  uploadedBy: 'citizen' | 'police';
  uploadedAt: string;
  visibility: 'public' | 'police_only';
  caption?: string;
  evidenceMarked: boolean;
}

interface Crime {
  // existing fields...
  mediaCount?: number;
  thumbnailUrl?: string;
  media?: CrimeMedia[];
}
```

### Deliverables
- Type definitions updated
- Interfaces created
- Type safety ensured

---

## Phase 10: Frontend API Service Layer
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Frontend
**Dependencies:** Phase 7 (routes), Phase 9 (types)
**Parallelizable:** No

### Frontend Tasks
- [x] Update `src/services/api.ts`
- [x] Add uploadMedia function (FormData support)
- [x] Add getCrimeMedia function
- [x] Add updateMedia function
- [x] Add deleteMedia function
- [x] Add addMediaToCrime function
- [x] Add removeMediaFromCrime function
- [x] Add proper error handling
- [x] Add FormData building helpers
- [x] Test all API functions

### API Service Functions
```typescript
// uploadMedia(files: File[], captions: string[], crimeId?: number)
- Build FormData with files and captions
- Handle multipart upload
- Return created media array

// getCrimeMedia(crimeId: number, userRole?: string)
- Fetch media for crime
- Automatically filter by role if specified

// updateMedia(mediaId: number, updates: MediaUpdate)
- Update visibility, caption, evidenceMarked
- Handle Crime.latestUpdatedBy update

// deleteMedia(mediaId: number)
- Delete media and update Crime
- Handle cascade
```

### Deliverables
- API service updated
- All media functions implemented
- FormData handling working
- Error handling comprehensive

---

## Phase 11: Frontend Core Components Implementation
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Frontend
**Dependencies:** Phase 9 (types), Phase 10 (API)
**Parallelizable:** No

### Frontend Tasks
- [x] Create `src/components/MediaUploader.tsx`
  - Drag & drop functionality
  - File type/size validation
  - Image/video previews
  - Caption inputs for each file
  - Remove file buttons
  - Upload progress indicators
  - Error handling

- [x] Create `src/components/MediaGallery.tsx`
  - Grid layout for images/videos
  - Lightbox for full-size viewing
  - Video player component
  - Caption display
  - Responsive design

- [x] Create `src/components/MediaVisibilityToggle.tsx`
  - Toggle switch for public/police_only
  - Visual indicator of current state
  - Tooltip explaining implications
  - Smooth animations

- [x] Create `src/components/PoliceMediaEditor.tsx`
  - Add new media button
  - Remove media buttons
  - Visibility toggles for each item
  - Caption editors
  - Evidence marking toggles
  - Upload progress
  - Error handling

### Component Specifications
```typescript
// MediaUploader Props
interface MediaUploaderProps {
  onFilesSelected: (files: FileWithCaption[]) => void;
  maxImages?: number;
  maxVideos?: number;
  maxFileSize?: number;
  disabled?: boolean;
}

interface FileWithCaption {
  file: File;
  caption: string;
  preview: string;
}

// MediaGallery Props
interface MediaGalleryProps {
  media: CrimeMedia[];
  userRole: 'citizen' | 'police' | 'admin';
  onMediaUpdate?: (mediaId: number, updates: MediaUpdate) => void;
  onMediaDelete?: (mediaId: number) => void;
  editable?: boolean;
}

// MediaVisibilityToggle Props
interface MediaVisibilityToggleProps {
  visibility: 'public' | 'police_only';
  onVisibilityChange: (newVisibility: 'public' | 'police_only') => void;
  disabled?: boolean;
}
```

### Deliverables
- All core components created
- Components fully functional
- Responsive design implemented
- Accessibility features added

---

## Phase 12: Frontend Page Integration - Crime Submission
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Frontend
**Dependencies:** Phase 11 (components)
**Parallelizable:** No

### Frontend Tasks
- [x] Update `src/pages/ReportCrimePage/component/ReportCrimeCard.tsx`
- [x] Add MediaUploader component to form
- [x] Position after description field
- [x] Update form state to handle files with captions
- [x] Update form validation for file counts
- [x] Update form submission to use FormData
- [x] Add upload progress tracking
- [x] Add error handling for upload failures
- [x] Test complete submission flow
- [x] Test submission without media (optional)

### Integration Details
```typescript
// State Management
const [mediaFiles, setMediaFiles] = useState<FileWithCaption[]>([]);
const [uploadProgress, setUploadProgress] = useState<number>(0);

// Validation
const validateMediaFiles = () => {
  const images = mediaFiles.filter(f => f.file.type.startsWith('image/'));
  const videos = mediaFiles.filter(f => f.file.type.startsWith('video/'));

  if (images.length > 5) return { valid: false, error: 'Max 5 images allowed' };
  if (videos.length > 2) return { valid: false, error: 'Max 2 videos allowed' };

  return { valid: true };
};

// Form Submission
const handleSubmit = async () => {
  const formData = new FormData();
  // Add existing form fields...
  formData.append('crimeTypeId', crimeTypeId);
  // ... other fields

  // Add media files with captions
  mediaFiles.forEach((fileWithCaption, index) => {
    formData.append('files', fileWithCaption.file);
    formData.append('captions', fileWithCaption.caption || '');
  });

  await submitCrimeReport(formData);
};
```

### Deliverables
- ReportCrimeCard updated
- Media upload integrated
- Form submission updated
- Complete flow tested

---

## Phase 13: Frontend Page Integration - Map View
**Status:** ✅ COMPLETED (2026-08-21)
**Type:** Frontend
**Dependencies:** Phase 11 (components)
**Parallelizable:** Yes (with Phase 12)

### Frontend Tasks
- [x] Update `src/pages/MapViewPage/components/CrimeMarkers.tsx`
- [x] Add media indicator to markers
- [x] Add thumbnail display to popups
- [x] Filter media by visibility for citizens
- [x] Show all media for police/admin
- [x] Add media count badges
- [x] Add visibility badges for police
- [x] Update popup layout for thumbnails
- [x] Test public view (public media only)
- [x] Test police view (all media)

### Integration Details
```typescript
// Component Updates
const CrimeMarkerPopup = ({ crime, userRole }) => {
  const publicMedia = crime.media?.filter(m => m.visibility === 'public');
  const displayMedia = userRole === 'citizen' ? publicMedia : crime.media;

  return (
    <Popup>
      {/* existing content */}
      {displayMedia && displayMedia.length > 0 && (
        <div className="media-section">
          <div className="media-count">
            {displayMedia.length} media item{displayMedia.length !== 1 ? 's' : ''}
          </div>
          {userRole !== 'citizen' && (
            <div className="visibility-info">
              Public: {publicMedia.length} | Police: {crime.media.length - publicMedia.length}
            </div>
          )}
          <MediaGallery media={displayMedia} userRole={userRole} />
        </div>
      )}
    </Popup>
  );
};
```

### Deliverables
- CrimeMarkers updated
- Thumbnail display working
- Visibility filtering tested
- User role handling verified

---

## Phase 14: Frontend Page Integration - Verification
**Status:** Remaining
**Type:** Frontend
**Dependencies:** Phase 11 (components)
**Parallelizable:** Yes (with Phases 12-13)

### Frontend Tasks
- [ ] Update `src/pages/VerificationPage/component/VerificationCard.tsx`
- [ ] Add MediaGallery for full media display
- [ ] Add PoliceMediaEditor for verification workflow
- [ ] Update approval modal to include media review
- [ ] Add visibility toggle controls
- [ ] Add caption editing
- [ ] Update form state to handle media changes
- [ ] Update approval submission to include media updates
- [ ] Test complete verification flow
- [ ] Test rejection preserves media

### Integration Details
```typescript
// State Management
const [mediaChanges, setMediaChanges] = useState({
  toRemove: [],
  visibilityChanges: {},
  captionUpdates: {}
});

// Verification Actions
const handleVisibilityToggle = (mediaId: number) => {
  setMediaChanges(prev => ({
    ...prev,
    visibilityChanges: {
      ...prev.visibilityChanges,
      [mediaId]: !prev.visibilityChanges[mediaId] // Toggle
    }
  }));
};

const handleApproval = async () => {
  await approveCrimeReport(submissionId, {
    // existing fields...
    mediaUpdates: mediaChanges
  });
};
```

### Deliverables
- VerificationCard updated
- Media gallery integrated
- Police editor working
- Approval flow updated
- Complete flow tested

---

## Phase 15: Frontend Page Integration - Records Management
**Status:** Remaining
**Type:** Frontend
**Dependencies:** Phase 11 (components)
**Parallelizable:** Yes (with Phases 12-14)

### Frontend Tasks
- [ ] Update `src/pages/AllRecordsPage/component/DetailsPopup.tsx`
- [ ] Add MediaGallery for approved crimes
- [ ] Add PoliceMediaEditor for edit mode
- [ ] Update crime update form to handle media operations
- [ ] Add visibility management for approved crimes
- [ ] Update Crime.latestUpdatedBy tracking
- [ ] Test media addition to approved crimes
- [ ] Test media removal from approved crimes
- [ ] Test visibility changes
- [ ] Test caption updates

### Integration Details
```typescript
// Edit Mode Integration
const [editMode, setEditMode] = useState(false);
const [mediaOperations, setMediaOperations] = useState({
  toAdd: [],
  toRemove: [],
  toUpdate: {}
});

const handleUpdateCrime = async () => {
  await updateCrime(crimeId, {
    // existing fields...
    media: mediaOperations
  });
  // Verify Crime.latestUpdatedBy updated
};
```

### Deliverables
- DetailsPopup updated
- Media management working
- LatestUpdatedBy verified
- Complete flow tested

---

## Phase 16: Frontend Page Integration - Citizen Dashboard
**Status:** Remaining
**Type:** Frontend
**Dependencies:** Phase 11 (components)
**Parallelizable:** Yes (with Phases 12-15)

### Frontend Tasks
- [ ] Update citizen dashboard to show media previews
- [ ] Add media count to crime report cards
- [ ] Add thumbnail indicators
- [ ] Update "My Reports" to show media status
- [ ] Test citizen view of submitted reports
- [ ] Verify media visibility is public by default

### Deliverables
- Citizen dashboard updated
- Media previews working
- User experience tested

---

## Phase 17: End-to-End Testing & Bug Fixes
**Status:** Remaining
**Type:** Testing
**Dependencies:** Phases 1-16 (all implementation)
**Parallelizable:** No

### Testing Tasks

#### Citizen Submission Flow
- [ ] Test single image upload with caption
- [ ] Test multiple image uploads with captions
- [ ] Test video upload with caption
- [ ] Test mixed media uploads
- [ ] Test file count validation (6th image rejected)
- [ ] Test file size validation (>5MB rejected)
- [ ] Test file type validation (invalid types rejected)
- [ ] Test caption with special characters
- [ ] Test empty caption (optional field)
- [ ] Test remove file before submission
- [ ] Test drag & drop functionality
- [ ] Test file browser functionality
- [ ] Test upload progress indicators
- [ ] Test submission without media
- [ ] Verify visibility defaults to 'public'
- [ ] Test network error handling
- [ ] Test upload timeout handling

#### Police Verification Flow
- [ ] Test view pending report with media
- [ ] Test add new media with caption
- [ ] Test remove media during verification
- [ ] Test replace media functionality
- [ ] Test toggle visibility public → police_only
- [ ] Test toggle visibility police_only → public
- [ ] Test edit caption
- [ ] Test mark as evidence toggle
- [ ] Test approval with media changes
- [ ] Test rejection preserves media
- [ ] Verify Crime.latestUpdatedBy updated
- [ ] Test visibility changes reflected immediately
- [ ] Test concurrent media operations

#### Public Map Flow
- [ ] Test map shows public media thumbnails
- [ ] Test popup displays only public media (citizens)
- [ ] Test popup displays all media (police)
- [ ] Test visibility badges shown (police only)
- [ ] Test media count indicators
- [ ] Test captions displayed correctly
- [ ] Test no indication of police-only media (citizens)
- [ ] Test thumbnail quality and loading
- [ ] Test zoom functionality for images
- [ ] Test video playback in gallery

#### Crime Deletion Flow
- [ ] Test soft-delete triggers media cascade
- [ ] Verify Cloudinary files deleted
- [ ] Verify mediaCount updated
- [ ] Verify thumbnailUrl cleared
- [ ] Test database cleanup

#### Access Control
- [ ] Test public cannot access police-only media URLs
- [ ] test police can access all media
- [ ] Test visibility filtering on API endpoints
- [ ] Test authentication required for operations
- [ ] Test authorization checks (police only endpoints)

#### Performance & Edge Cases
- [ ] Test large file upload doesn't block UI
- [ ] Test concurrent uploads handling
- [ ] Test map performance with many thumbnails
- [ ] Test mobile responsiveness
- [ ] Test slow network conditions
- [ ] Test invalid Cloudinary responses
- [ ] Test database error handling
- [ ] Test transaction rollback on errors

### Bug Fixes
- [ ] Document any bugs found
- [ ] Fix critical bugs
- [ ] Re-test fixed scenarios
- [ ] Document any known limitations

### Deliverables
- All test scenarios executed
- Critical bugs fixed
- Test report documented
- Known issues documented

---

## Phase 18: Documentation & Deployment Preparation
**Status:** Remaining
**Type:** Documentation/DevOps
**Dependencies:** Phase 17 (testing complete)
**Parallelizable:** No

### Documentation Tasks
- [ ] Update API documentation with media endpoints
- [ ] Create user guide for media upload feature
- [ ] Update database schema documentation
- [ ] Document Cloudinary setup process
- [ ] Create troubleshooting guide
- [ ] Update README with new feature
- [ ] Document environment variables
- [ ] Create deployment checklist

### Deployment Preparation
- [ ] Review all environment variables
- [ ] Create production Cloudinary account/preset
- [ ] Test migration on staging database
- [ ] Prepare rollback procedure
- [ ] Document deployment steps
- [ ] Create monitoring setup for Cloudinary usage
- [ ] Set up alerts for storage/bandwidth limits

### Deliverables
- Complete documentation
- Deployment checklist
- Production Cloudinary configured
- Staging tested
- Rollback procedure documented

---

## Phase 19: Production Deployment & Verification
**Status:** Remaining
**Type:** Deployment
**Dependencies:** Phase 18 (documentation complete)
**Parallelizable:** No

### Deployment Tasks
- [ ] Deploy database migration to production
- [ ] Deploy backend with media endpoints
- [ ] Deploy frontend with media components
- [ ] Update production environment variables
- [ ] Verify Cloudinary connectivity
- [ ] Test upload in production
- [ ] Test map display in production
- [ ] Test police verification in production
- [ ] Monitor Cloudinary usage metrics
- [ ] Verify access controls in production
- [ ] Test rollback procedure (if needed)

### Post-Deployment
- [ ] Monitor error logs for 24 hours
- [ ] Track Cloudinary storage usage
- [ ] Verify user adoption
- [ ] Document any production issues
- [ ] Plan any hotfixes if needed

### Deliverables
- Feature deployed to production
- Production verification complete
- Monitoring active
- Issues documented

---

## Dependency Graph

```
Phase 1 (Cloudinary Setup) ────┐
                              ├──> Phase 5 (Cloudinary Integration)
                              │
Phase 4 (Multer Config) ──────┘

Phase 2 (Database Migration) ───> Phase 3 (Models) ──> Phase 6 (Controller)
                                                                   │
Phase 7 (Routes) <──────────────────────────────────────────────────┘
        │
        └──> Phase 8 (Update Crime Controllers)

Phase 5 + 6 ──> Phase 7 (Routes)

Phase 3 (Backend Models) ──> Phase 9 (Frontend Types)
                                   │
Phase 7 (Backend Routes) ─────> Phase 10 (Frontend API)
                                   │
Phase 9 + 10 ──> Phase 11 (Components) ──> Phases 12-16 (Page Integration)

Phases 12-16 ──> Phase 17 (Testing)

Phase 17 ──> Phase 18 (Documentation)

Phase 18 ──> Phase 19 (Deployment)
```

## Parallel Execution Opportunities

1. **Group 1:** Phase 1 + Phase 2 + Phase 4 (can run simultaneously)
2. **Group 2:** Phase 9 (Frontend Types) + Phase 3 (Backend Models) (after Phase 2)
3. **Group 3:** Phases 12-16 (all page integrations can run in parallel after Phase 11)

## Testing Strategy

### Unit Testing
- Model creation and associations
- Controller functions
- API endpoint responses
- Component rendering
- Form validation

### Integration Testing
- Upload flow end-to-end
- Database operations
- Cloudinary integration
- Authentication/authorization

### User Acceptance Testing
- Complete citizen submission
- Complete police verification
- Public map viewing
- Admin crime management

## Rollback Strategy

If any phase fails:
1. Database changes: Use migration rollback
2. Backend changes: Revert to previous commit
3. Frontend changes: Revert to previous commit
4. Cloudinary: Preserve uploads, disable feature flags
5. Feature can be disabled via environment variables

## Success Criteria

- All 19 phases completed
- All test scenarios passing
- No critical bugs
- Production deployment successful
- Documentation complete
- Team trained on new feature
