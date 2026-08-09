---
name: mobile-styling-nativewind
description: NativeWind v4+ - Tailwind CSS utility classes for React Native, className prop, CSS variables, dark mode, platform prefixes, animations, theming, third-party component integration
---

# NativeWind Patterns

> **Quick Guide:** NativeWind brings Tailwind CSS utility classes to React Native via `className` prop. Styles compile to `StyleSheet.create` at build time with a lightweight runtime for conditional logic (dark mode, hover, focus). Always declare both light AND dark styles (no CSS cascade in RN). Use `vars()` for runtime theming with CSS variables. Platform prefixes (`ios:`, `android:`, `native:`) replace `Platform.select` for styling. Use `remapProps` for third-party components with multiple style props; reserve `cssInterop` for components needing style-to-prop extraction.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always declare BOTH light and dark styles -- `className="text-black dark:text-white"` not just `className="dark:text-white"` -- React Native has no CSS cascade)**

**(You MUST use `remapProps` for third-party components with multiple style props and `cssInterop` ONLY when style attributes need extraction to props -- NEVER use either for your own custom components)**

**(You MUST import `"./global.css"` at your app entry point -- without it no styles render)**

**(You MUST add `/// <reference types="nativewind/types" />` in a `nativewind-env.d.ts` file for TypeScript className support)**

**(You MUST use `nativewind/preset` in `tailwind.config.js` presets -- without it platform-specific features break)**

</critical_requirements>

---

**Auto-detection:** NativeWind, nativewind, className on React Native components, nativewind/preset, nativewind/babel, nativewind/metro, withNativeWind, cssInterop, remapProps, vars(), useColorScheme from nativewind, useUnstableNativeVariable, dark: prefix in React Native, ios: prefix, android: prefix, native: prefix, global.css tailwind directives, nativewind-env.d.ts

**When to use:**

- Styling React Native components with Tailwind CSS utility classes
- Implementing dark mode with automatic system detection or manual toggle
- Creating dynamic themes with CSS variables via `vars()`
- Applying platform-specific styles with `ios:`/`android:`/`native:` prefixes
- Integrating className support with third-party React Native libraries
- Adding transitions and animations to React Native components

**Key patterns covered:**

- className prop usage and custom component patterns
- Dark mode with `useColorScheme` (system preference and manual toggle)
- CSS variables for runtime theming via `vars()` and `useUnstableNativeVariable()`
- Platform prefixes (`ios:`, `android:`, `web:`, `native:`) for cross-platform styling
- Third-party component integration (`remapProps` vs `cssInterop`)
- Animations and transitions (experimental, powered by react-native-reanimated)
- Variant components with class merging libraries

**When NOT to use:**

- Web-only React projects (use standard Tailwind CSS)
- Projects that need zero runtime overhead (use `StyleSheet.create` directly)
- Apps on legacy React Native architecture that cannot adopt New Architecture dependencies

**Detailed Resources:**

- [examples/core.md](examples/core.md) - className usage, custom components, variants, conditional styling
- [examples/theming.md](examples/theming.md) - Dark mode, CSS variables, theme switching, useColorScheme
- [examples/platform-and-interop.md](examples/platform-and-interop.md) - Platform prefixes, cssInterop, remapProps, third-party integration
- [reference.md](reference.md) - Decision frameworks, API cheat sheet, migration notes

---

<philosophy>

## Philosophy

NativeWind bridges Tailwind CSS and React Native by compiling utility classes into `StyleSheet.create` objects at build time and providing a runtime for conditional style logic (dark mode, hover states, focus). The `className` prop works directly on React Native core components via a JSX transform -- no wrapper components needed.

**Core principles:**

1. **Build-time compilation** -- Tailwind classes compile to native `StyleSheet.create` objects, keeping runtime overhead minimal (~2ms per render vs 0ms for raw StyleSheet)
2. **className is first-class** -- The JSX transform makes `className` available inside your components, enabling compatibility with class merging libraries (clsx, tailwind-variants, cva)
3. **No CSS cascade on native** -- React Native does not cascade styles. You must always declare both sides of conditional styles (`text-black dark:text-white`, not just `dark:text-white`)
4. **Platform prefixes over Platform.select** -- For styling concerns, `ios:shadow-lg android:elevation-4` is more declarative than wrapping in `Platform.select`
5. **Custom components just merge classNames** -- Never use `cssInterop` or `remapProps` on your own components. Simply accept a `className` prop and merge it with defaults
6. **Third-party integration is explicit** -- Use `remapProps` (lightweight) or `cssInterop` (full runtime) only for third-party components that need className support

**Architecture:**

NativeWind's JSX transform intercepts component rendering. On native, it resolves className strings into `StyleSheet.create` IDs and applies conditional logic. On web, it passes className through as standard CSS. This means:

- `react-native-reanimated` is a peer dependency (powers animations and transitions)
- `react-native-safe-area-context` is a peer dependency (used for safe area utilities)
- `tailwindcss ^3.4` is required (v4 uses Tailwind CSS v3 config format; NativeWind v5 targets Tailwind CSS v4)
- Inline `style` props merge with className-based styles, with inline taking precedence

**rem units:** NativeWind uses rem: 14 on native (matching React Native's default 14px font size) and rem: 16 on web. Specify `10px` in theme config and let NativeWind normalize per platform.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: className on React Native Components

All React Native core components accept `className` after installing NativeWind. Styles compile at build time -- no runtime string parsing in production.

```tsx
import { View, Text, Pressable } from "react-native";

export function Card({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View className="rounded-lg bg-white p-4 shadow-md dark:bg-gray-800">
      <Text className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </Text>
      <Pressable
        className="mt-3 rounded-md bg-blue-500 px-4 py-2 active:bg-blue-600"
        onPress={onPress}
      >
        <Text className="text-center font-medium text-white">View Details</Text>
      </Pressable>
    </View>
  );
}
```

**Why good:** Both light and dark variants declared, `active:` pseudo-class for press feedback, no inline style objects, compile-time resolution

See [examples/core.md](examples/core.md) for custom component patterns with className merging and variant props.

---

### Pattern 2: Custom Components with className Merging

Accept a `className` prop and merge it with defaults. Never use `cssInterop` or `remapProps` on your own components.

```tsx
interface BadgeProps {
  label: string;
  variant?: "info" | "success" | "warning" | "error";
  className?: string;
}

const VARIANT_CLASSES = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
} as const;

export function Badge({ label, variant = "info", className }: BadgeProps) {
  return (
    <Text
      className={`rounded-full px-2 py-1 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
    >
      {label}
    </Text>
  );
}
```

**Why good:** className prop enables external overrides, variant map is a named constant, both light and dark styles declared per variant

**When to use:** For complex variant logic, use a class merging library (clsx, tailwind-variants, cva) to handle conditional classes and conflict resolution.

See [examples/core.md](examples/core.md) for patterns with clsx and tailwind-variants.

---

### Pattern 3: Dark Mode with useColorScheme

NativeWind follows the system color scheme by default. Use `dark:` prefix for dark-mode styles. Use `useColorScheme()` from `nativewind` to read or manually set the scheme.

```tsx
import { useColorScheme } from "nativewind";
import { View, Text, Pressable } from "react-native";

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-lg text-gray-900 dark:text-white">
        Current: {colorScheme}
      </Text>
      <Pressable
        className="mt-4 rounded-md bg-gray-200 px-4 py-2 dark:bg-gray-700"
        onPress={toggleColorScheme}
      >
        <Text className="text-gray-900 dark:text-white">Toggle Theme</Text>
      </Pressable>
    </View>
  );
}
```

**Why good:** `useColorScheme` from nativewind (not react-native) provides `toggleColorScheme` and `setColorScheme`, system preference followed by default

**Gotcha:** For Expo apps, `userInterfaceStyle` must be set to `"automatic"` in `app.json` for system preference to work.

See [examples/theming.md](examples/theming.md) for manual theme persistence and multi-theme patterns with `vars()`.

---

### Pattern 4: CSS Variables for Runtime Theming

Use `vars()` to set CSS variable values that flow down the component tree via React Context. Use `useUnstableNativeVariable()` to read resolved values in JavaScript.

```tsx
import { vars, useUnstableNativeVariable } from "nativewind";
import { View, Text, ActivityIndicator } from "react-native";

const brandTheme = vars({
  "--color-primary": "#3b82f6",
  "--color-primary-text": "#ffffff",
  "--color-surface": "#f8fafc",
});

export function ThemedScreen() {
  return (
    <View style={brandTheme} className="flex-1 bg-[--color-surface]">
      <Text className="text-lg font-bold text-[--color-primary]">
        Branded Content
      </Text>
      <ThemedSpinner />
    </View>
  );
}

// useUnstableNativeVariable reads resolved CSS variable values
function ThemedSpinner() {
  const primaryColor = useUnstableNativeVariable("--color-primary");
  return <ActivityIndicator color={primaryColor} />;
}
```

**Why good:** `vars()` returns a style object applied to ancestor, children resolve variables via context, `useUnstableNativeVariable` bridges CSS variables to props that don't accept className

See [examples/theming.md](examples/theming.md) for multi-brand theming and combining `vars()` with `useColorScheme`.

---

### Pattern 5: Platform Prefixes

Use `ios:`, `android:`, `web:`, and `native:` prefixes to apply styles per platform. The `native:` prefix targets all platforms except web.

```tsx
<View className="p-4 ios:pt-12 android:pt-8">
  <Text className="text-base ios:font-semibold android:font-bold">
    Platform-aware text
  </Text>
  <View className="ios:shadow-lg android:elevation-4 rounded-lg bg-white p-4">
    <Text className="text-gray-900">Card with platform shadows</Text>
  </View>
</View>
```

**Why good:** Declarative platform branching in className, no Platform.select boilerplate for styling, shadows handled correctly per platform (iOS ignores elevation, Android ignores shadow props)

See [examples/platform-and-interop.md](examples/platform-and-interop.md) for complex platform patterns.

---

### Pattern 6: Third-Party Component Integration

Use `remapProps` (lightweight, no runtime cost) to map className props to style props. Use `cssInterop` (full runtime, performance cost) only when style attributes need extraction to individual props.

```tsx
import { remapProps, cssInterop } from "nativewind";
import { FlatList, TextInput } from "react-native";

// remapProps: maps className strings to style props (lightweight)
remapProps(FlatList, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
  columnWrapperClassName: "columnWrapperStyle",
});

// cssInterop: extracts style attributes to props (full runtime)
cssInterop(TextInput, {
  className: {
    target: "style",
    nativeStyleToProp: { textAlign: true },
  },
  placeholderClassName: {
    target: false,
    nativeStyleToProp: { color: "placeholderTextColor" },
  },
});
```

**Why good:** `remapProps` has zero style resolution overhead, `cssInterop` used only when style attributes must become individual props (like placeholderTextColor)

**When to use:** `remapProps` for components with multiple style props (FlatList, ScrollView). `cssInterop` only when a third-party component needs style properties extracted as individual props (TextInput placeholderTextColor, StatusBar backgroundColor).

See [examples/platform-and-interop.md](examples/platform-and-interop.md) for TypeScript declarations, SVG integration, and the decision framework.

---

### Pattern 7: Animations and Transitions (Experimental)

NativeWind supports Tailwind animation and transition classes, powered by react-native-reanimated under the hood. No need for `Animated.View` -- NativeWind creates animated versions automatically.

```tsx
// Built-in animation classes
<View className="animate-spin h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent" />
<View className="animate-pulse rounded-lg bg-gray-200 p-4 dark:bg-gray-700" />
<View className="animate-bounce">
  <Text className="text-2xl">Bounce</Text>
</View>

// Transitions: smooth interpolation when classes change
<Pressable className="rounded-md bg-blue-500 p-4 transition-colors duration-200 active:bg-blue-700">
  <Text className="text-white">Press me</Text>
</Pressable>
```

**Why good:** Standard Tailwind animation classes work without Animated wrappers, transitions powered by reanimated for native performance

**Gotcha:** Animation and transition support is experimental on native. Animations currently only work with the `style` prop (not all mapped props). Transitions for `shadow` are web-only.

</patterns>

---

<decision_framework>

## Decision Framework

### Styling Approach

```
Need Tailwind utility classes in React Native?
├─ YES → NativeWind
└─ NO → StyleSheet.create (zero overhead)

Need zero runtime overhead?
├─ YES → StyleSheet.create (0ms)
├─ Acceptable ~2ms → NativeWind (compiled)
└─ Runtime parsing OK → twrnc (~8-15ms, pure runtime)
```

### Third-Party Component Integration

```
Does the component accept className already?
├─ YES → Use it directly (no setup needed)
└─ NO → Does it have multiple style props (style, contentContainerStyle)?
    ├─ YES → remapProps (lightweight, zero overhead)
    └─ NO → Does a style attribute need to become a prop?
        ├─ YES → cssInterop (extracts style attributes to props)
        └─ NO → remapProps with simple mapping
```

### Theming Strategy

```
Static theme (compile-time)?
├─ YES → Customize tailwind.config.js theme.extend
└─ NO → Need runtime theme switching?
    ├─ YES → vars() with CSS variables
    └─ Need multiple brand themes?
        └─ Combine vars() + useColorScheme for brand + light/dark matrix
```

See [reference.md](reference.md) for full API cheat sheet, dark mode strategy tree, and migration notes.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Declaring only dark styles without light counterpart (`dark:text-white` without `text-black`) -- React Native has no CSS cascade, so the light variant will have no text color
- Using `cssInterop` or `remapProps` on your own custom components -- these are exclusively for third-party components. Your own components should accept and merge `className` directly
- Missing `import "./global.css"` at app entry point -- no styles will render without it
- Missing `nativewind/preset` in tailwind.config.js presets -- platform prefixes, CSS variable support, and other NativeWind-specific features will not work
- Using `useColorScheme` from `react-native` instead of `nativewind` -- the nativewind version provides `setColorScheme` and `toggleColorScheme`

**Medium Priority Issues:**

- Using `cssInterop` when `remapProps` would suffice -- `cssInterop` has runtime overhead for style resolution, event handlers, and context injection
- Naming the TypeScript declaration file `nativewind.d.ts` -- it conflicts with the package's own types. Use `nativewind-env.d.ts`
- Not setting `userInterfaceStyle: "automatic"` in Expo app.json -- system dark mode preference will not be detected
- Using web-designed breakpoints (`sm:`, `md:`, `lg:`) without customizing for mobile -- NativeWind's default breakpoints are web-centric (640px, 768px, 1024px) and may not match mobile screen sizes

**Gotchas & Edge Cases:**

- Inline `style` prop takes precedence over `className` styles due to CSS specificity -- `<Text className="text-white" style={{ color: "black" }} />` renders black
- `rem` units differ between platforms: 14 on native (RN default font size), 16 on web -- use px values in theme config for consistency
- Color opacity is disabled by default for performance on native -- enable via `corePlugins` in tailwind.config.js if you need `bg-blue-500/50` syntax
- `vars()` values propagate via React Context, not actual CSS -- they only flow to React children, not portal-rendered content
- `useUnstableNativeVariable` API may change in future versions (prefixed "unstable" intentionally)
- Animations and transitions are experimental on native -- `transition-shadow` is web-only, and animation performance is actively being improved
- `gap-` compiles to native `columnGap`/`rowGap` in v4 (v2 used a polyfill) -- verify your React Native version supports gap layout props
- `divide-` and `space-` utilities are temporarily unavailable in v4
- NativeWind v5 (in preview) deprecates `cssInterop`/`remapProps` in favor of `styled()`, and `vars()` in favor of `VariableContextProvider` -- check migration guide when upgrading
- Tailwind CSS v4 is NOT yet supported by NativeWind v4 -- NativeWind v4 uses Tailwind CSS v3.4 config format

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST always declare BOTH light and dark styles -- `className="text-black dark:text-white"` not just `className="dark:text-white"` -- React Native has no CSS cascade)**

**(You MUST use `remapProps` for third-party components with multiple style props and `cssInterop` ONLY when style attributes need extraction to props -- NEVER use either for your own custom components)**

**(You MUST import `"./global.css"` at your app entry point -- without it no styles render)**

**(You MUST add `/// <reference types="nativewind/types" />` in a `nativewind-env.d.ts` file for TypeScript className support)**

**(You MUST use `nativewind/preset` in `tailwind.config.js` presets -- without it platform-specific features break)**

**Failure to follow these rules will cause invisible styles, broken dark mode, TypeScript errors on className props, and platform-specific rendering failures.**

</critical_reminders>
