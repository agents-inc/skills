---
name: mobile-styling-unistyles
description: Unistyles 3.0 styling - C++ powered StyleSheet superset with zero re-renders, theming, breakpoints, variants, dynamic functions, runtime values
---

# Unistyles 3.0 Patterns

> **Quick Guide:** Unistyles 3.0 is a StyleSheet superset powered by Nitro Modules (C++/JSI). Import `StyleSheet` from `react-native-unistyles` instead of `react-native` -- same API, but with themes, breakpoints, variants, dynamic functions, and runtime values. Zero re-renders: styles update via the Shadow Tree, not React state. Configure with `StyleSheet.configure()` before any `StyleSheet.create()`. Never spread styles (`{...a, ...b}`) -- use array syntax (`[a, b]`). Requires New Architecture (RN 0.78+).

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST import `StyleSheet` from `react-native-unistyles`, NOT from `react-native` -- the Unistyles version is a superset that enables all features)**

**(You MUST call `StyleSheet.configure()` BEFORE any `StyleSheet.create()` -- configure in your entry file before importing components)**

**(You MUST use array syntax `[styles.a, styles.b]` for merging styles -- NEVER spread `{...styles.a, ...styles.b}` as it destroys C++ state)**

**(You MUST NOT use `useUnistyles` hook in regular components -- it forces full re-renders, defeating Unistyles' zero-render architecture)**

**(You MUST pass only serializable arguments to dynamic functions -- strings, numbers, booleans, arrays, objects (no functions or components))**

</critical_requirements>

---

**Auto-detection:** Unistyles, react-native-unistyles, StyleSheet.configure, UnistylesRuntime, UnistylesThemes, UnistylesBreakpoints, useVariants, compoundVariants, ScopedTheme, withUnistyles, useUnistyles, miniRuntime, rt.insets, rt.screen, mq.only, Display, Hide

**When to use:**

- Styling React Native apps that need dynamic theming (light/dark or custom themes)
- Building responsive layouts with breakpoints and media queries across mobile and web
- Creating reusable component variants (size, color, state) without conditional logic
- Accessing runtime device values (insets, screen size, font scale) inside stylesheets
- Migrating from Unistyles 2.x to 3.0

**When NOT to use:**

- Apps that cannot use the New Architecture (requires RN 0.78+, Fabric)
- Expo Go apps (requires development builds with native modules)
- Minimal apps with no theme switching or responsive needs (plain StyleSheet suffices)
- Apps using a utility-class approach (consider a utility-class styling solution instead)

**Key patterns covered:**

- StyleSheet.configure: themes, breakpoints, settings registration
- StyleSheet.create with theme and miniRuntime (rt) access
- Variants and compound variants for reusable component styles
- Dynamic functions with serializable parameters
- Breakpoints, media queries, and Display/Hide components
- Runtime values: insets, screen dimensions, font scale, color scheme
- Scoped themes and adaptive themes
- withUnistyles for third-party component integration
- Style merging with array syntax (never spread)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - StyleSheet setup, theme access, dynamic functions, style merging
- [examples/theming.md](examples/theming.md) - Theme configuration, adaptive themes, scoped themes, runtime switching
- [examples/responsive.md](examples/responsive.md) - Breakpoints, media queries, Display/Hide, runtime values
- [examples/variants.md](examples/variants.md) - Variants, compound variants, boolean variants, component props pattern
- [reference.md](reference.md) - API quick reference, decision frameworks, v2-to-v3 migration

---

<philosophy>

## Philosophy

Unistyles 3.0 is a **StyleSheet superset** -- if you know React Native's `StyleSheet.create`, you know 80% of Unistyles. The remaining 20% is what makes it powerful: themes, responsive breakpoints, variants, and runtime values, all managed in C++ via JSI with **zero React re-renders**.

**How it works:**

1. **Babel plugin** analyzes StyleSheets at build time, detecting dependencies (theme, runtime, breakpoints)
2. **C++ core** reconstructs StyleSheets natively and tracks which styles depend on what
3. **Shadow Tree updates** bypass React entirely -- when a theme changes or the device rotates, only the affected ShadowNodes update their styles directly

**Core principles:**

1. **Zero re-renders** -- No hooks, no context, no state updates for style changes. The C++ core updates the Shadow Tree directly.
2. **StyleSheet superset** -- Same API as React Native's StyleSheet. Replace the import, keep your code.
3. **Type-safe themes** -- TypeScript declarations ensure full autocompletion for theme properties.
4. **Selective recalculation** -- Only styles that depend on a changed value (theme, breakpoint, inset) are recalculated.
5. **Cross-platform** -- Same styles work on iOS, Android, and web (with automatic CSS class generation for web).

**When Unistyles adds value over plain StyleSheet:**

- Multiple themes (dark/light/custom) with instant switching
- Responsive layouts that adapt to screen size, orientation, or device type
- Component variants (primary/secondary, small/large) without conditional style logic
- Runtime-dependent styles (safe area insets, font scale, keyboard height)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: StyleSheet.create with Theme and Runtime

Replace `react-native` import with `react-native-unistyles`. The create function accepts a callback with `theme` and `rt` (miniRuntime) for dynamic styles. Static styles (no theme/runtime) work identically to plain StyleSheet.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
  },
  text: {
    color: theme.colors.typography,
    fontSize: rt.fontScale * 16,
  },
  // Static styles work exactly like plain StyleSheet
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ccc",
  },
}));
```

**Why good:** theme and rt are injected by the C++ core -- no hooks needed, no re-renders when theme or device values change

See [examples/core.md](examples/core.md) for static vs themed vs runtime StyleSheets and the full miniRuntime property list.

---

### Pattern 2: Variants and Compound Variants

Define style variations inside `variants` -- then select them with `styles.useVariants()`. Compound variants apply styles when multiple variant conditions are met simultaneously.

```typescript
const styles = StyleSheet.create((theme) => ({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    variants: {
      color: {
        primary: { backgroundColor: theme.colors.primary },
        secondary: { backgroundColor: theme.colors.secondary },
      },
      size: {
        sm: { paddingHorizontal: 8, paddingVertical: 4 },
        lg: { paddingHorizontal: 24, paddingVertical: 12 },
      },
    },
    compoundVariants: [
      {
        color: "primary",
        size: "lg",
        styles: { borderWidth: 2, borderColor: theme.colors.accent },
      },
    ],
  },
}));

// In component -- call useVariants to select active variants
styles.useVariants({ color: "primary", size: "lg" });
```

**Why good:** eliminates conditional style objects, compound variants reduce complex if/else chains, TypeScript infers valid variant combinations

See [examples/variants.md](examples/variants.md) for boolean variants, default variants, the component props pattern with `UnistylesVariants`, and multi-style variants.

---

### Pattern 3: Dynamic Functions

When styles depend on component-level values (not just theme/runtime), use dynamic functions. Arguments must be serializable (strings, numbers, booleans, arrays, objects).

```typescript
const styles = StyleSheet.create((theme) => ({
  card: (isHighlighted: boolean, index: number) => ({
    backgroundColor: isHighlighted
      ? theme.colors.highlight
      : theme.colors.surface,
    opacity: index === 0 ? 1 : 0.8,
  }),
}));

// In JSX -- call the function with arguments
<View style={styles.card(isHighlighted, index)} />
```

**Why good:** serializable arguments pass to C++ for native recalculation, full TypeScript inference on parameters

See [examples/core.md](examples/core.md) for dynamic function patterns and the serializable constraint.

---

### Pattern 4: Breakpoints and Media Queries

Define breakpoints in `StyleSheet.configure`, then use breakpoint objects or the `mq` utility in styles. At least one breakpoint must start at `0`.

```typescript
// In style definitions -- breakpoint object syntax
const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: {
      xs: "column",
      md: "row",
    },
    padding: {
      xs: 8,
      sm: 16,
      lg: 24,
    },
  },
}));
```

```typescript
// Media query syntax for precise ranges
import { mq } from "react-native-unistyles";

const styles = StyleSheet.create(() => ({
  sidebar: {
    display: {
      [mq.only.width(0, 768)]: "none",
      [mq.only.width(768)]: "flex",
    },
  },
}));
```

**Why good:** breakpoints cascade like CSS (xs applies until sm overrides), mq provides precise range control, web automatically generates CSS media queries

See [examples/responsive.md](examples/responsive.md) for Display/Hide components, landscape/portrait breakpoints, and mixing breakpoints with mq.

---

### Pattern 5: Style Merging (Array Syntax)

Never spread Unistyles objects. Spreading destroys the C++ state that tracks dependencies. Use React Native's array syntax for merging.

```typescript
// CORRECT -- array syntax preserves C++ state
<View style={[styles.container, styles.overlay]} />
<View style={[styles.card, isFocused && styles.focused]} />

// WRONG -- spreading destroys C++ state
<View style={{ ...styles.container, ...styles.overlay }} />
```

**Why bad (spread):** spreading removes the C++ state Unistyles attaches, forcing it to restore state in unpredictable order; triggers dev-mode warnings

See [examples/core.md](examples/core.md) for merging patterns and conditional style application.

---

### Pattern 6: withUnistyles for Third-Party Components

Third-party components that don't expose native views via `ref` cannot benefit from Unistyles' Shadow Tree updates. Wrap them with `withUnistyles` to subscribe to theme and runtime changes.

```typescript
import { withUnistyles } from "react-native-unistyles";
import { BlurHash } from "react-native-blurhash";

// Static mappings -- re-renders only when dependencies change
const UniBlurHash = withUnistyles(BlurHash, (theme) => ({
  color: theme.colors.tint,
}));

// Dynamic mappings via uniProps
<UniBlurHash
  uniProps={(theme, rt) => ({
    color: rt.colorScheme === "dark"
      ? theme.colors.darkTint
      : theme.colors.lightTint,
  })}
/>
```

**Why good:** component re-renders only when its dependencies change, not on every theme/runtime update

**When to use:** only for third-party components that don't work with standard Unistyles styles. Regular React Native components (`View`, `Text`, `Pressable`) work without it.

See [examples/core.md](examples/core.md) for uniProps priority and when to choose withUnistyles vs useUnistyles.

</patterns>

---

<decision_framework>

## Decision Framework

### Choosing the Right Styling Approach

```
Does the component need theme colors or runtime values?
|-- NO -> Plain StyleSheet.create (static object, no callback)
+-- YES -> StyleSheet.create((theme, rt) => ...)
    |
    Does it also need component-local values (props, state)?
    |-- YES -> Dynamic function: style: (arg) => ({ ... })
    +-- NO -> Static theme/runtime access is enough

Does the style have multiple visual variants (size, color, state)?
|-- YES -> Use variants {} inside the style
|   |
|   Do combinations of variants need special treatment?
|   +-- YES -> Add compoundVariants []
+-- NO -> Regular style properties

Is this a third-party component that doesn't work with Unistyles styles?
|-- Try withUnistyles first (no re-renders)
+-- Only if that fails -> useUnistyles hook (causes re-renders)
```

### Responsive: Breakpoints vs Media Queries vs Display/Hide

| Need                         | Solution                                      |
| ---------------------------- | --------------------------------------------- |
| Simple per-breakpoint values | Breakpoint object `{ xs: 8, md: 16 }`         |
| Precise pixel ranges         | `mq.only.width(0, 500)`                       |
| Show/hide entire components  | `<Display mq={...}>` / `<Hide mq={...}>`      |
| Orientation-specific styles  | Built-in `portrait` / `landscape` breakpoints |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Spreading styles `{...styles.a, ...styles.b}` -- destroys C++ state, causes unpredictable style resolution, triggers dev warnings
- Using `useUnistyles` in regular components -- forces full re-renders, defeats the zero-render architecture
- Calling `StyleSheet.create` before `StyleSheet.configure` -- styles won't have access to themes or breakpoints
- Importing `StyleSheet` from `react-native` instead of `react-native-unistyles` -- styles work but lose all Unistyles features (themes, variants, breakpoints)
- Passing non-serializable arguments to dynamic functions (functions, components, Promises) -- arguments are passed to C++ via `folly::dynamic`, non-serializable values crash

**Medium Priority Issues:**

- Setting both `initialTheme` and `adaptiveThemes: true` in configure -- they are mutually exclusive, Unistyles will throw an error
- Missing Babel plugin configuration -- without it, dependency detection, ref borrowing, and scoped variants don't work
- Using `useUnistyles` at the root level -- subscribes the entire app tree to every theme/runtime change
- Defining breakpoints without a `0` value -- at least one breakpoint must be `0` for CSS-like cascading to work

**Gotchas & Edge Cases:**

- The `bottom` inset is NOT dynamic for keyboard -- use `rt.insets.ime` (input method editor) for keyboard-responsive padding
- Babel plugin does NOT support moving functions outside `StyleSheet.create` or reassigning `theme`/`rt` to other variables -- the analysis is scope-bound
- `ScopedTheme` does not work correctly above `Suspense` boundaries -- place it inside suspended components
- Metro Fast Refresh (HMR) does not propagate child changes to parent `ScopedTheme` components -- requires manual refresh
- `withUnistyles` uniProps are lower priority than inline props -- inline props override uniProps, which override global mappings
- Boolean variants use string keys `"true"` and `"false"` -- they are distinct from a `default` variant
- All themes must share the same TypeScript type -- mismatched theme shapes cause type errors
- On web, Unistyles converts theme colors to CSS variables -- theme switching swaps a single class on `<body>`, no JS recomputation
- `UnistylesRuntime` getters are non-reactive outside StyleSheet -- use `useUnistyles` or `withUnistyles` for reactive access in components
- `StyleSheet.addChangeListener()` (v3.1.0+) is the escape hatch for animation libraries that need runtime update notifications

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST import `StyleSheet` from `react-native-unistyles`, NOT from `react-native` -- the Unistyles version is a superset that enables all features)**

**(You MUST call `StyleSheet.configure()` BEFORE any `StyleSheet.create()` -- configure in your entry file before importing components)**

**(You MUST use array syntax `[styles.a, styles.b]` for merging styles -- NEVER spread `{...styles.a, ...styles.b}` as it destroys C++ state)**

**(You MUST NOT use `useUnistyles` hook in regular components -- it forces full re-renders, defeating Unistyles' zero-render architecture)**

**(You MUST pass only serializable arguments to dynamic functions -- strings, numbers, booleans, arrays, objects (no functions or components))**

**Failure to follow these rules will cause broken styles, unnecessary re-renders, and runtime crashes from the C++ core.**

</critical_reminders>
