# Tamagui - Core Patterns

> styled() components, variants, tokens, themes, and compiler optimization. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

---

## Pattern 1: styled() with Variants

### Basic Component with Boolean and Spread Variants

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
      // Spread variant: maps all size tokens automatically
      "...size": (val, { tokens }) => ({
        padding: tokens.size[val] ?? val,
        borderRadius: tokens.radius[val] ?? val,
      }),
    },
    elevated: {
      true: {
        elevation: "$2",
        shadowColor: "$shadowColor",
      },
      false: {
        elevation: "$0",
      },
    },
    transparent: {
      true: {
        backgroundColor: "transparent",
        borderWidth: 0,
      },
    },
  } as const, // REQUIRED for TypeScript variant inference

  defaultVariants: {
    elevated: false,
  },
});

export type CardProps = GetProps<typeof Card>;
```

**Why good:** `name: "Card"` enables component themes (`dark_Card`), `...size` maps token scale automatically, `as const` preserves literal types, `GetProps` derives props from the styled definition, `defaultVariants` provides typed defaults

### Usage

```tsx
<Card size="$4" elevated>
  <SizableText size="$3">Card content</SizableText>
</Card>

<Card size="$2" transparent>
  <SizableText>Transparent card</SizableText>
</Card>
```

---

### Functional Variant with Token Access

```tsx
export const Badge = styled(View, {
  name: "Badge",
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  borderRadius: "$10",

  variants: {
    // Functional variant: receives value + utilities
    status: (val: "success" | "warning" | "error", { theme }) => {
      const colorMap = {
        success: theme.green10,
        warning: theme.yellow10,
        error: theme.red10,
      } as const;
      return {
        backgroundColor: colorMap[val]?.val,
      };
    },
  } as const,
});
```

---

### Composing styled(styled()) and .styleable()

When wrapping a styled component in a functional component (for hooks, logic, etc.), use `.styleable()` to preserve variant merging:

```tsx
const StyledButton = styled(View, {
  name: "Button",
  backgroundColor: "$background",
  paddingHorizontal: "$4",
  paddingVertical: "$2",
  borderRadius: "$3",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",

  variants: {
    variant: {
      primary: { backgroundColor: "$blue10" },
      secondary: { backgroundColor: "$gray5" },
      ghost: { backgroundColor: "transparent" },
    },
  } as const,
});

// .styleable() preserves styled() behavior through functional wrapper
export const Button = StyledButton.styleable<{ loading?: boolean }>(
  ({ loading, children, ...props }, ref) => {
    return (
      <StyledButton ref={ref} opacity={loading ? 0.6 : 1} {...props}>
        {loading ? <Spinner /> : children}
      </StyledButton>
    );
  },
);

// Further composition still works
export const PrimaryButton = styled(Button, {
  variant: "primary",
});
```

**Why good:** `.styleable()` maintains the styled component contract (variants, theme lookups, compiler optimization) through the functional wrapper. Without it, `styled(Button, ...)` cannot merge variants.

---

### Semantic HTML via render Prop (Web)

```tsx
// String render: compiler-optimized, outputs <button> instead of <div>
export const NativeButton = styled(View, {
  render: "button",
  tag: "button",
  cursor: "pointer",
  padding: "$3",
  borderRadius: "$2",
  backgroundColor: "$background",
});

// Runtime override
<Card render="article">
  <SizableText>Semantic article card</SizableText>
</Card>;
```

**Why good:** string `render` prop is compiler-optimized (unlike function render), produces semantic HTML for accessibility, no deoptimization penalty

---

## Pattern 2: Token System

### Defining Tokens with createTokens

```tsx
import { createTokens } from "tamagui";

export const tokens = createTokens({
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    true: 16, // default size when no value specified
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    true: 16,
    "-1": -4,
    "-2": -8, // negative space for overlaps
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    10: 9999, // pill shape
    true: 8,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    5: 500,
  },
  color: {
    white: "#fff",
    black: "#000",
    gray1: "#f8f8f8",
    gray5: "#999",
    gray10: "#333",
  },
});
```

**Key points:** numeric keys (1-10) recommended for Tamagui UI kit compatibility, `true` key provides default when no size specified, negative space tokens enable overlap patterns, all keys auto-prefixed with `$` when used in components.

### Token Access in Components

```tsx
// In JSX -- $ prefix resolves from tokens/theme
<YStack padding="$4" gap="$2" backgroundColor="$background">
  <SizableText size="$5">Token-driven layout</SizableText>
</YStack>;

// Programmatic access
import { getTokens } from "@tamagui/core";
const size4 = getTokens().size[4].val; // 16
const sizeVar = getTokens().size[4].variable; // "--size-4" (CSS variable)
```

---

## Pattern 3: Theme Definition and Switching

### Creating Themes

```tsx
import { createTheme } from "tamagui";

const lightTheme = createTheme({
  background: "#fff",
  backgroundHover: "#f5f5f5",
  backgroundPress: "#eee",
  color: "#000",
  colorHover: "#333",
  borderColor: "#ddd",
  borderColorHover: "#ccc",
  shadowColor: "rgba(0,0,0,0.1)",
  placeholderColor: "#999",
});

const darkTheme = createTheme({
  background: "#111",
  backgroundHover: "#1a1a1a",
  backgroundPress: "#222",
  color: "#fff",
  colorHover: "#eee",
  borderColor: "#333",
  borderColorHover: "#444",
  shadowColor: "rgba(0,0,0,0.5)",
  placeholderColor: "#666",
});

// Sub-themes: dark_blue inherits from dark, overrides specific keys
const darkBlueTheme = createTheme({
  ...darkTheme,
  background: "#0a1628",
  borderColor: "#1a3a5c",
});
```

### Using Themes in the App

```tsx
import { Theme, useTheme, useThemeName } from "tamagui";

// Wrap sections to apply themes
function App() {
  return (
    <Theme name="dark">
      <YStack flex={1} backgroundColor="$background">
        <Header />
        <Theme name="blue">
          {/* Resolves to dark_blue theme */}
          <FeatureSection />
        </Theme>
      </YStack>
    </Theme>
  );
}

// Access theme values programmatically
function CustomComponent() {
  const theme = useTheme();
  const themeName = useThemeName(); // "dark", "dark_blue", etc.

  return (
    <YStack backgroundColor={theme.background.val}>
      <SizableText>Current theme: {themeName}</SizableText>
    </YStack>
  );
}
```

**Why good:** theme nesting composes names automatically, `useTheme()` provides typed access to all theme values, sub-themes only need to override changed keys

---

## Pattern 4: Configuration with createTamagui

### Minimal Config

```tsx
import { createTamagui, createTokens, createFont } from "tamagui";

const bodyFont = createFont({
  family: "Inter, Helvetica, Arial, sans-serif",
  size: { 1: 12, 2: 14, 3: 16, 4: 18, 5: 22, 6: 28 },
  lineHeight: { 1: 18, 2: 20, 3: 24, 4: 26, 5: 30, 6: 36 },
  weight: { 1: "400", 3: "600", 5: "700" },
  letterSpacing: { 1: 0, 3: -0.5 },
});

export const config = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
    dark_blue: darkBlueTheme,
  },
  fonts: {
    body: bodyFont,
    heading: bodyFont, // or a separate heading font
  },
  media: {
    sm: { maxWidth: 640 },
    gtSm: { minWidth: 641 },
    md: { maxWidth: 768 },
    gtMd: { minWidth: 769 },
    lg: { maxWidth: 1024 },
    gtLg: { minWidth: 1025 },
    short: { maxHeight: 820 },
    hoverable: { hover: "hover" },
    touchable: { pointer: "coarse" },
  },
  shorthands: {
    px: "paddingHorizontal",
    py: "paddingVertical",
    mx: "marginHorizontal",
    my: "marginVertical",
    f: "flex",
    w: "width",
    h: "height",
    bg: "backgroundColor",
    br: "borderRadius",
  } as const,
});

// Type augmentation for full IDE support
type AppConfig = typeof config;
declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}
```

### Using Default Config as Starting Point

```tsx
import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "tamagui";

export const config = createTamagui({
  ...defaultConfig,
  // Override only what you need
  themes: {
    ...defaultConfig.themes,
    // Add custom themes
    dark_brand: createTheme({
      ...defaultConfig.themes.dark,
      background: "#0a0a2e",
    }),
  },
});
```

**Why good:** `@tamagui/config/v5` provides Tailwind-aligned breakpoints, Radix Colors v3, pre-built animation presets, and a complete theme system out of the box

---

## Pattern 5: Compiler Optimization Guide

### What Gets Flattened

The compiler performs partial evaluation, analyzing styled() calls and JSX usage to flatten components to native primitives.

```tsx
// BEFORE compilation (developer code)
const MyCard = styled(View, {
  name: "MyCard",
  backgroundColor: "$background",
  padding: "$4",
  borderRadius: "$3",
});

<MyCard elevated />;

// AFTER compilation (web output)
// MyCard → <div class="bg-[var(--background)] p-4 rounded-3" />
// Atomic CSS extracted, component tree flattened
```

### Optimizable vs Non-Optimizable Patterns

```tsx
// OPTIMIZABLE: static token, compiler extracts to CSS
<YStack padding="$4" backgroundColor="$background" />

// OPTIMIZABLE: media query props become @media rules
<YStack padding="$2" $gtMd={{ padding: "$4" }} />

// OPTIMIZABLE: boolean variant with static value
<Card elevated />

// OPTIMIZABLE: spread variant with token value
<Card size="$4" />

// NOT OPTIMIZABLE: runtime ternary
<YStack padding={isExpanded ? "$6" : "$2"} />
// Fix: use media queries if screen-size-dependent,
// or accept runtime cost if truly dynamic

// NOT OPTIMIZABLE: function render prop
<Card render={(props, state) => <CustomCard {...props} />} />
// Fix: use string render prop or accept deoptimization

// NOT OPTIMIZABLE: spread from runtime object
<Card {...dynamicStyles} />
```

### Build Configuration

```tsx
// tamagui.build.ts
import type { TamaguiBuildOptions } from "tamagui";

export default {
  config: "./tamagui.config.ts",
  components: ["tamagui"],
  outputCSS: "./public/tamagui.generated.css",
  disableExtraction: process.env.NODE_ENV === "development",
} satisfies TamaguiBuildOptions;
```

**Key points:** compiler is optional (Tamagui works at runtime without it), recommended for production only, generates output in `.tamagui/` (add to `.gitignore`), `disableExtraction` recommended during development for faster HMR.
