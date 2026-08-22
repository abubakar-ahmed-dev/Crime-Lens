# Phase 17 End-to-End Testing Plan

**Phase:** 17 - End-to-End Testing & Bug Fixes
**Status:** 🔄 Ready for Execution (Waiting for Playwright MCP)
**Test Approach:** Semi-Automated with Playwright MCP
**Estimated Duration:** ~95 minutes (6 testing sessions)

---

## Test Environment Setup Checklist

### Required Before Testing:
- [ ] Playwright MCP installed and configured
- [ ] Frontend running at `http://localhost:_____`
- [ ] Backend API running at `http://localhost:_____`
- [ ] Cloudinary configured with upload preset
- [ ] Test accounts ready:
  - Citizen: email=`_________` password=`_________`
  - Police: username=`_________` password=`_________`
- [ ] Sample test files available:
  - Valid images (JPG, PNG, <5MB)
  - Valid videos (MP4, <5MB)
  - Invalid files (>5MB, wrong formats)

---

## Test Group 1: Citizen Submission Flow (17 tests)

### Test Cases:

#### TC-CIT-001: Single Image Upload with Caption
**Pre-conditions:** Citizen logged in, on Report Crime page
**Steps:**
1. Fill all required crime fields
2. Upload 1 image file
3. Add caption "Test evidence image"
4. Submit report
**Expected:** Report submitted successfully, media count = 1
**Playwright Actions:** fillForm, uploadFile, clickSubmit, verifySuccess

#### TC-CIT-002: Multiple Image Uploads (5 images)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload 5 different images
2. Add captions to each
3. Submit report
**Expected:** All 5 images uploaded, media count = 5
**Playwright Actions:** uploadFiles(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg'])

#### TC-CIT-003: File Count Validation (6th image rejected)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload 5 images (allowed)
2. Try to upload 6th image
**Expected:** Error message "Maximum 5 images allowed"
**Playwright Actions:** verifyErrorMessage

#### TC-CIT-004: Video Upload with Caption
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload 1 video file
2. Add caption "Test video evidence"
3. Submit report
**Expected:** Video uploaded successfully, media count = 1
**Playwright Actions:** uploadFile('video.mp4'), verifyMediaType

#### TC-CIT-005: Mixed Media Uploads
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload 2 images + 1 video
2. Submit report
**Expected:** All 3 files uploaded, correct media types
**Playwright Actions:** uploadFiles(['img1.jpg', 'img2.jpg', 'video.mp4'])

#### TC-CIT-006: File Size Validation (>5MB rejected)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload file >5MB
**Expected:** Error message about file size limit
**Playwright Actions:** uploadLargeFile, verifySizeError

#### TC-CIT-007: File Type Validation (invalid types rejected)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload PDF file
2. Upload DOCX file
**Expected:** Error message "File type not supported"
**Playwright Actions:** uploadInvalidFiles, verifyTypeError

#### TC-CIT-008: Caption with Special Characters
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload image
2. Add caption: "Test @#$%^&*() evidence"
3. Submit report
**Expected:** Caption saved with special characters
**Playwright Actions:** addSpecialChars, verifyCaptionSaved

#### TC-CIT-009: Empty Caption (optional field)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload image
2. Leave caption empty
3. Submit report
**Expected:** Report submitted, media saved without caption
**Playwright Actions:** uploadFile, submitWithoutCaption

#### TC-CIT-010: Remove File Before Submission
**Pre-conditions:** Citizen logged in, files selected
**Steps:**
1. Upload 2 images
2. Remove 1 image
3. Submit report
**Expected:** Only 1 image in final report
**Playwright Actions:** uploadFiles, clickRemove, verifyCount

#### TC-CIT-011: Drag & Drop Functionality
**Pre-conditions:** Citizen logged in
**Steps:**
1. Drag image file to upload zone
2. Verify file appears
**Expected:** File added via drag & drop
**Playwright Actions:** dragAndDropFile, verifyFileAdded

#### TC-CIT-012: File Browser Functionality
**Pre-conditions:** Citizen logged in
**Steps:**
1. Click upload zone
2. Select file from browser
**Expected:** File added via browser dialog
**Playwright Actions:** clickUpload, selectFile

#### TC-CIT-013: Upload Progress Indicators
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload files
2. Submit report
3. Watch progress bar
**Expected:** Progress shows 10% → 30% → 70% → 90%
**Playwright Actions:** monitorProgress, verifyProgressStages

#### TC-CIT-014: Submission Without Media (Optional)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Fill all required fields
2. Do NOT upload any media
3. Submit report
**Expected:** Report submitted successfully, media count = 0
**Playwright Actions:** fillFormOnly, submit, verifySuccess

#### TC-CIT-015: Verify Visibility Defaults to 'Public'
**Pre-conditions:** Citizen submitted report with media
**Steps:**
1. Check database or API
2. Verify media visibility
**Expected:** All media visibility = 'public'
**Playwright Actions:** verifyDatabaseVisibility

#### TC-CIT-016: Network Error Handling
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload media
2. Simulate network error during upload
**Expected:** User-friendly error message, form state preserved
**Playwright Actions:** simulateNetworkError, verifyErrorMessage

#### TC-CIT-017: Upload Timeout Handling
**Pre-conditions:** Citizen logged in
**Steps:**
1. Upload large file
2. Simulate slow network/timeout
**Expected:** Timeout error handled gracefully
**Playwright Actions:** simulateTimeout, verifyTimeoutMessage

---

## Test Group 2: Access Control Tests (5 tests)

### Test Cases:

#### TC-AC-001: Public Cannot Access Police-Only Media URLs
**Pre-conditions:** Police-only media exists
**Steps:**
1. Citizen tries to access police-only media URL directly
**Expected:** Access denied or 403 error
**Playwright Actions:** directUrlAccess, verifyAccessDenied

#### TC-AC-002: Police Can Access All Media
**Pre-conditions:** Media with mixed visibility exists
**Steps:**
1. Police views report
2. Verifies all media visible
**Expected:** Both public and police-only media shown
**Playwright Actions:** policeLogin, viewReport, verifyAllMedia

#### TC-AC-003: Visibility Filtering on API Endpoints
**Pre-conditions:** API endpoint for media
**Steps:**
1. Citizen calls `/api/media/crime/:id`
2. Police calls `/api/media/crime/:id`
**Expected:** Citizen gets only public, police gets all
**Playwright Actions:** makeApiCall, compareResponses

#### TC-AC-004: Authentication Required for Operations
**Pre-conditions:** Not logged in
**Steps:**
1. Try to upload media without auth
2. Try to update media without auth
**Expected:** 401 Unauthorized error
**Playwright Actions:** unauthenticatedRequest, verify401

#### TC-AC-005: Authorization Checks (Police Only Endpoints)
**Pre-conditions:** Citizen logged in
**Steps:**
1. Citizen tries to access police-only endpoint
**Expected:** 403 Forbidden error
**Playwright Actions:** citizenAccessPoliceEndpoint, verify403

---

## Test Group 3: Police Verification Flow (14 tests)

### Test Cases:

#### TC-POL-001: View Pending Report with Media
**Pre-conditions:** Police logged in, pending report with media
**Steps:**
1. Open pending report
**Expected:** Media section visible, all media shown
**Playwright Actions:** policeLogin, openPendingReport, verifyMediaVisible

#### TC-POL-002: Add New Media with Caption
**Pre-conditions:** Police in edit mode
**Steps:**
1. Click "Edit Media"
2. Add new image with caption
3. Approve report
**Expected:** New media added, saved with caption
**Playwright Actions:** addMedia, setCaption, approve, verifyMediaAdded

#### TC-POL-003: Remove Media During Verification
**Pre-conditions:** Police in edit mode
**Steps:**
1. Click "Edit Media"
2. Remove existing media
3. Approve report
**Expected:** Media removed from approved crime
**Playwright Actions:** removeMedia, approve, verifyMediaRemoved

#### TC-POL-004: Toggle Visibility Public → Police_Only
**Pre-conditions:** Police in edit mode
**Steps:**
1. Toggle visibility from public to police_only
2. Approve report
**Expected:** Visibility changed, reflected in system
**Playwright Actions:** toggleVisibility, approve, verifyVisibilityChanged

#### TC-POL-005: Toggle Visibility Police_Only → Public
**Pre-conditions:** Police in edit mode
**Steps:**
1. Toggle visibility from police_only to public
2. Approve report
**Expected:** Visibility changed to public
**Playwright Actions:** toggleVisibility, approve, verifyPublicVisibility

#### TC-POL-006: Edit Caption
**Pre-conditions:** Police in edit mode
**Steps:**
1. Change existing caption
2. Approve report
**Expected:** Caption updated successfully
**Playwright Actions:** editCaption, approve, verifyCaptionUpdated

#### TC-POL-007: Mark as Evidence Toggle
**Pre-conditions:** Police in edit mode
**Steps:**
1. Toggle evidence marking
2. Approve report
**Expected:** Evidence marked/unmarked correctly
**Playwright Actions:** toggleEvidence, approve, verifyEvidenceMarked

#### TC-POL-008: Approval with Media Changes
**Pre-conditions:** Multiple media changes made
**Steps:**
1. Make visibility, caption, evidence changes
2. Approve report
**Expected:** All changes applied atomically
**Playwright Actions:** makeMultipleChanges, approve, verifyAllChanges

#### TC-POL-009: Rejection Preserves Media
**Pre-conditions:** Report with media
**Steps:**
1. Reject report
**Expected:** Media not deleted, still in database
**Playwright Actions:** rejectReport, verifyMediaPreserved

#### TC-POL-010: Verify Crime.latestUpdatedBy Updated
**Pre-conditions:** Media operation performed
**Steps:**
1. Perform media operation
2. Check Crime.latestUpdatedBy
**Expected:** Timestamp updated to current time/user
**Playwright Actions:** performMediaOp, checkLatestUpdatedBy

#### TC-POL-011: Visibility Changes Reflected Immediately
**Pre-conditions:** Visibility changed
**Steps:**
1. Toggle visibility
2. Refresh/reopen report
**Expected:** New visibility persisted
**Playwright Actions:** changeVisibility, refresh, verifyPersisted

#### TC-POL-012: Concurrent Media Operations
**Pre-conditions:** Multiple changes
**Steps:**
1. Add media, remove media, update visibility simultaneously
2. Approve report
**Expected:** All operations processed correctly
**Playwright Actions:** concurrentOps, approve, verifyAllProcessed

#### TC-POL-013: View Mode vs Edit Mode Toggle
**Pre-conditions:** Report with media
**Steps:**
1. View in view mode
2. Switch to edit mode
3. Switch back to view mode
**Expected:** Smooth transitions, correct display
**Playwright Actions:** toggleModes, verifyTransitions

#### TC-POL-014: Pending Changes Indicator
**Pre-conditions:** Media changes made
**Steps:**
1. Make changes but don't approve
**Expected:** Blue indicator shows pending changes
**Playwright Actions:** makeChanges, verifyIndicator

---

## Test Group 4: Public Map Flow (11 tests)

### Test Cases:

#### TC-MAP-001: Map Shows Public Media Thumbnails
**Pre-conditions:** Approved crimes with public media
**Steps:**
1. Navigate to map view (as citizen)
2. Check crime markers
**Expected:** Markers show media indicators
**Playwright Actions:** navigateToMap, verifyMediaIndicators

#### TC-MAP-002: Popup Displays Only Public Media (Citizens)
**Pre-conditions:** Crime with mixed media visibility
**Steps:**
1. Citizen clicks marker
2. Check popup
**Expected:** Only public media shown
**Playwright Actions:** citizenView, clickMarker, verifyPublicOnly

#### TC-MAP-003: Popup Displays All Media (Police)
**Pre-conditions:** Crime with mixed media visibility
**Steps:**
1. Police clicks marker
2. Check popup
**Expected:** All media (public + police_only) shown
**Playwright Actions:** policeView, clickMarker, verifyAllMedia

#### TC-MAP-004: Visibility Badges Shown (Police Only)
**Pre-conditions:** Police viewing map
**Steps:**
1. Click marker with mixed media
**Expected:** Police-only count badge shown
**Playwright Actions:** policeView, verifyPoliceBadge

#### TC-MAP-005: Media Count Indicators
**Pre-conditions:** Crime with media
**Steps:**
1. Check marker popup
**Expected:** Media count displayed correctly
**Playwright Actions:** clickMarker, verifyMediaCount

#### TC-MAP-006: Captions Displayed Correctly
**Pre-conditions:** Media with captions
**Steps:**
1. View popup with media
**Expected:** Captions shown, "+X more" for multiple
**Playwright Actions:** viewPopup, verifyCaptions

#### TC-MAP-007: No Indication of Police-Only Media (Citizens)
**Pre-conditions:** Crime with police-only media
**Steps:**
1. Citizen views popup
**Expected:** No indication that police-only media exists
**Playwright Actions:** citizenView, verifyNoPoliceIndication

#### TC-MAP-008: Thumbnail Quality and Loading
**Pre-conditions:** Crimes with thumbnails
**Steps:**
1. Check thumbnail display
**Expected:** Clear images, lazy loading working
**Playwright Actions:** checkThumbnails, verifyQuality

#### TC-MAP-009: Zoom Functionality for Images
**Pre-conditions:** Image with high resolution
**Steps:**
1. Click on thumbnail in popup
**Expected:** Lightbox or larger view opens
**Playwright Actions:** clickThumbnail, verifyZoom

#### TC-MAP-010: Video Playback in Gallery
**Pre-conditions:** Crime with video media
**Steps:**
1. View video in gallery
**Expected:** Video controls work, playback functional
**Playwright Actions:** viewVideo, testPlayback

#### TC-MAP-011: Map Performance with Many Thumbnails
**Pre-conditions:** Multiple crimes with media
**Steps:**
1. Load map with 20+ crimes
**Expected:** Smooth performance, no lag
**Playwright Actions:** loadManyCrimes, measurePerformance

---

## Test Group 5: Crime Deletion Flow (5 tests)

### Test Cases:

#### TC-DEL-001: Soft-Delete Triggers Media Cascade
**Pre-conditions:** Approved crime with media
**Steps:**
1. Soft-delete crime
**Expected:** Crime deleted, media cascade triggered
**Playwright Actions:** softDeleteCrime, verifyCascade

#### TC-DEL-002: Verify Cloudinary Files Deleted
**Pre-conditions:** Crime deleted with media
**Steps:**
1. Check Cloudinary for deleted files
**Expected:** Files removed from Cloudinary
**Playwright Actions:** checkCloudinary, verifyFilesDeleted

#### TC-DEL-003: Verify MediaCount Updated
**Pre-conditions:** Crime deleted
**Steps:**
1. Check related records
**Expected:** mediaCount fields updated
**Playwright Actions:** checkMediaCountFields

#### TC-DEL-004: Verify ThumbnailUrl Cleared
**Pre-conditions:** Crime deleted
**Steps:**
1. Check database
**Expected:** thumbnailUrl set to NULL
**Playwright Actions:** checkDatabase, verifyThumbnailNull

#### TC-DEL-005: Test Database Cleanup
**Pre-conditions:** Cascade delete completed
**Steps:**
1. Verify no orphaned records
**Expected:** Clean database, no orphaned media
**Playwright Actions:** checkOrphans, verifyCleanDatabase

---

## Test Group 6: Performance & Edge Cases (8 tests)

### Test Cases:

#### TC-PERF-001: Large File Upload Doesn't Block UI
**Pre-conditions:** Large file ready (<5MB)
**Steps:**
1. Upload large file
2. Try to interact with UI during upload
**Expected:** UI remains responsive
**Playwright Actions:** uploadLargeFile, interactDuringUpload

#### TC-PERF-002: Concurrent Uploads Handling
**Pre-conditions:** Multiple files ready
**Steps:**
1. Upload multiple files simultaneously
**Expected:** All files processed correctly
**Playwright Actions:** concurrentUpload, verifyAllProcessed

#### TC-PERF-003: Map Performance with Many Thumbnails
**Pre-conditions:** Many crimes on map
**Steps:**
1. Load map with thumbnails
**Expected:** Fast rendering, smooth scrolling
**Playwright Actions:** measureRenderTime, verifySmoothScroll

#### TC-PERF-004: Mobile Responsiveness
**Pre-conditions:** Mobile viewport
**Steps:**
1. Test on mobile viewport
**Expected:** Components adapt correctly
**Playwright Actions:** setMobileViewport, verifyResponsive

#### TC-PERF-005: Slow Network Conditions
**Pre-conditions:** Network throttling
**Steps:**
1. Simulate slow 3G
2. Upload files
**Expected:** App handles slow network gracefully
**Playwright Actions:** throttleNetwork, upload, verifyGracefulHandling

#### TC-PERF-006: Invalid Cloudinary Responses
**Pre-conditions:** Cloudinary error simulation
**Steps:**
1. Trigger Cloudinary error
**Expected:** User-friendly error message
**Playwright Actions:** simulateCloudinaryError, verifyErrorMessage

#### TC-PERF-007: Database Error Handling
**Pre-conditions:** Database error simulation
**Steps:**
1. Trigger DB error during save
**Expected:** Error handled, rollback if needed
**Playwright Actions:** simulateDbError, verifyErrorHandling

#### TC-PERF-008: Transaction Rollback on Errors
**Pre-conditions:** Error during media save
**Steps:**
1. Upload media
2. Trigger error during save
**Expected:** Transaction rolled back, no partial save
**Playwright Actions:** triggerSaveError, verifyRollback

---

## Bug Tracking Template

### Bug Report Format:
```markdown
### BUG-XXX: [Bug Title]
**Severity:** Critical/High/Medium/Low
**Test Case:** TC-XXX-XXX
**Steps to Reproduce:**
1. Step 1
2. Step 2
**Expected Behavior:** What should happen
**Actual Behavior:** What actually happens
**Environment:** Browser, OS, Network conditions
**Screenshots:** [Attach if available]
**Logs:** [Error logs if any]
**Status:** Open/Fixed/Verified
```

---

## Test Execution Summary

### Test Groups Summary:
| Group | Tests | Est. Time | Dependencies |
|-------|-------|-----------|--------------|
| Citizen Submission | 17 | 20 min | Cloudinary configured |
| Access Control | 5 | 10 min | Test accounts ready |
| Police Verification | 14 | 25 min | Pending reports exist |
| Public Map | 11 | 15 min | Approved crimes exist |
| Deletion | 5 | 10 min | Test data cleanup |
| Performance | 8 | 15 min | All above working |
| **TOTAL** | **60** | **95 min** | - |

---

## Prerequisites for Playwright MCP

### Once Playwright MCP is Available:

1. **MCP Configuration:**
   - MCP server running on correct port
   - Browser contexts configured
   - Screenshot capabilities enabled

2. **Test Data Ready:**
   - Test images in accessible location
   - Test videos ready
   - Invalid test files available

3. **Execution Command:**
   ```bash
   # I'll use this pattern:
   /run dev # Start the app
   # Then execute Playwright test scenarios
   ```

---

## Next Steps

1. **You:** Install and configure Playwright MCP
2. **You:** Provide test credentials and URLs
3. **I:** Execute test plan using Playwright MCP
4. **I:** Document results and bugs
5. **We:** Fix critical bugs and re-test

---

**Status:** Ready for execution once Playwright MCP is configured
**Estimated Completion:** 1.5 - 2 hours (including bug fixes)
