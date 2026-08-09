---
name: mobile-ui-components-tamagui
description: Tamagui universal UI - styled(), tokens, themes, optimizing compiler, responsive media queries, animations, Sheet/Dialog components
---

# Tamagui Universal UI Patterns

> **Quick Guide:** Tamagui provides universal styled components for React Native and web with an optimizing compiler that flattens components to native primitives. Use `styled()` with variants for component APIs, `$`-prefixed tokens for consistent spacing/color, theme nesting for light/dark modes, and the `transition` prop for animations. The compiler extracts static styles to CSS on web and hoists style objects on native -- but only when props are deterministic at build time.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `$`-prefixed token values in style props (`$4`, `$color.blue`) -- raw pixel values bypass the token system and break theme consistency)**

**(You MUST keep the `transition` prop present in JSX when using animations -- conditionally removing it causes expensive hook teardown; pass `null` to disable instead)**

**(You MUST add `as const` to variant definition objects -- without it TypeScript cannot infer variant prop types correctly)**

**(You MUST use `Adapt` for responsive Dialog-to-Sheet behavior -- manual Platform.OS branching breaks compiler optimization and misses breakpoint changes)**

</critical_requirements>

---

**Auto-detection:** Tamagui, tamagui, styled(), createTamagui, createTokens, createTheme, XStack, YStack, ZStack, SizableText, Paragraph, Theme, useTheme, useMedia, $sm, $md, $lg, enterStyle, exitStyle, hoverStyle, pressStyle, transition prop, Sheet, Dialog, Adapt, GetProps, TamaguiProvider, @tamagui/core, @tamagui/config

**When to use:**

- Building universal React Native + web UIs that share components across platforms
- Creating design-system-driven components with typed token scales and theme variants
- Optimizing render performance via compiler flattening (styled components to native divs/Views)
- Implementing responsive layouts with media query style props (`$sm`, `$gtMd`)
- Adding enter/exit/hover/press animations with swappable animation drivers
- Building adaptive overlays (Dialog on desktop, Sheet on mobile) with `Adapt`

**When NOT to use:**

- Web-only projects where a web-native styling solution is simpler
- Apps needing pixel-perfect custom native UI beyond what React Native Views provide
- Performance-critical animations that need direct native driver control beyond Tamagui's animation abstraction

**Key patterns covered:**

- `styled()` with typed variants (spread, boolean, functional) and `GetProps` type extraction
- Token system (`createTokens`, `$`-prefix references, category-to-property mapping)
- Theme hierarchy (base, sub-themes, component themes, `useTheme`, dark/light switching)
- Optimizing compiler (flattening, CSS extraction, what prevents optimization)
- Responsive styles with media query props and `useMedia` hook
- Animation system with `transition` prop, `enterStyle`/`exitStyle`, and driver selection
- Sheet and Dialog with `Adapt` for responsive overlay behavior

**Detailed Resources:**

- [examples/core.md](examples/core.md) - styled(), variants, tokens, themes, compiler optimization
- [examples/responsive-animations.md](examples/responsive-animations.md) - Media queries, useMedia, animation drivers, enter/exit styles
- [examples/overlays.md](examples/overlays.md) - Sheet, Dialog, Adapt pattern
- [reference.md](reference.md) - Decision frameworks, token-to-property mapping, migration notes

---

<philosophy>

## Philosophy

Tamagui solves the universal UI problem: write components once that render optimally on both React Native and web. The key insight is that **compile-time analysis can eliminate the runtime cost of a universal abstraction**.

**Core principles:**

1. **Tokens are the source of truth** -- spacing, color, radius, and font values flow from `createTokens` through themes to components via `$`-prefixed references. Raw values bypass the system.
2. **Themes override tokens contextually** -- themes are scoped CSS variables that change within React subtrees. Missing theme keys resolve upward to parent themes, then to tokens.
3. **The compiler rewards deterministic styles** -- static props, token references, and spread variants can be flattened to native primitives. Dynamic expressions, ternaries on non-media values, and function render props prevent optimization.
4. **Animation drivers are swappable** -- CSS transitions for web, Reanimated for native, configured once in `createTamagui`. Component code stays identical.
5. **Adapt replaces platform branching** -- `Adapt` transforms Dialog to Sheet at breakpoints without manual `Platform.OS` checks.

**Tamagui v2** is the current stable release. Key changes from v1: `animation` prop renamed to `transition`, config v5 with Tailwind-aligned breakpoints, expanded color system with Radix Colors v3, native portals for Sheet/Dialog/Popover, and headless/unstyled component variants.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: styled() with Typed Variants

`styled()` extends a base component with default styles and type-safe variants. Use `GetProps` to export the derived prop type.

```tsx
import { GetProps, styled, View, Text } from "@tamagui/core";

export const Card = styled(View, {
  name: "Card",
  backgroundColor: "$background",
  borderRadius: "$4",
  padding: "$4",
  borderWidth: 1,
  borderColor: "$borderColor",

  variants: {
    size: {
      "...size": (val, { tokens }) => ({
        padding: tokens.size[val] ?? val,
      }),
    },
    elevated: {
      true: { elevation: "$2" },
    },
  } as const,
});

export type CardProps = GetProps<typeof Card>;
```

**Why good:** `name` property enables component-specific themes (`dark_Card`), spread variant `...size` maps all size tokens automatically, `as const` preserves literal types for variant inference, `GetProps` keeps prop type in sync with the component

```tsx
// BAD: raw values bypass token system
export const Card = styled(View, {
  padding: 16, // raw pixel -- not theme-aware
  borderRadius: 8, // should be $4 or a radius token
  backgroundColor: "#fff", // hardcoded -- breaks dark mode
});
```

**Why bad:** raw values bypass token resolution and theme switching, hardcoded colors break in dark mode, no connection to design system

See [examples/core.md](examples/core.md) for full variant patterns including boolean, functional, and nested `styled(styled())`.

---

### Pattern 2: Token System and Theme Hierarchy

Tokens define the design scale. Themes override token values within React subtrees. Components reference `$`-prefixed keys that resolve to the active theme, falling back to tokens.

```tsx
// Token reference in JSX
<YStack padding="$4" gap="$2" backgroundColor="$background">
  <SizableText size="$5" color="$color">
    Themed text
  </SizableText>
</YStack>

// Theme nesting -- inner Theme applies as "dark_green"
<Theme name="dark">
  <Card>
    <Theme name="green">
      <Card>{/* uses dark_green theme */}</Card>
    </Theme>
  </Card>
</Theme>
```

**Why good:** `$background` resolves from active theme (light or dark), nested Theme composes name automatically (`dark` + `green` = `dark_green`), missing keys in sub-theme fall back to parent theme then to tokens

See [examples/core.md](examples/core.md) for `createTokens`, `createTheme`, theme definition patterns, and `useTheme` hook usage.

---

### Pattern 3: Compiler Optimization

The compiler flattens styled components to native primitives (`div` on web, `View` on native) and extracts atomic CSS. This only works when styles are **deterministic at build time**.

```tsx
// GOOD: compiler can flatten -- all values are static tokens
<Card size="$4" elevated />

// GOOD: media query props are compiler-optimized
<YStack padding="$2" $gtMd={{ padding: "$4" }} />

// BAD: dynamic ternary prevents flattening
<YStack padding={isLarge ? "$4" : "$2"} />

// BAD: function render prop deoptimizes
<Card render={(props) => <CustomThing {...props} />} />
```

**Key rule:** Static token values, spread variants, and media query props are compiler-friendly. JavaScript expressions, ternaries on runtime values, and function render props force runtime evaluation.

See [examples/core.md](examples/core.md) for what the compiler can/cannot optimize and how to structure code for maximum flattening.

---

### Pattern 4: Responsive Styles with Media Queries

Use `$`-prefixed media query props for responsive styles. The compiler extracts these to CSS `@media` rules on web, eliminating runtime overhead.

```tsx
<XStack
  flexDirection="column"
  padding="$2"
  $gtSm={{ flexDirection: "row", padding: "$4" }}
  $gtMd={{ gap: "$4" }}
>
  <Card flex={1} />
  <Card flex={1} />
</XStack>
```

**Why good:** mobile-first base styles, media props override progressively, compiler extracts to CSS @media rules on web (zero JS runtime)

See [examples/responsive-animations.md](examples/responsive-animations.md) for `useMedia` hook, config breakpoints, and height-based queries.

---

### Pattern 5: Animations with transition Prop

The `transition` prop references a named animation from your config. Combine with `enterStyle`, `exitStyle`, `hoverStyle`, and `pressStyle` for declarative animations.

```tsx
<Card
  transition="bouncy"
  enterStyle={{ opacity: 0, scale: 0.9, y: -10 }}
  hoverStyle={{ scale: 1.02 }}
  pressStyle={{ scale: 0.98 }}
  opacity={1}
  scale={1}
  y={0}
/>
```

**Why good:** declarative animation states, driver-agnostic (CSS on web, Reanimated on native), SSR-safe enterStyle

**Critical:** always keep `transition` in JSX -- pass `null` to disable, never conditionally omit the prop (causes expensive hook teardown).

See [examples/responsive-animations.md](examples/responsive-animations.md) for driver configuration, `AnimatePresence`, and per-property `animateOnly`.

---

### Pattern 6: Sheet and Dialog with Adapt

Use `Adapt` to render Dialog as a Sheet on touch devices at smaller breakpoints. This avoids manual `Platform.OS` branching and responds to viewport changes.

```tsx
<Dialog modal>
  <Dialog.Trigger asChild>
    <Button>Open</Button>
  </Dialog.Trigger>

  <Adapt when="sm" platform="touch">
    <Sheet modal dismissOnSnapToBottom>
      <Sheet.Frame padding="$4">
        <Adapt.Contents />
      </Sheet.Frame>
      <Sheet.Overlay />
    </Sheet>
  </Adapt>

  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close asChild>
        <Button>Close</Button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog>
```

**Why good:** single component tree handles both desktop dialog and mobile sheet, `Adapt.Contents` injects Dialog.Content into Sheet.Frame, breakpoint-driven not platform-driven

See [examples/overlays.md](examples/overlays.md) for controlled Sheet, snap points, ScrollView inside Sheet, and Dialog state preservation.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Use styled() vs Inline Props

```
Is this a reusable component with variants or a semantic name?
├─ YES → styled() with name, variants, defaultVariants
└─ NO → Is this one-off layout?
    ├─ YES → Inline props on XStack/YStack (<YStack padding="$4">)
    └─ NO → styled() if you want component themes or compiler naming
```

### Animation Driver Selection

```
Platform target?
├─ Web only → @tamagui/animations-css (smallest bundle, CSS transitions)
├─ Native only → @tamagui/animations-reanimated (worklet-based, spring physics)
├─ Universal → Configure per-platform in createTamagui
│   ├─ Web: CSS or Motion driver
│   └─ Native: Reanimated or React Native driver
└─ Simple transitions? → @tamagui/animations-react-native (no extra dependency)
```

### Overlay Component Choice

```
Need bottom sheet on mobile?
├─ YES → Is there also a desktop version?
│   ├─ YES → Dialog + Adapt + Sheet (single component tree)
│   └─ NO → Sheet standalone
└─ NO → Dialog (portal-based overlay)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using raw pixel values (`padding: 16`) instead of tokens (`padding: "$4"`) -- bypasses theme system, breaks consistency across platforms
- Conditionally removing the `transition` prop from JSX -- causes expensive spring hook teardown/setup; pass `null` to disable instead
- Missing `as const` on variant definition objects -- TypeScript infers `string` instead of literal union types, losing autocomplete and type safety
- Using `Platform.OS` branching for Dialog vs Sheet -- use `Adapt` instead, which responds to breakpoints and is compiler-optimized
- Hardcoded color strings (`"#fff"`, `"#000"`) in styled components -- breaks dark/light theme switching; use `$background`, `$color`

**Medium Priority Issues:**

- Not setting `name` on styled components that need component-level themes -- without `name`, Tamagui cannot look up component-specific theme variants like `dark_Card`
- Using JavaScript ternaries for responsive styles instead of media query props -- prevents compiler CSS extraction, adds runtime cost
- Nesting `styled(styled())` without `.styleable()` when wrapping with a functional component -- variant merging breaks silently
- Importing from `tamagui` instead of `@tamagui/core` when you only need the core -- pulls in the entire UI kit unnecessarily

**Gotchas & Edge Cases:**

- **Theme nesting is name-based:** `<Theme name="dark"><Theme name="green">` resolves to `dark_green`, not just `green`. The sub-theme must be defined as `dark_green` in your config.
- **`Object.groupBy` on `useMedia()` result fails:** The proxied object from `useMedia` is not iterable -- use direct key access (`media.sm`) only.
- **`Dialog.Sheet` does not preserve state** when transitioning between Sheet and Portal modes. Lift state above the Dialog if persistence is needed.
- **Spread variants (`...size`) only match top-level token categories** -- custom nested token groups require functional variants instead.
- **`elevation` prop** generates both shadow props (iOS) and elevation (Android) on native, but translates to `box-shadow` on web. Differences in shadow appearance across platforms are expected.
- **Config v5 changed flex defaults:** With `styleCompat: 'react-native'`, `flex` uses `flexBasis: 0` (not `auto`). Without it, web defaults apply.
- **The Moti animation driver is deprecated** -- switch to `@tamagui/animations-reanimated` (same API, fewer dependencies).
- **String-to-boolean coercion in config** -- if parsing env vars for config flags, the string `"false"` is truthy in JavaScript. Use explicit comparison (`val === "true"`) not coercion.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `$`-prefixed token values in style props (`$4`, `$color.blue`) -- raw pixel values bypass the token system and break theme consistency)**

**(You MUST keep the `transition` prop present in JSX when using animations -- conditionally removing it causes expensive hook teardown; pass `null` to disable instead)**

**(You MUST add `as const` to variant definition objects -- without it TypeScript cannot infer variant prop types correctly)**

**(You MUST use `Adapt` for responsive Dialog-to-Sheet behavior -- manual Platform.OS branching breaks compiler optimization and misses breakpoint changes)**

**Failure to follow these rules will break theme consistency, cause animation performance issues, lose type safety on variants, and produce non-adaptive overlays.**

</critical_reminders>
