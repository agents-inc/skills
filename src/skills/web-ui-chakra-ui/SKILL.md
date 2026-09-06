---
name: web-ui-chakra-ui
description: Accessible React component library with style props and theming
---

# Chakra UI v3 Patterns

> **Quick Guide:** Chakra UI v3 styles through props (`bg`, `p`, `color`) rather than class names, and composes every complex component from parts (`Dialog.Root`, `Dialog.Content`). It dropped `framer-motion` and `@emotion/styled` — CSS animations and recipes replaced them — and every v2 closed component API (`isOpen`, `useDisclosure`, `extendTheme`) is gone.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — provider setup, layout components, typography, buttons, forms, the `chakra` factory, `asChild`
- [examples/theming.md](examples/theming.md) — custom tokens, semantic tokens, recipes, slot recipes, dark-mode setup
- [examples/composable-components.md](examples/composable-components.md) — Dialog, Menu, Popover, Drawer, Tabs and their controlled forms
- [reference.md](reference.md) — style-prop and semantic-token tables, breakpoints, the v2→v3 migration reference

---

<critical_requirements>

## Before writing Chakra UI code

**Build a system with `createSystem(defaultConfig, config)` and hand it to `ChakraProvider value={system}`.** Components read their tokens, recipes and conditions from that system, and render unstyled without it.

**Declare the cascade layers in your root CSS: `@layer reset, base, tokens, recipes;`.** The generated styles are emitted into those layers, and without the declaration the browser orders them arbitrarily.

**Compose from parts — `Dialog.Root`, `Dialog.Content`, `Dialog.Footer`.** v3 removed the closed component APIs, so the compound form is the only one that exists.

**Style through style props, the `css` prop or the `chakra` factory.** They resolve token values and conditions; a raw `className` string bypasses the token system and the dark-mode adaptation with it.

**Reach for semantic tokens (`bg.subtle`, `fg.muted`) before any per-mode branching.** They already carry a light and a dark value, so most dark-mode work disappears.

</critical_requirements>

---

**Auto-detection:** @chakra-ui/react, ChakraProvider, createSystem, defaultConfig, defaultSystem, defineConfig, defineRecipe, defineSlotRecipe, createSlotRecipeContext, useRecipe, chakra factory, colorPalette, semanticTokens, \_dark, asChild, Field.Root, Dialog.Root, onOpenChange details, @chakra-ui/cli snippet

**Applies to:**

- React screens built from an accessible, composable component set
- Styling through props and conditions rather than a separate stylesheet
- Token-driven theming: raw tokens, semantic tokens, and per-component recipes
- Component variants through `defineRecipe` and `defineSlotRecipe`
- Dark mode with no conditional logic at the call site

**Handled elsewhere:**

- **Form state, schemas and submission** — `Field` supplies the label, help text and error slot plus their ARIA wiring; which runtime owns the values plugs in through `invalid` and the control's own props.
- **Server state and caching** — components take data as props and settle nothing about where it came from.
- **Icons** — v3 ships none; every component that takes an icon takes it as a child.
- **Zero-runtime CSS** — styles are generated at runtime here, so a build-time-only pipeline is a different choice.
- **A separate CSS methodology** — style props, recipes and the `css` prop are the styling surface; mixing a second one means managing layer order yourself.

---

<philosophy>

## Philosophy

Chakra v3 sits on three things: Ark UI for headless behaviour and accessibility, a token-and-recipe API executed through Emotion at runtime, and Park UI as the default look. What follows from that:

1. **Composable over configurable** — compound parts replace prop-heavy components, so any part can be styled, replaced or reordered.
2. **Tokens over hardcoded values** — colours, spacing and radii reference the system, which is what makes a global change one edit.
3. **Recipes over runtime style functions** — variants are declared once and resolved to atomic classes.
4. **Semantic tokens over conditionals** — `bg.subtle` already knows both modes, so the call site carries no branch.
5. **CSS animations over JS** — no animation runtime ships with the library.

</philosophy>

---

<decision_framework>

## Decision Framework

**How should this be styled?**

```
A standard Chakra component            -> style props: <Box bg="blue.500" p="4" />
It needs variants (size, tone, state)  -> defineRecipe
A multi-part component (card, table)   -> defineSlotRecipe + createSlotRecipeContext
A plain element that wants style props -> chakra("div")
A genuine one-off                      -> the css prop, or inline style props
```

**Which overlay?**

```
Destructive confirmation  -> Dialog with role="alertdialog"
Form or detailed content  -> Dialog
Edge-anchored panel       -> Drawer (placement="start" | "end" | "top" | "bottom")
Info anchored to a trigger-> Popover
List of commands          -> Menu
```

**Which form control?**

```
Single-line text     -> Input
Multi-line           -> Textarea
Few options          -> RadioGroup or SegmentedControl
Many options         -> Select
Boolean toggle       -> Switch
Agreement            -> Checkbox
Around any of them   -> Field.Root + Field.Label + Field.ErrorMessage
```

</decision_framework>

---

<patterns>

## Core Patterns

### Pattern 1: Provider Setup

`createSystem` merges your config into the defaults; the result is what `ChakraProvider` distributes.

```tsx
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: { colors: { brand: { 500: { value: "#d53f8c" } } } },
  },
});

export const system = createSystem(defaultConfig, config);

<ChakraProvider value={system}>{children}</ChakraProvider>;
```

Token values always take the `{ value: "..." }` form and become CSS variables. For zero config, import `defaultSystem` instead of calling `createSystem`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Style Props

Props map to CSS properties, with shorthand aliases and token-aware values.

```tsx
<Box bg="blue.500" color="white" p="4" rounded="md" shadow="lg" />;

<Box mt="4" px="6" w="full" maxW="md" mx="auto" />;

<Flex gap="4" align="center" justify="between" wrap="wrap">
  <Text fontSize="lg" fontWeight="bold">
    Title
  </Text>
  <Text color="fg.muted">Subtitle</Text>
</Flex>;
```

Full prop table: [reference.md](reference.md). Layout components: [examples/core.md](examples/core.md)

---

### Pattern 3: Responsive Values

Any style prop takes an object keyed by breakpoint, mobile-first from `base`.

```tsx
<Box
  p={{ base: "4", md: "6", lg: "8" }}
  display={{ base: "block", md: "flex" }}
/>;

<Box p={["4", "4", "6"]} />;
{
  /* positional: base, sm, md, … */
}
<Text fontWeight={{ mdToXl: "bold" }} />;
{
  /* range targeting */
}
<Box hideBelow="md">Wide viewports only</Box>;
```

Breakpoint values: [reference.md](reference.md)

---

### Pattern 4: Composable Components

Every complex component is `Root > Trigger > Content > …`, and `asChild` hands the trigger's props to your own element rather than nesting two interactive nodes.

```tsx
<Dialog.Root>
  <Dialog.Trigger asChild>
    <Button>Open</Button>
  </Dialog.Trigger>
  <Dialog.Backdrop />
  <Dialog.Content>
    <Dialog.Header>Confirm Action</Dialog.Header>
    <Dialog.Body>Are you sure?</Dialog.Body>
    <Dialog.Footer>
      <Dialog.CloseTrigger asChild>
        <Button variant="outline">Cancel</Button>
      </Dialog.CloseTrigger>
      <Button colorPalette="red">Confirm</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

Full code: [examples/composable-components.md](examples/composable-components.md)

---

### Pattern 5: Recipes and Variants

`defineRecipe` for a single element, `defineSlotRecipe` for a multi-part one. `colorPalette.*` values inside a recipe resolve against whatever palette the call site sets.

```tsx
import { chakra, defineRecipe } from "@chakra-ui/react";

const badgeRecipe = defineRecipe({
  base: { display: "inline-flex", rounded: "full", fontWeight: "medium" },
  variants: {
    variant: {
      solid: { bg: "colorPalette.500", color: "white" },
      subtle: { bg: "colorPalette.100", color: "colorPalette.800" },
    },
    size: { sm: { px: "2", fontSize: "xs" }, md: { px: "3", fontSize: "sm" } },
  },
  defaultVariants: { variant: "subtle", size: "sm" },
});

const Badge = chakra("span", badgeRecipe);

<Badge variant="solid" colorPalette="green" size="md">
  Active
</Badge>;
```

Register it with `defineConfig({ theme: { recipes: { badge: badgeRecipe } } })` to reach it through `useRecipe` as well.

Full code: [examples/theming.md](examples/theming.md)

---

### Pattern 6: Dark Mode

Semantic tokens carry both modes, so the common case has no branch at all.

```tsx
<Box bg="bg.subtle" color="fg" borderColor="border" />;

<Box bg="white" _dark={{ bg: "gray.800" }} />;
{
  /* per-mode override */
}
<Box bg={{ base: "white", _dark: "gray.800" }} />;
{
  /* inline condition */
}
```

The provider and toggle come from a generated snippet rather than a package: `npx @chakra-ui/cli snippet add color-mode`.

Full code: [examples/theming.md](examples/theming.md)

---

### Pattern 7: Form Fields

`Field` owns the label, help text, error slot and the ARIA relationships between them; the validity flag comes from wherever the values live.

```tsx
<Stack gap="4">
  <Field.Root required invalid={!!errors.password}>
    <Field.Label>Password</Field.Label>
    <Input type="password" />
    <Field.HelperText>At least 12 characters.</Field.HelperText>
    <Field.ErrorMessage>{errors.password}</Field.ErrorMessage>
  </Field.Root>
  <Button type="submit" colorPalette="blue">
    Sign In
  </Button>
</Stack>
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Rendering without `ChakraProvider` — components silently lose their styles, since there is no system to resolve tokens against.
- `@layer reset, base, tokens, recipes;` missing from the root CSS — layer order is then arbitrary and styles land in the wrong precedence.
- v2 APIs: `isOpen`/`onClose`, `useDisclosure`, `extendTheme`, `ChakraProvider theme={...}` — all removed in v3, none with a deprecation shim.
- Importing `framer-motion` or `@emotion/styled` as Chakra dependencies — dropped in v3; motion is CSS and styled components come from the `chakra` factory.
- Flat sub-component imports — `import { ModalHeader }` and `import { ListItem }` are now `Dialog.Header` and `List.Item`.
- Importing icons from `@chakra-ui/icons` — the package is gone.

**Surprising behaviour:**

- `onOpenChange` receives `{ open: boolean }`, not a bare boolean: `onOpenChange={(details) => setOpen(details.open)}`.
- `is`-prefixed booleans lost the prefix — `disabled`, `loading`, `invalid`, `required`.
- `spacing` on `Stack` is now `gap`.
- `className` strings on a Chakra component are passed through untouched — the token system, the type checking and the dark-mode adaptation all sit on style props instead.
- `colorPalette` swaps the palette for a whole subtree, so every descendant reading `colorPalette.*` changes with it.
- Several "components" are CLI-generated snippets under your own source tree (`npx @chakra-ui/cli snippet add`), not package exports — they are yours to edit and yours to keep updated.
- `useColorModeValue` still works, but a semantic token does the same job without the hook and without the render it costs.
- `defaultSystem` is the zero-config shortcut; reaching for `createSystem(defaultConfig)` with no second argument produces the same thing more slowly.

</red_flags>
