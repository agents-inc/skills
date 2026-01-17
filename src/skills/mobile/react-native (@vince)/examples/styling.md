# Styling Patterns

StyleSheet, NativeWind, CVA variants, and theming patterns.

---

## Design Tokens

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

export const LINE_HEIGHT = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

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

// Shadows (iOS)
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

// Elevations (Android)
export const ELEVATIONS = {
  sm: 2,
  md: 4,
  lg: 8,
} as const;
```

---

## StyleSheet with Design Tokens

```typescript
import { StyleSheet, Platform, type ViewStyle, type TextStyle } from "react-native";
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

## Platform-Specific Styling

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

## NativeWind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#007AFF",
          light: "#4DA3FF",
          dark: "#0056B3",
        },
        secondary: "#5856D6",
        success: "#34C759",
        warning: "#FF9500",
        error: "#FF3B30",
      },
      spacing: {
        "4.5": "18px",
        "13": "52px",
      },
      borderRadius: {
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
```

---

## NativeWind Components

```typescript
// components/ui/card.tsx
import { View, Text, Pressable } from "react-native";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "outlined" | "elevated";
  onPress?: () => void;
  className?: string;
}

export function Card({
  children,
  variant = "default",
  onPress,
  className = "",
}: CardProps) {
  const baseStyles = "rounded-xl p-4";

  const variantStyles = {
    default: "bg-white",
    outlined: "bg-white border border-gray-200",
    elevated: "bg-white shadow-md",
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${className}`;

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${combinedClassName} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }

  return <View className={combinedClassName}>{children}</View>;
}

// Usage
function ProductCard({ product }: { product: Product }) {
  return (
    <Card variant="elevated" className="mb-4">
      <Text className="text-lg font-bold text-gray-900">{product.name}</Text>
      <Text className="text-sm text-gray-600 mt-1">{product.description}</Text>
      <View className="flex-row justify-between items-center mt-4">
        <Text className="text-xl font-bold text-primary">${product.price}</Text>
        <Pressable className="bg-primary px-4 py-2 rounded-lg active:bg-primary-dark">
          <Text className="text-white font-semibold">Add to Cart</Text>
        </Pressable>
      </View>
    </Card>
  );
}
```

---

## CVA (Class Variance Authority) Pattern

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { forwardRef } from "react";

// Button container variants
const buttonVariants = cva(
  "flex-row items-center justify-center rounded-lg", // Base styles
  {
    variants: {
      variant: {
        primary: "bg-primary",
        secondary: "bg-secondary",
        outline: "bg-transparent border-2 border-primary",
        ghost: "bg-transparent",
        destructive: "bg-error",
      },
      size: {
        sm: "px-3 py-2",
        md: "px-4 py-3",
        lg: "px-6 py-4",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

// Button text variants
const buttonTextVariants = cva("font-semibold", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-white",
      outline: "text-primary",
      ghost: "text-primary",
      destructive: "text-white",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

// Props interface
interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      variant,
      size,
      fullWidth,
      onPress,
      disabled = false,
      loading = false,
      leftIcon,
      rightIcon,
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={isDisabled}
        className={`${buttonVariants({ variant, size, fullWidth })} ${
          isDisabled ? "opacity-50" : ""
        }`}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === "outline" || variant === "ghost" ? "#007AFF" : "#FFFFFF"}
          />
        ) : (
          <>
            {leftIcon && <View className="mr-2">{leftIcon}</View>}
            <Text className={buttonTextVariants({ variant, size })}>{children}</Text>
            {rightIcon && <View className="ml-2">{rightIcon}</View>}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";

// Usage
function Actions() {
  return (
    <View className="gap-3">
      <Button variant="primary" size="lg" fullWidth onPress={handleSubmit}>
        Submit
      </Button>
      <Button variant="outline" onPress={handleCancel}>
        Cancel
      </Button>
      <Button variant="ghost" size="sm" onPress={handleSkip}>
        Skip
      </Button>
      <Button variant="destructive" onPress={handleDelete}>
        Delete
      </Button>
    </View>
  );
}
```

---

## Theming with Context

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
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
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

## Dynamic Style Arrays

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

## Responsive Styling

```typescript
import { Dimensions, StyleSheet, useWindowDimensions } from "react-native";

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
