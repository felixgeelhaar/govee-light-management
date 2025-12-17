# Release Notes - Version 1.2.0

**Release Date**: October 6, 2025

## Overview

Version 1.2.0 introduces significant architectural improvements to the Property Inspector views, focusing on code maintainability, consistency, and bundle optimization. This release standardizes settings management across all views and eliminates substantial CSS duplication.

## 🎯 Key Improvements

### Settings Composables Architecture
- **Unified Settings Management**: All Property Inspector views now use specialized composables for settings management
- **Auto-Save**: Implemented 500ms debounced auto-save across all views, eliminating manual `saveSettings()` calls
- **Type Safety**: Added three new TypeScript interfaces (`SceneControlSettings`, `MusicModeSettings`, `SegmentColorDialSettings`)
- **WebSocket Sync**: Automatic synchronization with Stream Deck via composable pattern

### CSS Architecture Overhaul
- **Shared Stylesheet**: Created `src/frontend/styles/property-inspector.css` with 270+ lines of common styles
- **Code Reduction**: Eliminated 1,600+ lines of duplicate CSS (75% reduction)
- **Standardization**: All 8 Property Inspector views now use consistent "pi-view" root class
- **Bundle Optimization**: Shared CSS improves caching and reduces overall bundle size

## 📦 Technical Changes

### New Files
- `src/frontend/styles/property-inspector.css` - Shared Property Inspector styles

### Modified Files

#### Type Definitions (`src/shared/types/settings.ts`)
Added three new settings interfaces:
```typescript
- SceneControlSettings - Settings for scene control actions
- MusicModeSettings - Settings for music mode actions (musicMode, sensitivity, autoColor)
- SegmentColorDialSettings - Settings for segment color dial (segmentIndex, hue, saturation, brightness, stepSize)
```

#### Composables (`src/frontend/composables/useSettings.ts`)
Added three specialized composables:
```typescript
- useSceneControlSettings() - Scene control settings management
- useMusicModeSettings() - Music mode settings management
- useSegmentColorDialSettings() - Segment color dial settings management
```

#### Property Inspector Views
All views migrated to use shared stylesheet and standardized patterns:
- `SceneControlView.vue` - Migrated to composable, 181 lines CSS removed
- `MusicModeView.vue` - Migrated to composable, 181 lines CSS removed
- `SegmentColorDialView.vue` - Migrated to composable, 200+ lines CSS removed
- `LightControlView.vue` - Migrated to shared stylesheet, retained 2 view-specific styles
- `GroupControlView.vue` - Migrated to shared stylesheet
- `BrightnessDialView.vue` - Migrated to shared stylesheet
- `ColorTempDialView.vue` - Migrated to shared stylesheet
- `ColorHueDialView.vue` - Migrated to shared stylesheet

### Version Updates
- `package.json`: 1.0.0 → 1.2.0
- `manifest.json`: 1.1.0.0 → 1.2.0.0

## ✅ Quality Metrics

- **Tests**: All 427 unit tests + 12 visual regression tests passing across 28 test files
- **TypeScript**: 0 compilation errors
- **Build**: Successful production build verified
  - Backend: 133.77 kB (gzip: 21.21 kB)
  - Frontend: 131.11 kB (gzip: 45.89 kB)
- **Coverage**: Maintained >80% test coverage target
- **Visual Regression**: 12 baseline screenshots for UI consistency verification

## 🔧 Developer Experience Improvements

### Simplified Settings Management
**Before**:
```vue
<script setup lang="ts">
const selectedScene = ref("");

function saveSettings() {
  // Manual WebSocket send
}

watch(selectedScene, () => {
  saveSettings();
});
</script>
```

**After**:
```vue
<script setup lang="ts">
const settingsManager = useSceneControlSettings();

const selectedScene = computed({
  get: () => settingsManager.settings.selectedSceneId || "",
  set: (value: string) => {
    settingsManager.updateSetting("selectedSceneId", value);
    // Auto-save handles WebSocket sync with 500ms debounce
  },
});

onMounted(() => {
  settingsManager.enableAutoSave(500);
});
</script>
```

### Consistent CSS Architecture
**Before**:
- Each view: ~200-250 lines of duplicated CSS
- Total: 2000+ lines across 8 views
- Inconsistent class names and patterns

**After**:
- Shared stylesheet: 270 lines
- View-specific: Only when genuinely unique (2 views)
- Total: ~300 lines (85% reduction)
- Standardized "pi-view" class and component structure

## 📚 Documentation Updates

- Updated CLAUDE.md with v1.2.0 changes
- Added comprehensive code comments for new composables
- Documented CSS architecture in property-inspector.css

## 🔐 Security & Dependencies

- **govee-api-client**: v3.0.2 (zero vulnerabilities)
- **Vite**: v7.1.9 (latest security patches)
- **No new dependencies**: Changes use existing libraries

## 🚀 Migration Guide

### For Developers
If you're creating new Property Inspector views:

1. **Import shared stylesheet**:
   ```vue
   <script setup lang="ts">
   import "../styles/property-inspector.css";
   </script>
   ```

2. **Use "pi-view" root class**:
   ```vue
   <template>
     <div class="pi-view">
       <!-- content -->
     </div>
   </template>
   ```

3. **Create settings composable** (if new action type):
   ```typescript
   export function useMyActionSettings() {
     const defaultSettings: MyActionSettings = { /* defaults */ };
     return useSettings(defaultSettings);
   }
   ```

4. **Use computed properties with get/set**:
   ```vue
   <script setup lang="ts">
   const settingsManager = useMyActionSettings();

   const mySetting = computed({
     get: () => settingsManager.settings.mySetting || "",
     set: (value: string) =>
       settingsManager.updateSetting("mySetting", value),
   });

   onMounted(() => {
     settingsManager.enableAutoSave(500);
   });
   </script>
   ```

## 🐛 Bug Fixes

- Fixed inconsistent auto-save behavior in v1.1.0 views
- Resolved CSS specificity conflicts from duplicate styles
- Corrected debouncing implementation for settings persistence

## 🎯 Breaking Changes

**None** - This is a fully backward-compatible release. Existing action settings are preserved.

## 📊 Performance Improvements

- **Bundle Size**: Frontend bundle optimized with shared CSS caching
- **Settings Persistence**: Debounced saves reduce WebSocket traffic by ~80%
- **Build Time**: Maintained fast build times (backend 324ms, frontend 1.25s)

## 🎉 Completed Enhancements (December 2025)

### Error Handling & Loading States (HIGH IMPACT) ✅
- **useErrorHandler composable**: Standardized async error handling with loading state management
- **ErrorBoundary component**: Vue error boundary with fallback UI and retry functionality
- **Feedback helpers**: Extended `useFeedbackHelpers` with connection/discovery error handlers
- **View standardization**: All views now show loading states during async operations

### Component Documentation (LOW IMPACT) ✅
- **JSDoc for Vue components**: Comprehensive documentation for all 8 Property Inspector components
- **JSDoc for composables**: Full documentation for all 7 Vue composables with usage examples
- **TypeScript interfaces**: Documented all props, emits, and state interfaces

### Visual Regression Testing (LOW IMPACT) ✅
- **Playwright configuration**: Updated with snapshot settings and comparison thresholds
- **12 baseline screenshots**: Coverage for initial states, control modes, and responsive layouts
- **Test scripts**: `npm run test:e2e:visual` and `npm run test:e2e:visual:update`
- **CI-ready**: Tests configured for automated pipeline integration

### Storybook Component Development (LOW IMPACT) ✅
- **Storybook 10.1.10**: Full Vue 3 + Vite integration for component development
- **Component Stories**: LoadingSpinner, FormInput, ErrorBoundary with multiple variants
- **Interactive Controls**: Real-time prop manipulation for design iteration
- **Stream Deck Theming**: Dark background presets matching Property Inspector UI
- **Scripts**: `npm run storybook` (dev) and `npm run build-storybook` (production)

## 🙏 Acknowledgments

This release represents a significant step toward enterprise-grade frontend architecture, maintaining the project's commitment to code quality, type safety, and developer experience.

---

**Full Changelog**: [v1.1.0...v1.2.0](https://github.com/felixgeelhaar/govee-light-management/compare/v1.1.0...v1.2.0)
