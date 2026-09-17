// Module declarations for non-TypeScript modules
// api.ts is now a proper TypeScript file, so no declaration needed

// Cross-component globals set at runtime (SearchBar owns the ref,
// MapClickHandler reads it to ignore clicks originating from the search UI).
declare global {
  interface Window {
    searchBarRef?: { current: HTMLDivElement | null };
  }
}

export {};
