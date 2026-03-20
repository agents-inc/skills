# Chakra UI v3 - Core Examples

> Essential setup, style props, layout components, and form patterns. See [theming.md](theming.md) for tokens and recipes, [composable-components.md](composable-components.md) for overlays.

---

## Provider Setup

### SPA (Client-Side Rendered)

```tsx
// theme.ts
import { createSystem, defaultConfig } from "@chakra-ui/react";

export const system = createSystem(defaultConfig);
```

```tsx
// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

```css
/* index.css - required layer directive */
@layer reset, base, tokens, recipes;
```

### SSR Framework Setup

```tsx
// For SSR frameworks, add suppressHydrationWarning to prevent flash
// and wrap with ColorModeProvider for dark mode support

import { ChakraProvider } from "@chakra-ui/react";
import { ColorModeProvider } from "@/components/ui/color-mode";
import { system } from "./theme";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ChakraProvider value={system}>
          <ColorModeProvider>{children}</ColorModeProvider>
        </ChakraProvider>
      </body>
    </html>
  );
}
```

### Snippet Installation

Chakra v3 provides CLI snippets for pre-built component compositions:

```bash
# Install all snippets
npx @chakra-ui/cli snippet add

# Install specific snippets
npx @chakra-ui/cli snippet add color-mode
npx @chakra-ui/cli snippet add toaster
npx @chakra-ui/cli snippet add provider
```

Snippets are generated into your project (typically `components/ui/`), not installed as packages.

**Why good:** snippets are owned source code you can modify, provider pattern handles SSR edge cases

---

## Layout Components

### Box, Flex, Stack, Grid

```tsx
import { Box, Flex, Stack, Grid, GridItem, Container } from "@chakra-ui/react";

// Box: fundamental building block
<Box bg="bg.subtle" p="4" rounded="lg" border="1px" borderColor="border">
  Content
</Box>

// Flex: flexbox layout
<Flex gap="4" align="center" justify="between" direction={{ base: "column", md: "row" }}>
  <Box>Left</Box>
  <Box>Right</Box>
</Flex>

// Stack: vertical or horizontal stacking
<Stack gap="3" direction={{ base: "column", md: "row" }}>
  <Box>Item 1</Box>
  <Box>Item 2</Box>
  <Box>Item 3</Box>
</Stack>

// Grid: CSS grid layout
<Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap="6">
  <GridItem>Card 1</GridItem>
  <GridItem>Card 2</GridItem>
  <GridItem colSpan={{ lg: 1 }}>Card 3</GridItem>
</Grid>

// Container: centered max-width wrapper
<Container maxW="6xl" px="4">
  Page content
</Container>
```

**Why good:** semantic components, responsive props, gap replaces margin hacks, Container handles centering

---

## Typography

### Text and Heading

```tsx
import { Text, Heading } from "@chakra-ui/react";

// Heading with semantic level
<Heading as="h1" size="2xl" fontWeight="bold">
  Page Title
</Heading>

<Heading as="h2" size="lg" color="fg.muted">
  Section Title
</Heading>

// Text with truncation
<Text fontSize="md" lineHeight="tall" color="fg.default">
  Body text with good readability.
</Text>

<Text truncate maxW="200px">
  This long text will be truncated with an ellipsis
</Text>

// Line clamping
<Text lineClamp={3}>
  This text will be clamped to 3 lines maximum.
  Any overflow beyond the third line will be hidden
  and replaced with an ellipsis indicator.
</Text>
```

**Why good:** semantic heading levels with `as` prop, built-in truncation, lineClamp avoids CSS hacks

---

## Button Patterns

### Variants and States

```tsx
import { Button, IconButton } from "@chakra-ui/react";

// Built-in variants
<Button variant="solid" colorPalette="blue">Primary</Button>
<Button variant="outline" colorPalette="gray">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="plain">Plain</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// States
<Button loading loadingText="Saving...">Save</Button>
<Button disabled>Disabled</Button>

// Icon button
<IconButton aria-label="Settings" variant="ghost" size="sm">
  {/* Your icon component */}
</IconButton>

// With colorPalette for theming
<Button colorPalette="red" variant="solid">Delete</Button>
<Button colorPalette="green" variant="outline">Approve</Button>
```

**Why good:** consistent variants, `loading` prop handles spinner automatically, `colorPalette` swaps all colors

---

## Form Patterns

### Field Component

```tsx
import { Field, Input, Textarea, Stack, Button } from "@chakra-ui/react";

function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Stack gap="4" as="form" onSubmit={handleSubmit}>
      <Field.Root required>
        <Field.Label>Name</Field.Label>
        <Input placeholder="Your name" />
      </Field.Root>

      <Field.Root required invalid={!!errors.email}>
        <Field.Label>Email</Field.Label>
        <Input type="email" placeholder="you@example.com" />
        <Field.HelperText>We will never share your email.</Field.HelperText>
        {errors.email && (
          <Field.ErrorMessage>{errors.email}</Field.ErrorMessage>
        )}
      </Field.Root>

      <Field.Root>
        <Field.Label>Message</Field.Label>
        <Textarea placeholder="Your message" rows={4} />
      </Field.Root>

      <Button type="submit" colorPalette="blue">
        Send Message
      </Button>
    </Stack>
  );
}
```

### Select and Switch

```tsx
import { Field, Select, Switch } from "@chakra-ui/react";

// Select (composable in v3)
<Field.Root>
  <Field.Label>Country</Field.Label>
  <Select.Root>
    <Select.Trigger>
      <Select.ValueText placeholder="Select country" />
    </Select.Trigger>
    <Select.Content>
      <Select.Item item="us">United States</Select.Item>
      <Select.Item item="uk">United Kingdom</Select.Item>
      <Select.Item item="de">Germany</Select.Item>
    </Select.Content>
  </Select.Root>
</Field.Root>

// Switch
<Field.Root>
  <Switch.Root>
    <Switch.Thumb />
    <Switch.Label>Enable notifications</Switch.Label>
  </Switch.Root>
</Field.Root>
```

**Why good:** Field is form-library-agnostic, consistent error/label patterns, Select follows composable pattern

---

## Chakra Factory

### Creating Styled Components

```tsx
import { chakra } from "@chakra-ui/react";

// Basic: add style props to native elements
const StyledLink = chakra("a");
<StyledLink
  href="/about"
  color="blue.500"
  _hover={{ textDecoration: "underline" }}
>
  About Us
</StyledLink>;

// With base styles baked in
const Card = chakra("div", {
  base: {
    bg: "bg.subtle",
    rounded: "lg",
    p: "4",
    shadow: "sm",
    border: "1px",
    borderColor: "border",
  },
});

// With variants
const Badge = chakra("span", {
  base: {
    px: "2",
    py: "0.5",
    rounded: "full",
    fontSize: "xs",
    fontWeight: "bold",
  },
  variants: {
    status: {
      success: { bg: "green.100", color: "green.800" },
      warning: { bg: "yellow.100", color: "yellow.800" },
      error: { bg: "red.100", color: "red.800" },
    },
  },
});

// Usage
<Badge status="success">Active</Badge>;
```

### Wrapping Third-Party Components

```tsx
import { chakra } from "@chakra-ui/react";
import { SomeExternalComponent } from "external-lib";

// Component MUST accept className prop
const StyledExternal = chakra(SomeExternalComponent);

<StyledExternal p="4" bg="bg.subtle" rounded="md" />;
```

**Why good:** adds style props to any element, variants built-in, works with third-party components that accept className

---

## Composition with asChild

### Polymorphic Rendering

```tsx
import { Button, Box } from "@chakra-ui/react";

// Use asChild to render Button styling on a link
<Button asChild colorPalette="blue">
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// Box as a different element
<Box asChild p="4" bg="bg.subtle">
  <section>Content in a section element</section>
</Box>

// Using the as prop (still works for simple cases)
<Heading as="h3" size="lg">Section Title</Heading>
<Button as="a" href="/link">Link styled as button</Button>
```

**Why good:** `asChild` avoids nested interactive elements, merges props onto child, more flexible than `as` prop
