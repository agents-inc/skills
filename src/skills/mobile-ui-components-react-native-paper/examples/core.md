# React Native Paper - Core Patterns

> PaperProvider setup, theming, custom fonts, dynamic color, babel plugin. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites**: React Native project with `react-native-paper` and `react-native-safe-area-context` installed.

---

## Pattern 1: PaperProvider with Light/Dark Theme

```typescript
import { useColorScheme } from "react-native";
import {
  MD3LightTheme,
  MD3DarkTheme,
  PaperProvider,
} from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Extend the default themes with your brand colors
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#6750A4",
    primaryContainer: "#EADDFF",
    secondary: "#625B71",
    secondaryContainer: "#E8DEF8",
    tertiary: "#7D5260",
    tertiaryContainer: "#FFD8E4",
    surface: "#FFFBFE",
    error: "#B3261E",
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#D0BCFF",
    primaryContainer: "#4F378B",
    secondary: "#CCC2DC",
    secondaryContainer: "#4A4458",
    tertiary: "#EFB8C8",
    tertiaryContainer: "#633B48",
    surface: "#1C1B1F",
    error: "#F2B8B5",
  },
};

export function AppRoot() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <App />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
```

**Why good:** Extends default themes (preserves all ~50 MD3 color roles you didn't override), switches automatically on system preference, SafeAreaProvider wraps PaperProvider for proper inset handling

---

## Pattern 2: Typed Custom Theme with useAppTheme

When adding custom properties to the theme, create a typed hook to preserve TypeScript inference throughout your app.

```typescript
import {
  MD3LightTheme,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

// Add custom properties to the theme
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    brandPrimary: "#1A73E8",
    brandSecondary: "#174EA6",
    success: "#0F9D58",
    warning: "#F9AB00",
  },
};

// Derive the type from the actual theme object
export type AppTheme = typeof theme;

// Create a typed hook - use this instead of useTheme() throughout the app
export function useAppTheme() {
  return useTheme<AppTheme>();
}

// Usage in components:
function StatusBadge({ status }: { status: "success" | "warning" | "error" }) {
  const { colors } = useAppTheme();
  // colors.brandPrimary, colors.success, colors.warning are all typed
  const backgroundColor = colors[status]; // TypeScript-safe lookup
  return <View style={{ backgroundColor }} />;
}
```

**Why good:** Custom color properties are type-checked at every call site. Adding `brandPrimary` to the theme means `useAppTheme().colors.brandPrimary` auto-completes and type-checks.

---

## Pattern 3: Dynamic Color with Android 12+ System Theme

Use `expo-material3-theme` to pull the user's wallpaper-derived Material You colors on Android 12+. Falls back gracefully on iOS and older Android.

```typescript
import { useColorScheme } from "react-native";
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from "react-native-paper";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";

export function AppRoot() {
  const colorScheme = useColorScheme();
  const { theme: material3Theme } = useMaterial3Theme();

  // material3Theme.light and material3Theme.dark contain system-derived colors
  // On iOS / older Android, a sensible fallback palette is returned
  const paperTheme =
    colorScheme === "dark"
      ? { ...MD3DarkTheme, colors: material3Theme.dark }
      : { ...MD3LightTheme, colors: material3Theme.light };

  return (
    <PaperProvider theme={paperTheme}>
      <App />
    </PaperProvider>
  );
}
```

**Why good:** Users on Android 12+ see their wallpaper-derived colors automatically. The library provides a complete fallback palette for iOS and older Android, so no conditional logic is needed. Material3Theme colors follow the same structure as Paper's MD3 color roles.

---

## Pattern 4: Custom Fonts with configureFonts

Use `configureFonts` to apply custom font families across all MD3 typography variants (display, headline, title, label, body).

```typescript
import {
  configureFonts,
  MD3LightTheme,
  PaperProvider,
} from "react-native-paper";
import { Platform } from "react-native";

// Global font override - applies to ALL MD3 variants
const fontConfig = {
  fontFamily: Platform.select({
    ios: "Inter",
    android: "Inter",
    web: "Inter, sans-serif",
    default: "Inter",
  }),
};

const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
};

// Override specific variants if needed:
const headlineConfig = {
  headlineLarge: {
    fontFamily: "PlayfairDisplay-Bold",
    fontWeight: "700" as const,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },
};

const themeWithCustomHeadline = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: headlineConfig }),
};
```

**Why good:** `configureFonts` applies your font family to all 15 MD3 variants (displaySmall through bodyLarge) in one call. Override individual variants only when their specific typography needs to differ.

**Important:** Install each font weight as a separate `.ttf` file. Variable fonts cause rendering issues on some platforms (especially Android).

---

## Pattern 5: Custom Text Variants with TypeScript

When you need typography variants beyond MD3's built-in 15 (like "caption" or "overline"), use `customText` for type-safe custom variants.

```typescript
import { customText } from "react-native-paper";

// Create a typed Text component that accepts your custom variants
export const Text = customText<"caption" | "overline">();

// Usage:
<Text variant="caption">Small helper text</Text>
<Text variant="headlineMedium">Standard MD3 variant still works</Text>
```

**Why good:** Custom variants are type-checked. Using an undefined variant (e.g., `variant="foo"`) is a compile error. Built-in MD3 variants remain available.

---

## Pattern 6: Bridging Paper and React Navigation Themes

Use `adaptNavigationTheme` to unify Paper and React Navigation color schemes so both systems use the same palette.

```typescript
import {
  MD3LightTheme,
  MD3DarkTheme,
  adaptNavigationTheme,
  PaperProvider,
} from "react-native-paper";
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
} from "@react-navigation/native";
import { useColorScheme } from "react-native";

const { LightTheme: adaptedLight, DarkTheme: adaptedDark } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
  materialLight: MD3LightTheme,
  materialDark: MD3DarkTheme,
});

export function AppRoot() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === "dark" ? MD3DarkTheme : MD3LightTheme;
  const navTheme = colorScheme === "dark" ? adaptedDark : adaptedLight;

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <App />
      </NavigationContainer>
    </PaperProvider>
  );
}
```

**Why good:** Without `adaptNavigationTheme`, Paper components and React Navigation headers/tabs use different color palettes. The adapter maps Paper's MD3 color roles to React Navigation's theme structure, ensuring consistent colors across both systems.

**Note:** React Navigation 7.0.0+ automatically picks up Paper's typography when both themes are adapted.

---

## Pattern 7: Babel Plugin for Bundle Optimization

```javascript
// babel.config.js
module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  env: {
    production: {
      plugins: ["react-native-paper/babel"],
    },
  },
};
```

**Why good:** Without the plugin, `import { Button } from "react-native-paper"` bundles the entire library. The plugin rewrites to per-component paths. Only works with ES2015 `import` syntax, not `require()`.
