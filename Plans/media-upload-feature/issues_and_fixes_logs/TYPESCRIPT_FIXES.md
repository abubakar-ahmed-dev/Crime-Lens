# TypeScript Import Fixes After api.js → api.ts Conversion

**Date:** 2026-08-24  
**Context:** After converting `api.js` to `api.ts`, import statements needed updating and TypeScript errors needed fixing.

---

## Changes Made

### 1. Import Path Fixes

**Files Modified:**
- `src/context/AuthContext.tsx`
- `src/components/PoliceMediaEditor.tsx`
- `src/components/MediaUploader.tsx`
- `src/pages/ReportCrimePage/component/ReportCrimeCard.tsx`

**Change:**
```typescript
// Before (incorrect)
import { uploadMedia } from "../services/api.ts";

// After (correct)
import { uploadMedia } from "../services/api";
```

---

### 2. Module Declaration Removal

**File:** `src/types/declarations.d.ts`

**Before:**
```typescript
declare module "../services/api.ts" {
  export const loginUser: (username: string, password: string, verifyRole: string) => Promise<any>;
  export const setAuthToken: (token: string | null) => void;
  const api: any;
  export default api;
}
```

**After:**
```typescript
// Module declarations for non-TypeScript modules
// api.ts is now a proper TypeScript file, so no declaration needed
```

**Reason:** api.ts is now a proper TypeScript file with its own types, so module declaration is unnecessary.

---

### 3. MediaUpdate Interface Alignment

**File:** `src/pages/MapViewPage/components/types.tsx`

**Before:**
```typescript
export interface MediaUpdate {
  mediaId: number;  // Required field
  visibility?: 'public' | 'police_only';
  caption?: string;
  evidenceMarked?: boolean;
}
```

**After:**
```typescript
export interface MediaUpdate {
  // mediaId is passed separately to updateMedia function, not part of MediaUpdate
  visibility?: 'public' | 'police_only';
  caption?: string;
  evidenceMarked?: boolean;
}
```

**Reason:** The `updateMedia` function signature is `updateMedia(mediaId: number, updates: MediaUpdate)`, so mediaId should not be in the MediaUpdate interface.

---

### 4. uploadMedia Function Call Fix

**File:** `src/pages/ReportCrimePage/component/ReportCrimeCard.tsx`

**Before:**
```typescript
const uploadResult = await uploadMedia(
  mediaFiles.map(f => f.file),
  mediaFiles.map(f => f.caption),
  undefined,
  token
) as UploadMediaResponse;
```

**After:**
```typescript
const uploadResult = await uploadMedia({
  files: mediaFiles.map(f => f.file),
  captions: mediaFiles.map(f => f.caption),
  crimeId: undefined,
  authToken: token
}) as UploadMediaResponse;
```

**Reason:** The api.ts function now uses an options object parameter instead of positional parameters.

---

### 5. PoliceMediaEditor Component Fixes

**File:** `src/components/PoliceMediaEditor.tsx`

**Changes Made:**

1. **Added onMediaDelete prop to interface:**
```typescript
interface PoliceMediaEditorProps {
  crimeId: number;
  media: CrimeMedia[];
  onMediaUpdate?: (mediaId: number, updates: MediaUpdate) => void;
  onMediaAdd?: (files: Array<{ file: File; caption: string }>) => void;
  onMediaDelete?: (mediaId: number) => void;  // Added
  onCancel: () => void;
}
```

2. **Removed unused imports:**
```typescript
// Removed: MediaOperations, buildMediaFormData
```

3. **Fixed debounceTimeoutRef type:**
```typescript
// Before
const debounceTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});

// After
const debounceTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
```

**Reason:** `ReturnType<typeof setTimeout>` is more platform-agnostic than NodeJS.Timeout.

4. **Removed unused mediaChanges state** (simplified component)

5. **Fixed validateMediaFiles call** to pass File[] instead of mixed array

---

### 6. MediaUploader Component Fixes

**File:** `src/components/MediaUploader.tsx`

**Changes Made:**

1. **Removed unused import:**
```typescript
// Before
import { createFilePreview, getFileCategory, validateMediaFiles } from '../services/api';

// After
import { createFilePreview, getFileCategory } from '../services/api';
```

2. **Fixed fileType handling:**
```typescript
const fileType = getFileCategory(file);
if (fileType === 'unknown') {
  newErrors.push(`File type "${file.type}" not supported.`);
  continue;
}

// TypeScript narrowing
if (fileType !== 'image' && fileType !== 'video') {
  newErrors.push(`File type "${file.type}" not supported.`);
  continue;
}
```

---

### 7. MediaGallery Component Fixes

**File:** `src/components/MediaGallery.tsx`

**Changes Made:**

1. **Removed unused props and state:**
```typescript
// Removed unused props
onMediaUpdate,  // Not used in component

// Removed unused state
const [mediaErrors, setMediaErrors] = useState<Set<number>>(new Set());

// Removed unused interface
interface MediaError { ... }
```

---

### 8. VerificationCard Component Fixes

**File:** `src/pages/VerificationPage/component/VerificationCard.tsx`

**Changes Made:**

1. **Fixed hasMediaChanges function:**
```typescript
const hasMediaChanges = () => {
  return Object.keys(mediaChanges).some(key => {
    const value = mediaChanges[key as keyof MediaChanges];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return false;
  });
};
```

**Reason:** Better type safety for checking if media changes exist.

---

## Status

**Completed:** Partially  
**Remaining Issues:** Some TypeScript errors still exist in:
- `src/pages/AllRecordsPage/component/DetailsPopup.tsx`
- Other minor type mismatches

**Build Status:** Not passing yet - needs additional fixes

---

## Next Steps

1. Fix remaining TypeScript errors in DetailsPopup.tsx
2. Run full build to verify all issues resolved
3. Test the application to ensure no runtime errors
