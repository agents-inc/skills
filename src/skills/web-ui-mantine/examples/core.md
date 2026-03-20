# Mantine v7 - Core Examples

> Essential setup, styling, and component patterns. See [SKILL.md](../SKILL.md) for decisions and philosophy.

**Prerequisites**: MantineProvider configured, PostCSS preset installed.

---

## Pattern 1: MantineProvider with Full Configuration

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

**Why good:** Theme outside component body prevents re-renders, `defaultColorScheme="auto"` respects OS preference

```tsx
// WRONG - theme inside component causes re-render on every render
function App() {
  return (
    <MantineProvider theme={createTheme({ primaryColor: "blue" })}>
      {/* Theme object recreated every render */}
    </MantineProvider>
  );
}
```

**Why bad:** `createTheme` called inside render creates new object reference every time, triggering unnecessary re-renders of all consumers

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

**Why good:** CSS Modules have zero runtime, PostCSS mixins handle responsive/dark mode, Mantine CSS variables keep values consistent with theme

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

**Why good:** Styles API exposes named selectors for every inner element, CSS Modules provide scoping, `data-error` attribute enables error-state styling

```tsx
// Alternative: inline styles prop (no pseudo-class support)
<TextInput
  styles={{
    input: { backgroundColor: "var(--mantine-color-blue-0)" },
    label: { fontWeight: 700 },
  }}
/>
```

**When to use:** `classNames` for reusable styles with pseudo-classes; `styles` prop for quick one-off overrides

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

**Why good:** Responsive breakpoints in JSX without media queries, `SimpleGrid` handles column layout responsively, `base` is the mobile-first default

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

**Why good:** Responsive navbar collapses on mobile with Burger toggle, `hiddenFrom="sm"` hides burger on desktop, `breakpoint` controls collapse behavior

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

**Why good:** Skeletons match actual content dimensions for smooth transitions, `LoadingOverlay` works on existing content without layout shift, `pos="relative"` on parent contains the overlay
