# Unistyles Core Patterns

> Related: [theming.md](theming.md) for theme setup, [responsive.md](responsive.md) for breakpoints, [variants.md](variants.md) for variants

---

## Pattern 1: Static vs Themed vs Runtime StyleSheets

Unistyles supports three levels of StyleSheet complexity. Choose the simplest one that meets your needs.

### Static (no callback)

Identical to React Native's StyleSheet.create. No theme or runtime access.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
  },
});
```

### Themed (theme callback)

Access theme properties. Styles recalculate when theme changes -- no re-renders.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.typography,
    fontWeight: "600",
  },
  link: {
    color: theme.colors.link,
    textDecorationLine: "underline",
  },
}));
```

### Themed + Runtime (theme + rt callback)

Access both theme and device runtime values. Use `rt` for insets, screen dimensions, font scale, orientation, and color scheme.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme, rt) => ({
  safeContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
  },
  responsiveText: {
    color: theme.colors.typography,
    fontSize: rt.fontScale * 16,
  },
  fullScreenImage: {
    width: rt.screen.width,
    height: rt.screen.height * 0.4,
  },
}));
```

### miniRuntime (rt) Properties

| Property                 | Type              | Description                              |
| ------------------------ | ----------------- | ---------------------------------------- |
| `rt.insets.top`          | number            | Safe area top (notch/Dynamic Island)     |
| `rt.insets.bottom`       | number            | Safe area bottom (home indicator)        |
| `rt.insets.left`         | number            | Safe area left                           |
| `rt.insets.right`        | number            | Safe area right                          |
| `rt.insets.ime`          | number            | Keyboard height (input method editor)    |
| `rt.screen.width`        | number            | Screen width in pixels                   |
| `rt.screen.height`       | number            | Screen height in pixels                  |
| `rt.fontScale`           | number            | System font scale (e.g. 1.0, 1.5)        |
| `rt.pixelRatio`          | number            | Device pixel density (e.g. 2.0, 3.0)     |
| `rt.colorScheme`         | string            | `"light"`, `"dark"`, or `"unspecified"`  |
| `rt.isPortrait`          | boolean           | True when device is in portrait          |
| `rt.isLandscape`         | boolean           | True when device is in landscape         |
| `rt.contentSizeCategory` | string            | Accessibility text size (e.g. `"Large"`) |
| `rt.statusBar`           | `{width, height}` | Status bar dimensions                    |
| `rt.navigationBar`       | `{width, height}` | Navigation bar dimensions (Android)      |
| `rt.rtl`                 | boolean           | Right-to-left language mode              |
| `rt.themeName`           | string?           | Currently active theme name              |
| `rt.breakpoint`          | string?           | Currently active breakpoint              |

**Gotcha:** `rt.insets.bottom` is NOT dynamic for keyboard. Use `rt.insets.ime` for keyboard-responsive padding.

---

## Pattern 2: Dynamic Functions

Dynamic functions accept component-level values as arguments. All arguments must be serializable (strings, numbers, booleans, arrays, objects).

### Basic Dynamic Function

```typescript
const styles = StyleSheet.create((theme) => ({
  // Dynamic function with parameters
  listItem: (isOdd: boolean) => ({
    backgroundColor: isOdd
      ? theme.colors.surface
      : theme.colors.background,
    padding: 16,
  }),
}));

// Usage in JSX
<View style={styles.listItem(index % 2 === 1)} />
```

### Multiple Parameters

```typescript
const MAX_CARD_WIDTH = 400;

const styles = StyleSheet.create((theme) => ({
  card: (width: number, isActive: boolean) => ({
    maxWidth: Math.min(width, MAX_CARD_WIDTH),
    backgroundColor: isActive
      ? theme.colors.activeCard
      : theme.colors.card,
    borderWidth: isActive ? 2 : 0,
    borderColor: theme.colors.accent,
  }),
}));

// Usage
<View style={styles.card(containerWidth, isSelected)} />
```

### Mixing Static and Dynamic Styles

```typescript
const styles = StyleSheet.create((theme) => ({
  // Static -- no parameters, just theme access
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // Dynamic -- accepts component-level values
  avatar: (size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: theme.colors.surface,
  }),
}));

// Static styles used normally
<View style={styles.container}>
  {/* Dynamic styles called with arguments */}
  <View style={styles.avatar(48)} />
</View>
```

### Serializable Constraint

```typescript
// CORRECT -- all serializable types
styles.card(42)                    // number
styles.card("primary")             // string
styles.card(true)                  // boolean
styles.card([1, 2, 3])            // array
styles.card({ key: "value" })     // object

// WRONG -- non-serializable types crash C++
styles.card(() => {})              // function
styles.card(<Component />)         // React element
styles.card(new Promise(() => {})) // Promise
```

---

## Pattern 3: Style Merging

### Correct: Array Syntax

```typescript
// Merge multiple styles -- order matters (last wins)
<View style={[styles.container, styles.overlay]} />

// Conditional styles
<View style={[styles.card, isFocused && styles.cardFocused]} />

// Dynamic + static merge
<View style={[styles.card(isOdd), styles.shadow]} />

// Multiple conditions
<View style={[
  styles.button,
  isDisabled && styles.disabled,
  isPressed && styles.pressed,
]} />
```

### Wrong: Spreading

```typescript
// NEVER do this -- destroys C++ state
<View style={{ ...styles.container, ...styles.overlay }} />

// NEVER do this either -- inline overrides also break state
<View style={{ ...styles.container, backgroundColor: "red" }} />
```

**What happens with spreading:** Unistyles detects the lost C++ state in dev mode, restores it, but merges in unpredictable order. Production builds may silently produce wrong styles.

---

## Pattern 4: withUnistyles for Third-Party Components

Use `withUnistyles` only for third-party components that cannot receive Unistyles styles through normal `style` props. Regular RN components (`View`, `Text`, `Pressable`) work without it.

### Auto-Mapping (Components with style Prop)

```typescript
import { withUnistyles } from "react-native-unistyles";
import { BlurView } from "expo-blur";

const UniBlurView = withUnistyles(BlurView);

// style prop is automatically mapped
<UniBlurView style={styles.blur} intensity={50} />
```

### Static Prop Mappings

```typescript
import { withUnistyles } from "react-native-unistyles";
import { Switch } from "react-native";

// Map theme values to component props
const UniSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: {
    false: theme.colors.dimmed,
    true: theme.colors.tint,
  },
  thumbColor: theme.colors.background,
}));

<UniSwitch value={isEnabled} onValueChange={setIsEnabled} />
```

### Dynamic Props (uniProps)

```typescript
// Use uniProps when mappings depend on component state
<UniSwitch
  value={isEnabled}
  onValueChange={setIsEnabled}
  uniProps={(theme, rt) => ({
    trackColor: {
      false: theme.colors.dimmed,
      true: isEnabled
        ? theme.colors.primary
        : theme.colors.secondary,
    },
  })}
/>
```

### Props Priority (Lowest to Highest)

1. Global mappings (second arg of `withUnistyles`)
2. `uniProps` function
3. Inline props on the component

Inline props always win over `uniProps`, which win over global mappings.

### When to Use What

| Component Type                              | Solution                                          |
| ------------------------------------------- | ------------------------------------------------- |
| React Native built-ins (`View`, `Text`)     | Normal `style` prop -- no wrapper needed          |
| Third-party with `style` prop               | `withUnistyles(Component)` -- auto-maps style     |
| Third-party with custom props (color, tint) | `withUnistyles(Component, mappings)` + `uniProps` |
| Last resort / migration from v2             | `useUnistyles()` hook (causes re-renders)         |

---

## Pattern 5: UnistylesRuntime (Imperative Access)

`UnistylesRuntime` provides read/write access to Unistyles state from anywhere -- including outside React components.

### Reading Values

```typescript
import { UnistylesRuntime } from "react-native-unistyles";

// Current state
const currentTheme = UnistylesRuntime.themeName; // "light" | "dark" | ...
const currentBreakpoint = UnistylesRuntime.breakpoint; // "xs" | "sm" | ...
const { width, height } = UnistylesRuntime.screen;
const isPortrait = UnistylesRuntime.isPortrait;
const colorScheme = UnistylesRuntime.colorScheme; // "light" | "dark" | "unspecified"
const insets = UnistylesRuntime.insets; // { top, bottom, left, right, ime }
```

### Mutating State

```typescript
// Switch theme
UnistylesRuntime.setTheme("dark");

// Toggle adaptive themes
UnistylesRuntime.setAdaptiveThemes(true);

// Update theme at runtime (e.g. user picks accent color)
UnistylesRuntime.updateTheme("light", (currentTheme) => ({
  ...currentTheme,
  colors: {
    ...currentTheme.colors,
    primary: userSelectedColor,
  },
}));

// System bars
UnistylesRuntime.statusBar.setHidden(true);
UnistylesRuntime.navigationBar.setHidden(true);
UnistylesRuntime.setImmersiveMode(true); // hides both

// Root view background
UnistylesRuntime.setRootViewBackgroundColor("#000");
```

**Important:** `UnistylesRuntime` getters are non-reactive outside StyleSheet callbacks. Reading `UnistylesRuntime.themeName` in a component does not subscribe to changes. Use `useUnistyles()` or `withUnistyles` when you need reactive access in JSX.
