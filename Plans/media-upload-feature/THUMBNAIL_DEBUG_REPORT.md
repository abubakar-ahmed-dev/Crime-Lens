# Thumbnail Display Debugging Report

**Date:** 2026-08-24
**Issues:**
1. Thumbnails not showing while approving the report (VerificationPage)
2. Crime marker popup not showing any media (MapView)

---

## Investigation

### Issue 1: VerificationPage Thumbnail Black Images

**Component:** `VerificationCard.tsx` 
**Flow:** `getPendingSubmissions` → `MediaGallery` → thumbnail display

**Current Flow:**
1. Backend `getPendingSubmissions` fetches media from database with `thumbnailUrl`
2. Frontend `VerificationCard` receives media array
3. `MediaGallery` component displays thumbnails using `item.thumbnailUrl`

**Problem Analysis:**
- The database might contain old thumbnail URLs without `.jpg` extension
- The `getPendingSubmissions` query returns `thumbnailUrl` directly from database
- If old thumbnails were saved before the `.jpg` extension fix, they won't load

**Evidence:**
- Recent commit `0296fbb` added `.jpg` extension to `getImageThumbnail` function
- But existing database records still have old URLs without `.jpg`

---

### Issue 2: MapView Crime Marker Popup No Media

**Component:** `CrimeMarkers.tsx`
**Flow:** `getCrimesForMap` → CrimeMarker → media display

**Current Flow:**
1. Backend `getCrimesForMap` includes `thumbnailUrl` and `mediaCount` from Crime table
2. Does NOT include individual media items - only aggregate data
3. Frontend checks `crime.mediaCount > 0` but `crime.media` array might be undefined

**Problem Analysis:**
- `getCrimesForMap` only returns `thumbnailUrl` (single thumbnail for the crime)
- Does NOT return `crime.media` array with individual media items
- Frontend tries to access `crime.media` but it's not populated
- Frontend filters `crime.media` but the array is undefined

**Evidence:**
- Backend SQL query (lines 71-90 in CrimeControllers.js) only selects:
  - `c."thumbnailUrl"` (single string)
  - `c."mediaCount"` (integer)
- Does NOT JOIN with CrimeMedia table
- Frontend code (lines 32-44 in CrimeMarkers.tsx) expects `crime.media` array

---

## Root Causes

### Issue 1: Database Contains Old Thumbnail URLs
- **Cause:** Thumbnails were generated before `.jpg` extension fix
- **Impact:** Existing media records have broken thumbnail URLs
- **Solution:** Either regenerate all thumbnail URLs or add `.jpg` in frontend fallback

### Issue 2: Map API Doesn't Return Media Array
- **Cause:** `getCrimesForMap` only returns aggregate data, not individual media
- **Impact:** Frontend can't display individual media items in popups
- **Solution:** Modify `getCrimesForMap` to include media array with thumbnails

---

## Proposed Fixes

### Fix 1: Add Frontend Thumbnail URL Fallback
**File:** `MediaGallery.tsx`
- Check if thumbnail URL is missing or broken
- Fallback to generating proper URL from publicId
- Add `.jpg` extension if missing

### Fix 2: Update getCrimesForMap to Include Media
**File:** `CrimeControllers.js`
- Add JOIN with CrimeMedia table
- Return media array with proper thumbnail URLs
- Filter by visibility based on user role

### Fix 3: Database Migration for Existing Thumbnails
**File:** Migration script
- Update all existing thumbnail URLs to include `.jpg` extension
- Or regenerate all thumbnail URLs using proper format

---

## Testing Strategy

1. Test VerificationPage with existing media (check thumbnails display)
2. Test MapView with existing crimes (check media shows in popups)
3. Test new media uploads (thumbnails work correctly)
4. Test TypeScript build for any syntax errors

---

## Status
**Investigation Complete** - Ready to implement fixes
