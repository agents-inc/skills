# Unistyles Theming Patterns

> Related: [core.md](core.md) for StyleSheet basics, [responsive.md](responsive.md) for breakpoints

---

## Pattern 1: Theme Definition and Type Safety

Themes are plain JavaScript objects. All themes must share the same TypeScript type.

### Define Themes

```typescript
// unistyles.ts
const lightTheme = {
  colors: {
    background: "#FCFAF8",
    foreground: "#EDEAE6",
    typography: "#1B140C",
    dimmed: "#ECE8E4",
    tint: "#9A734C",
    primary: "#2563EB",
    secondary: "#64748B",
    surface: "#FFFFFF",
    error: "#DC2626",
    link: "#1E3799",
    accents: {
      warning: "#F6E58D",
      success: "#BADC58",
      danger: "#FF7979",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  // Functions in themes are fine
  gap: (multiplier: number) => multiplier * 8,
} as const;

const darkTheme = {
  colors: {
    background: "#221A11",
    foreground: "#332618",
    typography: "#FFFFFF",
    dimmed: "#A8A198",
    tint: "#C9AD92",
    primary: "#3B82F6",
    secondary: "#94A3B8",
    surface: "#2D2D2D",
    error: "#EF4444",
    link: "#0C2461",
    accents: {
      warning: "#F9CA24",
      success: "#6AB04C",
      danger: "#EB4D4B",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  gap: (multiplier: number) => multiplier * 8,
} as const;
```

### TypeScript Declarations

```typescript
// Must be in the same file or imported before StyleSheet.configure
type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
}
```

**Why this matters:** Without the module declaration, `theme` in `StyleSheet.create((theme) => ...)` is typed as `unknown`. With it, you get full autocompletion for `theme.colors.primary`, `theme.spacing.md`, etc.

---

## Pattern 2: StyleSheet.configure

Call `StyleSheet.configure` once, in your entry file, before any component imports.

### Basic Setup

```typescript
// unistyles.ts -- import this FIRST in your entry file
import { StyleSheet } from "react-native-unistyles";

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints: {
    xs: 0, // Required: at least one must be 0
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
  },
  settings: {
    initialTheme: "light",
  },
});
```

### Entry File Import Order

```typescript
// index.ts (entry point)
import "./unistyles"; // MUST be first -- before any component imports
import "expo-router/entry";
```

### Settings Options

| Setting                 | Type                     | Description                                                    |
| ----------------------- | ------------------------ | -------------------------------------------------------------- |
| `initialTheme`          | string or `() => string` | Sets the first theme. Function must be synchronous.            |
| `adaptiveThemes`        | boolean                  | Auto-switch theme based on device color scheme                 |
| `CSSVars`               | boolean                  | Enable CSS variables on web (default: true)                    |
| `nativeBreakpointsMode` | `"pixels"` or `"points"` | How breakpoints are calculated on native (default: `"pixels"`) |

**Mutually exclusive:** `initialTheme` and `adaptiveThemes` cannot both be set -- Unistyles throws an error.

### Initial Theme from Storage

```typescript
StyleSheet.configure({
  themes: { light: lightTheme, dark: darkTheme },
  settings: {
    // Synchronous function -- read from MMKV or similar sync storage
    initialTheme: () => {
      const stored = storage.getString("theme");
      return stored === "dark" ? "dark" : "light";
    },
  },
});
```

---

## Pattern 3: Adaptive Themes

Adaptive themes automatically follow the device's color scheme (light/dark mode). Theme names must match: `"light"` and `"dark"`.

```typescript
StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  settings: {
    adaptiveThemes: true,
  },
});
```

### Runtime Control

```typescript
import { UnistylesRuntime } from "react-native-unistyles";

// Check if adaptive themes are active
const isAdaptive = UnistylesRuntime.hasAdaptiveThemes;

// Disable adaptive themes (user chose manual theme)
UnistylesRuntime.setAdaptiveThemes(false);

// Then set a specific theme
UnistylesRuntime.setTheme("dark");

// Re-enable adaptive themes
UnistylesRuntime.setAdaptiveThemes(true);

// Read device color scheme
const scheme = UnistylesRuntime.colorScheme; // "light" | "dark" | "unspecified"
```

---

## Pattern 4: Theme Switching at Runtime

```typescript
import { UnistylesRuntime } from "react-native-unistyles";

// Switch to a named theme
UnistylesRuntime.setTheme("dark");

// Read current theme name
const current = UnistylesRuntime.themeName; // "dark"

// Get the full theme object
const theme = UnistylesRuntime.getTheme("light");
```

**Important:** `setTheme` is incompatible with `adaptiveThemes: true`. Disable adaptive themes first if you want manual control.

---

## Pattern 5: Runtime Theme Updates

Modify theme properties without switching themes. Useful for user-customizable accent colors.

```typescript
import { UnistylesRuntime } from "react-native-unistyles";

// Update specific properties in current theme
UnistylesRuntime.updateTheme("light", (currentTheme) => ({
  ...currentTheme,
  colors: {
    ...currentTheme.colors,
    primary: userSelectedColor,
    tint: userSelectedAccent,
  },
}));
```

All components using the updated theme properties recalculate their styles automatically. No re-renders.

---

## Pattern 6: Scoped Themes

Force a specific theme on a subtree, regardless of the global theme. Useful for camera screens (always dark), modals, or preview components.

```typescript
import { ScopedTheme } from "react-native-unistyles";

// Force dark theme on camera screen
function CameraScreen() {
  return (
    <ScopedTheme name="dark">
      <View style={styles.container}>
        <Text style={styles.label}>Camera Preview</Text>
      </View>
    </ScopedTheme>
  );
}

// Invert the adaptive theme (light when global is dark, vice versa)
<ScopedTheme invertedAdaptive>
  <View style={styles.invertedSection} />
</ScopedTheme>

// Reset to parent theme inside a scoped section
<ScopedTheme name="dark">
  <View>
    <Text>Dark themed</Text>
    <ScopedTheme reset>
      <Text>Back to global theme</Text>
    </ScopedTheme>
  </View>
</ScopedTheme>
```

### ScopedTheme Props

| Prop               | Type    | Description                                |
| ------------------ | ------- | ------------------------------------------ |
| `name`             | string  | Force a specific theme by name             |
| `invertedAdaptive` | boolean | Use the opposite of current adaptive theme |
| `reset`            | boolean | Reset to parent/global theme               |

### Gotchas

- Place `ScopedTheme` **inside** suspended components, not above `Suspense` boundaries
- Metro HMR does not propagate child changes to parent `ScopedTheme` -- requires manual refresh
- `ScopedTheme` does not use React Context (by design, for performance)
