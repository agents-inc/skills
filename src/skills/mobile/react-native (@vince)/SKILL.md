---
name: mobile/react-native (@vince)
description: React Native mobile development patterns - component architecture, React Navigation, styling with StyleSheet/NativeWind, FlatList optimization, gestures with Reanimated, platform-specific code, Expo vs bare workflow
---

# React Native Development Patterns

> **Quick Guide:** Build cross-platform mobile apps with React Native. Use Expo for most projects (faster development, OTA updates), StyleSheet for performance-critical styles, FlatList for long lists, and React Navigation with type-safe hooks. Keep components small, memoize callbacks passed to lists, and test on both platforms from day one.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use FlatList for lists with more than 20 items - NEVER ScrollView with .map() for long lists)**

**(You MUST memoize renderItem callbacks and use stable keyExtractor functions in FlatList)**

**(You MUST wrap async state updates after await in proper state management - React Native has the same stale closure issues as React)**

**(You MUST test on BOTH iOS AND Android from day one - platform differences cause bugs)**

**(You MUST handle safe areas using react-native-safe-area-context - content behind notches breaks UX)**

**(You MUST use Platform.select() or platform-specific files for platform differences - shadows, fonts, and feedback differ)**

</critical_requirements>

---

**Auto-detection:** React Native, react-native, Expo, expo-router, React Navigation, @react-navigation, StyleSheet, NativeWind, FlatList, ScrollView, View, Text, Pressable, TouchableOpacity, Platform.OS, Platform.select, SafeAreaView, KeyboardAvoidingView, Reanimated, Gesture Handler

**When to use:**

- Building cross-platform iOS and Android mobile applications
- Creating native mobile UIs with React patterns
- Implementing mobile navigation with stack, tab, or drawer patterns
- Optimizing list performance with FlatList and virtualization
- Adding gestures and animations with Reanimated
- Handling platform-specific code for iOS vs Android differences

**Key patterns covered:**

- Component architecture with forwardRef and accessibility props
- React Navigation with type-safe hooks and auth flows
- Styling with StyleSheet, NativeWind, and CVA variants
- FlatList optimization with memoization and getItemLayout
- Platform-specific code with Platform.select and file extensions
- Gesture handling with Reanimated 3+ and Gesture Handler
- Expo vs bare workflow decision making

**When NOT to use:**

- Web-only React applications (use standard React patterns)
- React Native Web hybrid apps (requires additional considerations)
- Flutter, Swift, or Kotlin native development

**Detailed Resources:**

- For code examples, see [examples/](examples/) folder
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

React Native enables building native mobile apps using React patterns. The key insight is that **mobile has different constraints than web**: performance matters more, platform conventions differ, and users expect native feel.

**Core principles:**

1. **Platform-first thinking** - iOS and Android have different UX conventions (haptics, ripples, navigation patterns)
2. **Performance by default** - Mobile devices are constrained; use FlatList, memoize callbacks, avoid inline styles
3. **Native feel matters** - Use native components, proper keyboard handling, safe area insets
4. **Type safety prevents bugs** - Type navigation params, props, and native module interfaces
5. **Test both platforms early** - Platform bugs compound over time; test daily on both

**Mental model:**

React Native is NOT "write once, run anywhere" - it's "learn once, write anywhere." Expect to write some platform-specific code. The shared codebase is typically 80-95%, not 100%.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Component Architecture

Build components with TypeScript, forwardRef for refs, and accessibility props.

#### Basic Component Structure

```typescript
import { forwardRef, useCallback, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from "react-native";

const VARIANT_COLORS = {
  primary: "#007AFF",
  secondary: "#5856D6",
  ghost: "transparent",
} as const;

const SIZE_PADDING = {
  sm: { paddingVertical: 8, paddingHorizontal: 12 },
  md: { paddingVertical: 12, paddingHorizontal: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 24 },
} as const;

interface ButtonProps {
  children: ReactNode;
  variant?: keyof typeof VARIANT_COLORS;
  size?: keyof typeof SIZE_PADDING;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      disabled = false,
      onPress,
      style,
      testID,
    },
    ref
  ) => {
    const buttonStyle = useMemo(
      () => [
        styles.base,
        { backgroundColor: VARIANT_COLORS[variant] },
        SIZE_PADDING[size],
        disabled && styles.disabled,
        style,
      ],
      [variant, size, disabled, style]
    );

    const handlePress = useCallback(() => {
      if (!disabled) {
        onPress();
      }
    }, [disabled, onPress]);

    return (
      <Pressable
        ref={ref}
        style={buttonStyle}
        onPress={handlePress}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={styles.text}>{children}</Text>
      </Pressable>
    );
  }
);

Button.displayName = "Button";

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
});
```

**Why good:** forwardRef enables parent ref access, accessibilityRole/State for screen readers, useMemo prevents style object recreation, testID for E2E testing, named constants for colors/sizes

---

### Pattern 2: Custom Hooks for Logic Separation

Extract reusable logic into custom hooks.

```typescript
import { useState, useCallback, useEffect } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFetchReturn<T> extends FetchState<T> {
  refetch: () => Promise<void>;
}

export function useFetch<T>(url: string): UseFetchReturn<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}
```

**Why good:** Separates data fetching from UI components, reusable across screens, proper TypeScript generics, includes refetch capability

---

### Pattern 3: Safe Area and Keyboard Handling

Handle device notches, status bars, and keyboard properly.

```typescript
import { Platform, StatusBar, KeyboardAvoidingView, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const HEADER_HEIGHT = 64;
const STATUS_BAR_COLOR = "#007AFF";

// Screen wrapper with safe areas
function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      {children}
    </SafeAreaView>
  );
}

// Custom header using insets
function CustomHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 16,
        backgroundColor: STATUS_BAR_COLOR,
      }}
    >
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

// Form screen with keyboard handling
function FormScreen() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.select({
        ios: HEADER_HEIGHT,
        android: 0,
      })}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <FormContent />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Status bar configuration
function App() {
  return (
    <>
      <StatusBar
        barStyle={Platform.OS === "ios" ? "dark-content" : "light-content"}
        backgroundColor={Platform.OS === "android" ? STATUS_BAR_COLOR : undefined}
        translucent={Platform.OS === "android"}
      />
      <MainNavigator />
    </>
  );
}
```

**Why good:** SafeAreaView handles notches/Dynamic Island, KeyboardAvoidingView prevents keyboard overlap, Platform.select handles iOS/Android differences cleanly

---

### Pattern 4: Platform-Specific Code

Handle iOS and Android differences properly.

#### Using Platform.select

```typescript
import { Platform, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    fontFamily: Platform.select({
      ios: "San Francisco",
      android: "Roboto",
      default: "System",
    }),
    // iOS supports 100-900, Android only normal/bold reliably
    fontWeight: Platform.select({
      ios: "600",
      android: "bold",
    }),
  },
});
```

#### Platform-Specific Files

```
components/
├── button/
│   ├── button.tsx           # Shared logic/types
│   ├── button.ios.tsx       # iOS-specific implementation
│   ├── button.android.tsx   # Android-specific implementation
│   └── index.ts             # Re-exports platform file
```

```typescript
// button.ios.tsx
import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.button}>
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

// button.android.tsx
import { Pressable, Text } from "react-native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    ReactNativeHapticFeedback.trigger("impactMedium");
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
      style={styles.button}
    >
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}
```

**Why good:** Platform.select for small differences, separate files for significant implementation differences, proper haptic feedback per platform

---

### Pattern 5: State Management with Zustand

Use Zustand for client state with AsyncStorage persistence.

```typescript
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,

        login: (user, token) => {
          set({ user, token, isAuthenticated: true }, false, "auth/login");
        },

        logout: () => {
          set(
            { user: null, token: null, isAuthenticated: false },
            false,
            "auth/logout"
          );
        },

        updateUser: (updates) => {
          const currentUser = get().user;
          if (currentUser) {
            set(
              { user: { ...currentUser, ...updates } },
              false,
              "auth/updateUser"
            );
          }
        },
      }),
      {
        name: "auth-storage",
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({ user: state.user, token: state.token }),
      }
    ),
    { name: "AuthStore" }
  )
);

// Selectors for performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
```

**Why good:** Zustand with AsyncStorage for persistence, selectors prevent unnecessary re-renders, devtools for debugging, partialize only persists needed state

</patterns>

---

<integration>

## Integration Guide

**React Native works with your existing React knowledge but requires mobile-specific considerations.**

**Navigation:**

- Use React Navigation for routing (stack, tab, drawer navigators)
- Type your navigation params for compile-time safety
- See [examples/navigation.md](examples/navigation.md) for patterns

**Styling:**

- StyleSheet.create for performance-critical styles
- NativeWind for Tailwind-like utility classes
- See [examples/styling.md](examples/styling.md) for patterns

**Performance:**

- FlatList for virtualized lists (not ScrollView + map)
- React.memo + useCallback for list items
- See [examples/performance.md](examples/performance.md) for patterns

**State Management:**

- Zustand for client state (works identically to web)
- React Query for server state (works identically to web)
- AsyncStorage instead of localStorage for persistence

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use FlatList for lists with more than 20 items - NEVER ScrollView with .map() for long lists)**

**(You MUST memoize renderItem callbacks and use stable keyExtractor functions in FlatList)**

**(You MUST wrap async state updates after await in proper state management - React Native has the same stale closure issues as React)**

**(You MUST test on BOTH iOS AND Android from day one - platform differences cause bugs)**

**(You MUST handle safe areas using react-native-safe-area-context - content behind notches breaks UX)**

**(You MUST use Platform.select() or platform-specific files for platform differences - shadows, fonts, and feedback differ)**

**Failure to follow these rules will result in poor performance, platform-specific bugs, and broken UX on mobile devices.**

</critical_reminders>
