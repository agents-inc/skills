# Chakra UI v3 - Theming Examples

> Design tokens, semantic tokens, recipes, slot recipes, and dark mode. See [core.md](core.md) for provider setup and style props.

**Prerequisites**: Understand `createSystem` and `defineConfig` from SKILL.md Pattern 1.

---

## Custom Tokens

### Defining Color Tokens

```tsx
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#fce4f3" },
          100: { value: "#f9bde0" },
          200: { value: "#f490c9" },
          300: { value: "#ee63b2" },
          400: { value: "#e9369b" },
          500: { value: "#d53f8c" }, // Primary
          600: { value: "#b7357a" },
          700: { value: "#992b67" },
          800: { value: "#7b2155" },
          900: { value: "#5d1742" },
        },
      },
      fonts: {
        heading: { value: "Inter, sans-serif" },
        body: { value: "Inter, sans-serif" },
      },
      radii: {
        button: { value: "0.5rem" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
```

Token values always use the `{ value: "..." }` format. These become CSS variables: `--chakra-colors-brand-500`.

### Spacing and Size Tokens

```tsx
const config = defineConfig({
  theme: {
    tokens: {
      spacing: {
        "4.5": { value: "1.125rem" },
        "18": { value: "4.5rem" },
      },
      sizes: {
        header: { value: "4rem" },
        sidebar: { value: "16rem" },
      },
    },
  },
});
```

Usage: `<Box p="4.5" h="header" w="sidebar" />`

**Why good:** centralized design decisions, type-safe references, tokens become CSS variables automatically

---

## Semantic Tokens

Semantic tokens map to different values based on conditions (light/dark mode).

```tsx
const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        // Maps to different token values per color mode
        "bg.brand": {
          value: { base: "{colors.brand.50}", _dark: "{colors.brand.900}" },
        },
        "fg.brand": {
          value: { base: "{colors.brand.700}", _dark: "{colors.brand.200}" },
        },
        "border.brand": {
          value: { base: "{colors.brand.200}", _dark: "{colors.brand.700}" },
        },
      },
    },
  },
});
```

Usage:

```tsx
<Box bg="bg.brand" color="fg.brand" borderColor="border.brand" border="1px">
  Adapts to light/dark mode automatically
</Box>
```

**Why good:** single prop value, automatic dark mode, no `_dark` condition needed, references other tokens with `{}`

### Built-in Semantic Tokens

Chakra v3 provides these out of the box:

```tsx
// Background tokens
<Box bg="bg" />          // Page background
<Box bg="bg.subtle" />   // Subtle containers
<Box bg="bg.muted" />    // Muted backgrounds
<Box bg="bg.emphasized" /> // Emphasized backgrounds

// Foreground tokens
<Text color="fg" />          // Primary text
<Text color="fg.muted" />    // Secondary text
<Text color="fg.subtle" />   // Tertiary text

// Border tokens
<Box borderColor="border" />       // Default borders
<Box borderColor="border.muted" /> // Subtle borders

// Color palette semantic tokens (work with colorPalette prop)
<Box bg="colorPalette.solid" />     // Solid fill
<Box bg="colorPalette.muted" />     // Muted fill
<Box bg="colorPalette.subtle" />    // Subtle fill
<Text color="colorPalette.fg" />    // Foreground color
```

---

## Recipes

### Single-Part Recipe

```tsx
import { defineRecipe } from "@chakra-ui/react";

const chipRecipe = defineRecipe({
  className: "chip",
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "1.5",
    rounded: "full",
    fontWeight: "medium",
    transition: "all 0.2s",
  },
  variants: {
    variant: {
      solid: {
        bg: "colorPalette.solid",
        color: "colorPalette.contrast",
      },
      outline: {
        borderWidth: "1px",
        borderColor: "colorPalette.muted",
        color: "colorPalette.fg",
      },
      subtle: {
        bg: "colorPalette.subtle",
        color: "colorPalette.fg",
      },
    },
    size: {
      sm: { px: "2.5", py: "0.5", fontSize: "xs" },
      md: { px: "3", py: "1", fontSize: "sm" },
      lg: { px: "4", py: "1.5", fontSize: "md" },
    },
  },
  compoundVariants: [
    {
      variant: "solid",
      size: "lg",
      css: { fontWeight: "bold" },
    },
  ],
  defaultVariants: {
    variant: "subtle",
    size: "md",
  },
});
```

### Using Recipes with chakra Factory

```tsx
import { chakra } from "@chakra-ui/react";

const Chip = chakra("span", chipRecipe);

// Usage
<Chip variant="solid" colorPalette="green" size="sm">Active</Chip>
<Chip variant="outline" colorPalette="red">Error</Chip>
<Chip variant="subtle" colorPalette="blue" size="lg">Info</Chip>
```

### Using Recipes with useRecipe Hook

```tsx
import { useRecipe } from "@chakra-ui/react";

function Chip(props: ChipProps) {
  const recipe = useRecipe({ recipe: chipRecipe });
  const styles = recipe({ variant: props.variant, size: props.size });

  return <span className={styles} {...props} />;
}
```

### Registering Recipes in Theme

```tsx
const config = defineConfig({
  theme: {
    recipes: {
      chip: chipRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);
```

**Why good:** type-safe variants, `colorPalette` enables palette swapping, compoundVariants for complex conditions

---

## Slot Recipes

For multi-part components with coordinated styling across parts.

```tsx
import { defineSlotRecipe } from "@chakra-ui/react";

const cardSlotRecipe = defineSlotRecipe({
  className: "card",
  slots: ["root", "header", "body", "footer"],
  base: {
    root: {
      bg: "bg",
      rounded: "lg",
      shadow: "sm",
      border: "1px",
      borderColor: "border",
      overflow: "hidden",
    },
    header: {
      p: "4",
      borderBottom: "1px",
      borderColor: "border",
      fontWeight: "semibold",
    },
    body: {
      p: "4",
    },
    footer: {
      p: "4",
      borderTop: "1px",
      borderColor: "border",
      display: "flex",
      justifyContent: "flex-end",
      gap: "2",
    },
  },
  variants: {
    variant: {
      elevated: {
        root: { shadow: "lg", border: "none" },
      },
      outline: {
        root: { shadow: "none" },
      },
      subtle: {
        root: { bg: "bg.subtle", border: "none", shadow: "none" },
      },
    },
    size: {
      sm: {
        header: { p: "3", fontSize: "sm" },
        body: { p: "3" },
        footer: { p: "3" },
      },
      lg: {
        header: { p: "6", fontSize: "lg" },
        body: { p: "6" },
        footer: { p: "6" },
      },
    },
  },
  defaultVariants: {
    variant: "outline",
  },
});
```

### Using Slot Recipes with createSlotRecipeContext

```tsx
import { createSlotRecipeContext } from "@chakra-ui/react";

const { withProvider, withContext } = createSlotRecipeContext({
  recipe: cardSlotRecipe,
});

// Export compound components
const CardRoot = withProvider("div", "root");
const CardHeader = withContext("div", "header");
const CardBody = withContext("div", "body");
const CardFooter = withContext("div", "footer");

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

// Usage
<Card variant="elevated" size="lg">
  <Card.Header>Title</Card.Header>
  <Card.Body>Content here</Card.Body>
  <Card.Footer>
    <Button variant="outline">Cancel</Button>
    <Button colorPalette="blue">Save</Button>
  </Card.Footer>
</Card>;
```

**Why good:** coordinated styles across parts, compound component pattern, variant changes propagate to all slots

---

## Dark Mode Setup

### Color Mode Provider

```bash
# Generate color mode snippet
npx @chakra-ui/cli snippet add color-mode
```

This generates `components/ui/color-mode.tsx` with:

- `ColorModeProvider` - manages color mode state
- `useColorMode` - access current mode
- `ColorModeButton` - pre-built toggle button

### Theme Toggle

```tsx
import { useColorMode } from "@/components/ui/color-mode";
import { IconButton } from "@chakra-ui/react";

export function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      aria-label="Toggle color mode"
      variant="ghost"
      onClick={toggleColorMode}
    >
      {colorMode === "light" ? "Dark" : "Light"}
    </IconButton>
  );
}
```

### Styling for Dark Mode

Three approaches, in order of preference:

```tsx
// 1. BEST: Semantic tokens (automatic adaptation)
<Box bg="bg.subtle" color="fg" borderColor="border">
  Adapts automatically, no extra code
</Box>

// 2. GOOD: _dark condition for one-off overrides
<Box bg="white" color="gray.900" _dark={{ bg: "gray.800", color: "gray.100" }}>
  Explicit per-mode values
</Box>

// 3. OK: Inline condition object
<Box bg={{ base: "white", _dark: "gray.800" }}>
  Inline syntax for inline one-offs
</Box>
```

**Why good:** semantic tokens eliminate conditional logic, `_dark` for edge cases, no runtime hook overhead
