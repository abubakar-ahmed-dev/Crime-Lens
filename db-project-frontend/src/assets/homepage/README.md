# Homepage Screenshots

Place your homepage screenshots in this directory with the following filenames:

## Required Screenshots

1. **dashboard-preview.png** - Hero Section dashboard preview
   - Should show: map, charts, statistics, clean dashboard layout
   - Recommended size: 800x600px or higher
   - Will be displayed in the Hero Section (right side)

2. **interactive-map.png** - Interactive Map Showcase
   - Should show: clustered markers, filters, sidebar, clean UI
   - Recommended size: 1000x600px or higher
   - Will be displayed in the Map Showcase Section (right side)

3. **statistics-dashboard.png** - Statistics Dashboard Showcase
   - Should show: trends, comparisons, historical analysis, charts
   - Recommended size: 1000x600px or higher
   - Will be displayed in the Stats Showcase Section (left side)

## How to Add Screenshots

Once you place the screenshots in this directory, you need to import them in the respective component files:

### HeroSection.tsx
```tsx
import dashboardPreview from "../../../assets/homepage/dashboard-preview.png";

// Then in the component:
<ScreenshotPlaceholder
  alt="Dashboard Preview"
  imageSrc={dashboardPreview}
  className="w-full h-auto rounded-2xl shadow-2xl"
/>
```

### MapShowcaseSection.tsx
```tsx
import interactiveMap from "../../../assets/homepage/interactive-map.png";

// Then in the component:
<ScreenshotPlaceholder
  alt="Interactive Map Screenshot"
  imageSrc={interactiveMap}
  className="w-full h-auto rounded-2xl shadow-2xl"
/>
```

### StatsShowcaseSection.tsx
```tsx
import statsDashboard from "../../../assets/homepage/statistics-dashboard.png";

// Then in the component:
<ScreenshotPlaceholder
  alt="Statistics Dashboard Screenshot"
  imageSrc={statsDashboard}
  className="w-full h-auto rounded-2xl shadow-2xl"
/>
```

## File Format
- PNG or JPG format recommended
- WebP format for better compression (optional)
- Ensure good contrast and readability
- Remove any sensitive data from screenshots

## Current Status
The homepage will show elegant placeholder boxes until screenshots are added and properly imported.
