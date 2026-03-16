---
name: mobile-framework-react-native
description: React Native mobile development patterns - New Architecture (Fabric, TurboModules, JSI), component architecture, React Navigation 7+, FlashList v2 optimization, gestures with Reanimated 4, platform-specific code, Expo SDK 53+, React 19 features
---

# React Native Development Patterns

> **Quick Guide:** Build cross-platform mobile apps with React Native's New Architecture (default since 0.76). Use Expo for most projects (faster development, OTA updates). Use FlashList for performant lists (or FlatList with proper optimization). Use React Navigation 7+ with type-safe hooks or static API. Keep components small, memoize callbacks passed to lists, and test on both platforms from day one.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use FlashList (preferred) or FlatList for lists with more than 20 items - NEVER ScrollView with .map() for long lists)**

**(You MUST memoize renderItem callbacks and use stable keyExtractor functions - avoid key props on FlashList items as it breaks recycling)**

**(You MUST use react-native-safe-area-context for safe areas - React Native's built-in SafeAreaView is deprecated in 0.81+ and will be removed)**

**(You MUST test on BOTH iOS AND Android from day one - platform differences cause bugs)**

**(You MUST use Platform.select() or platform-specific files for platform differences - shadows, fonts, and feedback differ)**

**(You MUST be aware the New Architecture is enabled by default since React Native 0.76 - Fabric, TurboModules, and bridgeless mode)**

</critical_requirements>

---

**Auto-detection:** React Native, react-native, Expo, expo-router, React Navigation, @react-navigation, StyleSheet, FlatList, FlashList, ScrollView, View, Text, Pressable, TouchableOpacity, Platform.OS, Platform.select, SafeAreaView, KeyboardAvoidingView, Reanimated, Gesture Handler, TurboModules, Fabric, JSI, New Architecture

**When to use:**

- Building cross-platform iOS and Android mobile applications
- Creating native mobile UIs with React patterns
- Implementing mobile navigation with stack, tab, or drawer patterns
- Optimizing list performance with FlashList/FlatList and virtualization
- Adding gestures and animations with Reanimated 4
- Handling platform-specific code for iOS vs Android differences
- Working with React Native's New Architecture (Fabric, TurboModules, JSI)

**Key patterns covered:**

- New Architecture fundamentals (Fabric, TurboModules, JSI, bridgeless mode)
- Component architecture with accessibility props and platform-specific patterns
- React Navigation 7+ with type-safe hooks, static API, and auth flows
- FlashList/FlatList optimization with memoization and cell recycling
- Platform-specific code with Platform.select and file extensions
- Safe area and keyboard handling
- React 19 features (React Native 0.78+): useOptimistic, `use`, ref as props

**When NOT to use:**

- Web-only React applications (use standard React patterns)
- React Native Web hybrid apps (requires additional considerations)
- Flutter, Swift, or Kotlin native development

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Component architecture, compound components
- [examples/navigation.md](examples/navigation.md) - Type-safe navigation, auth flows, deep linking
- [examples/styling.md](examples/styling.md) - StyleSheet, design tokens, theming, responsive styling
- [examples/performance.md](examples/performance.md) - FlashList, FlatList optimization, memoization
- [reference.md](reference.md) - Decision frameworks, anti-patterns, CLI commands

---

<philosophy>

## Philosophy

React Native enables building native mobile apps using React patterns. The key insight is that **mobile has different constraints than web**: performance matters more, platform conventions differ, and users expect native feel.

**Core principles:**

1. **New Architecture first** - React Native 0.76+ uses the New Architecture by default (Fabric, TurboModules, JSI, bridgeless mode)
2. **Platform-first thinking** - iOS and Android have different UX conventions (haptics, ripples, navigation patterns)
3. **Performance by default** - Mobile devices are constrained; use FlashList/FlatList, memoize callbacks, avoid inline styles
4. **Native feel matters** - Use native components, proper keyboard handling, safe area insets
5. **Type safety prevents bugs** - Type navigation params, props, and native module interfaces
6. **Test both platforms early** - Platform bugs compound over time; test daily on both

**New Architecture (React Native 0.76+):**

The New Architecture removes the legacy bridge and provides:

- **Fabric** - Modern rendering engine with synchronous layout effects
- **TurboModules** - Lazy-loaded native modules with type-safe interfaces
- **JSI (JavaScript Interface)** - Direct synchronous JS-to-native calls without serialization
- **Bridgeless Mode** - Complete removal of the async bridge for better performance

Performance improvements with New Architecture: ~15ms faster app startup (~8% improvement), ~3.8MB smaller app size (20% reduction), ~15x faster Metro resolver, ~4x faster warm builds.

**Mental model:**

React Native is NOT "write once, run anywhere" - it's "learn once, write anywhere." Expect to write some platform-specific code. The shared codebase is typically 80-95%, not 100%.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Component Architecture

Build components with TypeScript, accessibility props, and platform awareness. Key concerns: use `Pressable` over `TouchableOpacity`, include `accessibilityRole`/`accessibilityState`, use `testID` for E2E tests, and memoize styles with `useMemo`.

```typescript
// Key pattern: accessibility + testID + memoized styles
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
```

**Why good:** accessibilityRole/State for screen readers, testID for E2E, Pressable supports android_ripple unlike TouchableOpacity

See [examples/core.md](examples/core.md) for full component with forwardRef, variants, and loading state.

---

### Pattern 2: Safe Area and Keyboard Handling

Handle device notches, status bars, and keyboard properly. Use `react-native-safe-area-context` (RN's built-in SafeAreaView is deprecated in 0.81+).

```typescript
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Screen wrapper with safe areas
<SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
  {children}
</SafeAreaView>

// Keyboard handling for forms
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.select({ ios: HEADER_HEIGHT, android: 0 })}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    <FormContent />
  </ScrollView>
</KeyboardAvoidingView>
```

**Why good:** SafeAreaView handles notches/Dynamic Island, KeyboardAvoidingView prevents keyboard overlap, Platform.select handles iOS/Android differences

---

### Pattern 3: Platform-Specific Code

Handle iOS and Android differences with `Platform.select` for small differences, separate files (`.ios.tsx`/`.android.tsx`) for significant divergence.

```typescript
// Platform.select for shadows (iOS shadow props ignored on Android)
const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  text: {
    fontWeight: Platform.select({ ios: "600", android: "bold" }),
  },
});
```

**Why good:** iOS shadow props are completely ignored on Android, fontWeight 100-900 unreliable on Android

For platform-specific file splitting with haptics, see [examples/core.md](examples/core.md).

---

### Pattern 4: FlashList and FlatList Optimization

Use FlashList for performant lists (cell recycling, 50% less blank area). FlashList v2 is New Architecture only. Always memoize renderItem and keyExtractor. Never add `key` props to FlashList items (breaks recycling).

```typescript
// Critical: memoized renderItem + no key prop on items
const renderItem = useCallback(
  ({ item }: { item: Product }) => (
    <ProductItem item={item} onPress={onProductPress} />
  ),
  [onProductPress]
);

<FlashList
  data={products}
  renderItem={renderItem}
  estimatedItemSize={ITEM_HEIGHT} // Optional in v2, required in v1
  getItemType={(item) => item.category} // Improves recycling pool
/>
```

**Why good:** useCallback prevents renderItem recreation, getItemType optimizes recycling, no key prop preserves FlashList's main benefit

See [examples/performance.md](examples/performance.md) for full FlashList and FlatList optimization patterns.

---

### Pattern 5: React 19 Features (React Native 0.78+)

React Native 0.78+ includes React 19 with new hooks and simplified patterns.

```typescript
import { useOptimistic } from "react";

// useOptimistic - optimistic UI updates with automatic rollback
const [optimisticMessages, addOptimisticMessage] = useOptimistic(
  messages,
  (state, newMessage: Message) => [...state, { ...newMessage, sending: true }]
);

// ref as props - no more forwardRef wrapper needed (React 19)
function Input({ ref, placeholder, onChangeText }: InputProps) {
  return <TextInput ref={ref} placeholder={placeholder} onChangeText={onChangeText} />;
}
```

**Why good:** useOptimistic provides automatic rollback on errors, ref as props eliminates forwardRef boilerplate

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using ScrollView + map() for lists with 50+ items - causes severe performance, use FlashList or FlatList
- Adding key prop to FlashList items - BREAKS cell recycling, eliminates FlashList's main benefit
- Using React Native's built-in SafeAreaView - deprecated in 0.81+, use react-native-safe-area-context
- Not testing on both platforms - iOS/Android differences compound; test daily on both
- Inline functions in FlatList/FlashList renderItem - creates new function every render, breaks memoization
- Using Reanimated 4 with old architecture - Reanimated 4.x is New Architecture ONLY

**Medium Priority Issues:**

- Hardcoded colors/spacing instead of constants - breaks consistency, makes theming impossible
- Not using Platform.select for shadows - iOS shadow props don't work on Android (use elevation)
- Missing keyboard handling on forms - keyboard covers inputs without KeyboardAvoidingView
- Using TouchableOpacity everywhere - Pressable is more flexible and supports android_ripple

**Gotchas & Edge Cases:**

- Android fontWeight only supports 'normal' and 'bold' reliably - 100-900 values may not work
- iOS shadow props are completely ignored on Android - must use elevation for Android shadows
- StatusBar backgroundColor only works on Android - iOS uses translucent status bar
- FlatList onEndReached fires immediately if data fits screen - use onEndReachedThreshold carefully
- KeyboardAvoidingView behavior differs: 'padding' for iOS, 'height' for Android
- React Native doesn't have CSS cascade - each component must have complete styles
- Text must be wrapped in `<Text>` component - raw strings cause crashes
- New Architecture enabled by default in 0.76+ - some older libraries may need updates
- FlashList v2 is New Architecture only - use v1 or FlatList if on old architecture
- React Native 0.78+ uses React 19 - propTypes removed, forwardRef optional
- Expo SDK 53+ uses React 19 - check for breaking changes in your dependencies
- Android 15/16 enforces edge-to-edge - must handle safe areas properly
- Reanimated 4 requires react-native-worklets - Reanimated 3 will not work with it installed
- boxShadow and filter props are New Architecture only - not available on legacy architecture
- Reanimated 4: withSpring no longer uses restDisplacementThreshold/restSpeedThreshold - replaced by energyThreshold

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use FlashList (preferred) or FlatList for lists with more than 20 items - NEVER ScrollView with .map() for long lists)**

**(You MUST memoize renderItem callbacks and use stable keyExtractor functions - avoid key props on FlashList items as it breaks recycling)**

**(You MUST use react-native-safe-area-context for safe areas - React Native's built-in SafeAreaView is deprecated in 0.81+ and will be removed)**

**(You MUST test on BOTH iOS AND Android from day one - platform differences cause bugs)**

**(You MUST use Platform.select() or platform-specific files for platform differences - shadows, fonts, and feedback differ)**

**(You MUST be aware the New Architecture is enabled by default since React Native 0.76 - Fabric, TurboModules, and bridgeless mode)**

**Failure to follow these rules will result in poor performance, platform-specific bugs, and broken UX on mobile devices.**

</critical_reminders>
