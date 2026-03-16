# React Native - Styling Patterns

> StyleSheet patterns, design tokens, platform-specific styling, and theming. See [core.md](core.md) for component architecture.

**Prerequisites**: Understand [Pattern 3: Platform-Specific Code](../SKILL.md) from SKILL.md.

---

## Pattern 1: Design Tokens

```typescript
// constants/design-tokens.ts

// Spacing scale (4px base)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Typography
export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const FONT_WEIGHT = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

// Colors - Light theme
export const COLORS = {
  // Brand
  primary: "#007AFF",
  primaryLight: "#4DA3FF",
  primaryDark: "#0056B3",
  secondary: "#5856D6",

  // Semantic
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  info: "#5AC8FA",

  // Neutral
  background: "#FFFFFF",
  surface: "#F2F2F7",
  surfaceElevated: "#FFFFFF",

  // Text
  text: "#000000",
  textSecondary: "#3C3C43",
  textTertiary: "#8E8E93",
  textInverse: "#FFFFFF",

  // Border
  border: "#C6C6C8",
  borderLight: "#E5E5EA",

  // Transparent
  overlay: "rgba(0,0,0,0.4)",
  transparent: "transparent",
} as const;

// Border radius
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Shadows (iOS only - use ELEVATIONS for Android)
export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
} as const;

// Elevations (Android only - use SHADOWS for iOS)
export const ELEVATIONS = {
  sm: 2,
  md: 4,
  lg: 8,
} as const;
```

---

## Pattern 2: StyleSheet with Design Tokens

```typescript
import {
  StyleSheet,
  Platform,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import {
  COLORS,
  SPACING,
  FONT_SIZE,
  RADIUS,
  SHADOWS,
  ELEVATIONS,
} from "../constants/design-tokens";

// Type-safe styles interface
interface CardStyles {
  container: ViewStyle;
  header: ViewStyle;
  title: TextStyle;
  description: TextStyle;
  footer: ViewStyle;
}

export const cardStyles = StyleSheet.create<CardStyles>({
  container: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...Platform.select({
      ios: SHADOWS.md,
      android: { elevation: ELEVATIONS.md },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "600",
    color: COLORS.text,
  },
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.md * 1.5,
  },
  footer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderLight,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
```

---

## Pattern 3: New Architecture Style Props (React Native 0.76+)

The New Architecture introduces `boxShadow` and `filter` props that work cross-platform.

```typescript
import { View, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  // boxShadow - works on BOTH iOS and Android (New Architecture only)
  cardWithBoxShadow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    // String syntax (CSS-like)
    boxShadow: "5 5 5 0 rgba(0, 0, 0, 0.2)",
    // OR object syntax:
    // boxShadow: {
    //   offsetX: 5,
    //   offsetY: 5,
    //   blurRadius: 5,
    //   spreadDistance: 0,
    //   color: "rgba(0, 0, 0, 0.2)",
    // },
  },

  // Inset shadow (New Architecture only, Android 10+)
  insetShadowCard: {
    boxShadow: "inset 0 2 4 0 rgba(0, 0, 0, 0.1)",
  },

  // filter - apply visual effects (New Architecture only)
  blurredOverlay: {
    filter: "blur(10)",
  },

  grayscaleImage: {
    filter: "grayscale(1)",
  },

  // Multiple filters
  combinedFilters: {
    filter: "saturate(0.5) brightness(1.2)",
    // OR array syntax:
    // filter: [{ saturate: 0.5 }, { brightness: 1.2 }],
  },
});

// NOTE: filter implies overflow: hidden and clips children outside parent bounds
// NOTE: iOS filter only supports brightness and opacity
// NOTE: Android blur and dropShadow require Android 12+
```

**Why use boxShadow over legacy shadow props:**

- Works on both iOS AND Android (legacy shadow props are iOS-only)
- Supports inset shadows
- Includes spread parameter
- Works on Views without background color
- Web-aligned syntax

---

## Pattern 4: Platform-Specific Styling

```typescript
import { StyleSheet, Platform } from "react-native";
import { COLORS, SHADOWS, ELEVATIONS, FONT_WEIGHT } from "../constants/design-tokens";

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        ...SHADOWS.md,
      },
      android: {
        elevation: ELEVATIONS.md,
      },
    }),
  },

  text: {
    // Platform-specific fonts
    fontFamily: Platform.select({
      ios: "San Francisco",
      android: "Roboto",
      default: "System",
    }),
    // Android only reliably supports normal/bold
    fontWeight: Platform.select({
      ios: FONT_WEIGHT.semibold,
      android: FONT_WEIGHT.bold,
    }),
  },

  button: {
    // Platform-specific hit slop
    ...Platform.select({
      ios: {
        paddingVertical: 12,
      },
      android: {
        paddingVertical: 14, // Slightly larger for Android touch targets
      },
    }),
  },
});

// Platform-specific component props
function PlatformButton({ onPress, children }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      android_ripple={Platform.OS === "android" ? { color: "rgba(0,0,0,0.1)" } : undefined}
    >
      {children}
    </Pressable>
  );
}
```

---

## Pattern 5: Theming with Context

```typescript
// context/theme-context.tsx
import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

// Theme types
interface Theme {
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  spacing: typeof SPACING;
  radius: typeof RADIUS;
}

const lightTheme: Theme = {
  colors: {
    primary: "#007AFF",
    background: "#FFFFFF",
    surface: "#F2F2F7",
    text: "#000000",
    textSecondary: "#3C3C43",
    border: "#C6C6C8",
  },
  spacing: SPACING,
  radius: RADIUS,
};

const darkTheme: Theme = {
  colors: {
    primary: "#0A84FF",
    background: "#000000",
    surface: "#1C1C1E",
    text: "#FFFFFF",
    textSecondary: "#EBEBF5",
    border: "#38383A",
  },
  spacing: SPACING,
  radius: RADIUS,
};

// Context
interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Provider
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<"light" | "dark" | "system">("system");

  const isDark = useMemo(() => {
    if (mode === "system") {
      return systemColorScheme === "dark";
    }
    return mode === "dark";
  }, [mode, systemColorScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setMode((current) => (current === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme, setTheme: setMode }),
    [theme, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

// Styled component using theme
function ThemedCard({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {children}
    </View>
  );
}
```

---

## Pattern 6: Dynamic Style Arrays with Variants

```typescript
import { StyleSheet, View, Text, type ViewStyle, type TextStyle } from "react-native";
import { useMemo } from "react";

interface BadgeProps {
  children: string;
  variant?: "default" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  outlined?: boolean;
  style?: ViewStyle;
}

const BADGE_COLORS = {
  default: { bg: "#E5E5EA", text: "#3C3C43" },
  success: { bg: "#D1FAE5", text: "#065F46" },
  warning: { bg: "#FEF3C7", text: "#92400E" },
  error: { bg: "#FEE2E2", text: "#991B1B" },
} as const;

const BADGE_SIZES = {
  sm: { paddingVertical: 2, paddingHorizontal: 6, fontSize: 10 },
  md: { paddingVertical: 4, paddingHorizontal: 8, fontSize: 12 },
  lg: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 14 },
} as const;

export function Badge({
  children,
  variant = "default",
  size = "md",
  outlined = false,
  style,
}: BadgeProps) {
  const containerStyle = useMemo<ViewStyle[]>(
    () => [
      styles.base,
      {
        paddingVertical: BADGE_SIZES[size].paddingVertical,
        paddingHorizontal: BADGE_SIZES[size].paddingHorizontal,
        backgroundColor: outlined ? "transparent" : BADGE_COLORS[variant].bg,
        borderWidth: outlined ? 1 : 0,
        borderColor: BADGE_COLORS[variant].bg,
      },
      style,
    ].filter(Boolean) as ViewStyle[],
    [variant, size, outlined, style]
  );

  const textStyle = useMemo<TextStyle[]>(
    () => [
      styles.text,
      {
        fontSize: BADGE_SIZES[size].fontSize,
        color: BADGE_COLORS[variant].text,
      },
    ],
    [variant, size]
  );

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 9999,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
```

---

## Pattern 7: Responsive Styling

```typescript
import { useWindowDimensions } from "react-native";

// Constants for breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// Hook for responsive values
function useResponsiveValue<T>(values: { default: T; sm?: T; md?: T; lg?: T; xl?: T }): T {
  const { width } = useWindowDimensions();

  if (width >= BREAKPOINTS.xl && values.xl !== undefined) return values.xl;
  if (width >= BREAKPOINTS.lg && values.lg !== undefined) return values.lg;
  if (width >= BREAKPOINTS.md && values.md !== undefined) return values.md;
  if (width >= BREAKPOINTS.sm && values.sm !== undefined) return values.sm;

  return values.default;
}

// Usage
function ResponsiveGrid({ items }: { items: Item[] }) {
  const numColumns = useResponsiveValue({
    default: 2,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  });

  const itemPadding = useResponsiveValue({
    default: 8,
    md: 16,
    lg: 24,
  });

  return (
    <FlatList
      data={items}
      numColumns={numColumns}
      key={numColumns} // Re-render when columns change
      contentContainerStyle={{ padding: itemPadding }}
      renderItem={({ item }) => (
        <View style={{ flex: 1 / numColumns, padding: itemPadding / 2 }}>
          <ItemCard item={item} />
        </View>
      )}
    />
  );
}
```
