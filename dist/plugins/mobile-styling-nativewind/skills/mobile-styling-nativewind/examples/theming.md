# NativeWind - Theming Patterns

> Dark mode, CSS variables, theme switching, and multi-brand theming. See [core.md](core.md) for basic className patterns.

**Prerequisites**: Understand [Pattern 3: Dark Mode](../SKILL.md) and [Pattern 4: CSS Variables](../SKILL.md) from SKILL.md.

---

## Pattern 1: Dark Mode with System Preference

By default, NativeWind follows the device color scheme. Apply `dark:` prefix to all conditional styles.

```tsx
import { View, Text, ScrollView, Pressable } from "react-native";

export function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="p-4">
        <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </Text>

        {/* Card with proper light + dark styles */}
        <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <Text className="text-base text-gray-900 dark:text-white">
            Notifications
          </Text>
          <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your notification preferences
          </Text>
        </View>

        {/* Divider */}
        <View className="my-4 h-px bg-gray-200 dark:bg-gray-700" />

        {/* Secondary action */}
        <Pressable className="rounded-lg bg-gray-100 px-4 py-3 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700">
          <Text className="text-center text-gray-700 dark:text-gray-300">
            Sign Out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

**Why good:** Every element has both light and dark variants, `active:` and `dark:active:` for press states in both modes, no conditional JS logic needed

---

## Pattern 2: Manual Theme Toggle with Persistence

```tsx
import { useEffect, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "user-theme-preference";

type ThemeOption = "light" | "dark" | "system";

export function ThemeSelector() {
  const { colorScheme, setColorScheme } = useColorScheme();

  // Restore persisted theme on mount
  useEffect(() => {
    const restoreTheme = async () => {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setColorScheme(saved);
      }
    };
    restoreTheme();
  }, [setColorScheme]);

  const selectTheme = useCallback(
    async (theme: ThemeOption) => {
      setColorScheme(theme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    },
    [setColorScheme],
  );

  const options: ThemeOption[] = ["light", "dark", "system"];

  return (
    <View className="gap-2 p-4">
      <Text className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
        Appearance
      </Text>
      {options.map((option) => {
        const isActive =
          option === "system"
            ? colorScheme === undefined
            : option === colorScheme;

        return (
          <Pressable
            key={option}
            className={`rounded-lg px-4 py-3 ${
              isActive
                ? "bg-blue-500"
                : "bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700"
            }`}
            onPress={() => selectTheme(option)}
          >
            <Text
              className={`text-center font-medium capitalize ${
                isActive ? "text-white" : "text-gray-900 dark:text-white"
              }`}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

**Why good:** Three-way toggle (light/dark/system), persists to AsyncStorage, restores on mount, `setColorScheme("system")` returns to device preference

---

## Pattern 3: Runtime Theme Switching with vars()

Use `vars()` for brand-level theming that goes beyond light/dark. CSS variables flow through React Context to all children.

```tsx
import { View, Text, Pressable } from "react-native";
import { vars, useColorScheme } from "nativewind";

// Define theme objects as named constants
const THEMES = {
  ocean: {
    light: vars({
      "--color-primary": "#0ea5e9",
      "--color-primary-text": "#ffffff",
      "--color-surface": "#f0f9ff",
      "--color-surface-text": "#0c4a6e",
    }),
    dark: vars({
      "--color-primary": "#38bdf8",
      "--color-primary-text": "#ffffff",
      "--color-surface": "#0c4a6e",
      "--color-surface-text": "#e0f2fe",
    }),
  },
  forest: {
    light: vars({
      "--color-primary": "#16a34a",
      "--color-primary-text": "#ffffff",
      "--color-surface": "#f0fdf4",
      "--color-surface-text": "#14532d",
    }),
    dark: vars({
      "--color-primary": "#4ade80",
      "--color-primary-text": "#ffffff",
      "--color-surface": "#14532d",
      "--color-surface-text": "#dcfce7",
    }),
  },
} as const;

type ThemeName = keyof typeof THEMES;

interface ThemeProviderProps {
  theme: ThemeName;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const { colorScheme } = useColorScheme();
  const mode = colorScheme === "dark" ? "dark" : "light";
  const themeVars = THEMES[theme][mode];

  return (
    <View style={themeVars} className="flex-1">
      {children}
    </View>
  );
}

// Components reference CSS variables -- no prop drilling needed
export function ThemedButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="rounded-lg bg-[--color-primary] px-4 py-3 active:opacity-80"
      onPress={onPress}
    >
      <Text className="text-center font-semibold text-[--color-primary-text]">
        {label}
      </Text>
    </Pressable>
  );
}

export function ThemedCard({ title, body }: { title: string; body: string }) {
  return (
    <View className="rounded-xl bg-[--color-surface] p-4">
      <Text className="text-lg font-bold text-[--color-surface-text]">
        {title}
      </Text>
      <Text className="mt-1 text-[--color-surface-text]">{body}</Text>
    </View>
  );
}
```

**Why good:** Brand themes compose with light/dark mode (2x2 matrix), children reference variables without knowing the theme, switching theme re-renders only via Context change

---

## Pattern 4: Accessing CSS Variables in JavaScript

Use `useUnstableNativeVariable()` when a third-party component needs a theme color as a direct prop value (not via className).

```tsx
import { ActivityIndicator, View, Text } from "react-native";
import { vars, useUnstableNativeVariable } from "nativewind";

const theme = vars({
  "--color-primary": "#3b82f6",
  "--color-accent": "#f59e0b",
});

export function LoadingScreen() {
  return (
    <View
      style={theme}
      className="flex-1 items-center justify-center bg-white dark:bg-gray-900"
    >
      <ThemedLoader />
      <Text className="mt-4 text-[--color-primary]">Loading...</Text>
    </View>
  );
}

function ThemedLoader() {
  // ActivityIndicator.color doesn't accept className -- read variable directly
  const primaryColor = useUnstableNativeVariable("--color-primary");
  return <ActivityIndicator size="large" color={primaryColor} />;
}
```

**Why good:** `useUnstableNativeVariable` bridges CSS variables to props that only accept string/number values, keeps theme centralized in vars() object

**Gotcha:** The `useUnstableNativeVariable` API is marked unstable and may change in future NativeWind versions. Use it sparingly -- only when a component genuinely cannot accept className for a color/value prop.

---

## Pattern 5: Tailwind Config Theme Extension

Extend the default theme in `tailwind.config.js` for compile-time tokens. These are resolved at build time with zero runtime cost.

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5a",
        },
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
```

```tsx
// Usage -- custom tokens work like built-in Tailwind classes
<View className="rounded-card bg-brand-50 p-4 dark:bg-brand-900">
  <Text className="text-brand-700 dark:text-brand-100">Branded content</Text>
</View>
```

**Why good:** Custom tokens resolved at compile time (zero runtime cost), consistent naming across components, safe area insets as spacing values
