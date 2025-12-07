## Example Implementation Output

Here's what a complete, high-quality developer output looks like:

```markdown
# Implementation: Add Dark Mode Toggle

## Investigation Notes

**Files Read:**

- src/components/SettingsPanel.tsx:67 - Existing settings structure
- src/styles/theme.scss:12 - Theme token definitions
- src/stores/ThemeStore.ts:45 - Current theme management

**Pattern Found:**
Settings use controlled inputs with Zustand store pattern (SettingsPanel.tsx:89-134)

## Implementation Plan

1. Add `darkMode` boolean to ThemeStore
2. Create DarkModeToggle component following SettingsPanel pattern
3. Apply theme class to document root
4. Update theme.scss with dark mode variables

## Changes Made

### 1. Updated ThemeStore (src/stores/ThemeStore.ts)

- Added `darkMode: boolean` state
- Added `toggleDarkMode()` action
- Persists to localStorage

### 2. Created DarkModeToggle Component (src/components/DarkModeToggle.tsx)

- Follows existing toggle pattern from SettingsPanel.tsx:112
- Uses design system Switch component
- TypeScript interface matches project conventions

### 3. Updated Theme Styles (src/styles/theme.scss)

- Added `[data-theme="dark"]` selector
- Dark mode color tokens defined
- Maintains existing cascade layer structure

### 4. Applied Theme to Root (src/App.tsx)

- Added `data-theme` attribute based on store state
- Effect updates on theme change

## Verification Checklist

✅ **Success Criteria Met:**

- [x] Toggle appears in settings panel (verified visually)
- [x] Clicking toggle changes theme (tested manually)
- [x] Theme persists across page reload (tested in browser)
- [x] All colors update correctly (verified in DevTools)

✅ **Code Quality:**

- [x] TypeScript types defined for all new code
- [x] Follows existing patterns (Switch component, Zustand store)
- [x] Uses design system tokens (no hard-coded colors)
- [x] SCSS Modules used correctly with cascade layers

✅ **Testing:**

- [x] No existing tests broken (ran `npm test`)
- [x] Build succeeds (ran `npm run build`)

## Files Modified

- src/stores/ThemeStore.ts (+12 lines)
- src/components/DarkModeToggle.tsx (+34 lines, new file)
- src/components/SettingsPanel.tsx (+3 lines)
- src/styles/theme.scss (+28 lines)
- src/App.tsx (+8 lines)

**Total:** 5 files changed, 85 insertions(+)
```

This example demonstrates:

- Investigation notes with specific file:line references
- Clear implementation plan
- Changes organized by file
- Complete verification checklist with evidence
- No over-engineering (followed existing patterns)
- Concrete file modification summary
