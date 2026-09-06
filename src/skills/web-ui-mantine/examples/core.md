# Mantine v7 - Core Examples

> Setup, styling and layout. See [SKILL.md](../SKILL.md) for decisions,
> [components.md](components.md) for overlays and compound components.

---

## Pattern 1: MantineProvider and PostCSS

```tsx
// app.tsx - root of your application
import "@mantine/core/styles.css";

import { createTheme, MantineProvider } from "@mantine/core";

const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, sans-serif",
  headings: { fontFamily: "Inter, system-ui, sans-serif" },
});

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* Your app content */}
    </MantineProvider>
  );
}
```

**Why good:** the theme is created once at module scope. `createTheme(...)` written inline in the
JSX returns a new object every render, and every theme consumer re-renders with it.

```javascript
// postcss.config.cjs
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};
```

**Why good:** the preset is what compiles `@mixin smaller-than`, `light-dark()` and `rem()`. The
variables are a second copy of `theme.breakpoints` — change one and the CSS and the JS disagree
silently, because nothing checks them against each other.

### SSR

```tsx
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";

<html lang="en" {...mantineHtmlProps}>
  <head>
    <ColorSchemeScript defaultColorScheme="auto" />
  </head>
  <body>
    <App />
  </body>
</html>;
```

**Why good:** `ColorSchemeScript` sets the scheme before first paint, so a dark-mode user never sees
a light flash; `mantineHtmlProps` supplies the attributes it writes, which is what stops React
reporting a hydration mismatch over them.

---

## Pattern 2: CSS Modules with PostCSS Mixins

```css
/* dashboard-card.module.css */
.card {
  padding: var(--mantine-spacing-lg);
  border-radius: var(--mantine-radius-md);
  background: light-dark(
    var(--mantine-color-white),
    var(--mantine-color-dark-6)
  );
  border: rem(1px) solid
    light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4));
  transition: box-shadow 150ms ease;

  @mixin hover {
    box-shadow: var(--mantine-shadow-md);
  }

  @mixin smaller-than $mantine-breakpoint-sm {
    padding: var(--mantine-spacing-md);
  }
}

.title {
  font-size: var(--mantine-font-size-lg);
  font-weight: 700;
  margin-bottom: var(--mantine-spacing-xs);
  color: light-dark(var(--mantine-color-black), var(--mantine-color-white));
}

.metric {
  font-size: rem(32px);
  font-weight: 900;
  line-height: 1;
}
```

```tsx
import { Paper, Text, Group } from "@mantine/core";
import classes from "./dashboard-card.module.css";

interface DashboardCardProps {
  title: string;
  metric: string;
  trend: string;
}

export function DashboardCard({ title, metric, trend }: DashboardCardProps) {
  return (
    <Paper className={classes.card}>
      <Text className={classes.title}>{title}</Text>
      <Group align="flex-end" gap="xs">
        <Text className={classes.metric}>{metric}</Text>
        <Text c="dimmed" fz="sm">
          {trend}
        </Text>
      </Group>
    </Paper>
  );
}
```

**Why good:** nothing runs at render time, and the `--mantine-*` variables mean the card's spacing
and colours move with the theme instead of drifting from it. `@mixin hover` is skipped on touch
devices, where `:hover` would stick.

---

## Pattern 3: Styles API - Targeting Inner Elements

```css
/* custom-input.module.css */
.root {
  margin-bottom: var(--mantine-spacing-md);
}

.label {
  font-weight: 600;
  font-size: var(--mantine-font-size-sm);
  margin-bottom: var(--mantine-spacing-xs);
}

.input {
  border-color: light-dark(
    var(--mantine-color-gray-4),
    var(--mantine-color-dark-4)
  );

  &:focus {
    border-color: var(--mantine-color-blue-6);
  }

  &[data-error] {
    border-color: var(--mantine-color-red-6);
    background-color: light-dark(
      var(--mantine-color-red-0),
      var(--mantine-color-dark-6)
    );
  }
}

.error {
  font-size: var(--mantine-font-size-xs);
}
```

```tsx
import { TextInput } from "@mantine/core";
import classes from "./custom-input.module.css";

// classNames targets specific inner elements
<TextInput
  label="Email address"
  placeholder="you@example.com"
  classNames={{
    root: classes.root,
    label: classes.label,
    input: classes.input,
    error: classes.error,
  }}
/>;
```

**Why good:** the component's inner elements are reachable by name, so error and focus styling needs
no wrapper, no fork and no `!important`. The component publishes `data-error`, so the error state is
a selector rather than a prop you thread.

```tsx
// Alternative: inline styles prop (no pseudo-class support)
<TextInput
  styles={{
    input: { backgroundColor: "var(--mantine-color-blue-0)" },
    label: { fontWeight: 700 },
  }}
/>
```

**Which one:** `classNames` when the rule needs a pseudo-class or will be reused; `styles` for a
one-off, since inline objects cannot express `:focus`.

---

## Pattern 4: Responsive Style Props

```tsx
import { Box, SimpleGrid, Text, Title } from "@mantine/core";

export function ResponsiveLayout() {
  return (
    <Box p={{ base: "sm", sm: "md", lg: "xl" }}>
      <Title order={2} mb="md">
        Dashboard
      </Title>

      <SimpleGrid
        cols={{ base: 1, sm: 2, lg: 4 }}
        spacing={{ base: "sm", lg: "md" }}
      >
        <DashboardCard title="Revenue" metric="$12,450" trend="+12%" />
        <DashboardCard title="Users" metric="1,234" trend="+5%" />
        <DashboardCard title="Orders" metric="456" trend="+8%" />
        <DashboardCard title="Returns" metric="23" trend="-2%" />
      </SimpleGrid>
    </Box>
  );
}
```

**Why good:** breakpoints in JSX with no media query and no `useMediaQuery` — `base` is the
mobile-first value and each named key overrides upward from it.

---

## Pattern 5: AppShell Layout

```tsx
import { AppShell, Burger, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text fw={700}>My App</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavLink label="Dashboard" href="/dashboard" />
        <NavLink label="Settings" href="/settings" />
        <NavLink label="Users" href="/users" />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

**Why good:** `AppShell` owns the header offset and the navbar width, so nothing here hard-codes a
`padding-top` to clear a fixed header. `breakpoint` and `hiddenFrom` keep the collapse rule and the
burger's visibility in agreement.

---

## Pattern 6: Loading States

```tsx
import { Skeleton, Stack, Group, Box, LoadingOverlay } from "@mantine/core";

// Skeleton placeholders matching content layout
export function CardSkeleton() {
  return (
    <Stack gap="sm">
      <Skeleton height={8} radius="xl" />
      <Skeleton height={8} width="70%" radius="xl" />
      <Skeleton height={200} radius="md" mt="sm" />
    </Stack>
  );
}

// LoadingOverlay for existing content
export function DataPanel({ loading, children }: DataPanelProps) {
  return (
    <Box pos="relative" mih={200}>
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        overlayProps={{ radius: "sm", blur: 2 }}
      />
      {children}
    </Box>
  );
}
```

**Why good:** the skeleton's dimensions match what replaces it, so nothing jumps on load.
`LoadingOverlay` covers content already on screen — and it positions against the nearest positioned
ancestor, which is what `pos="relative"` on the wrapper is for.
