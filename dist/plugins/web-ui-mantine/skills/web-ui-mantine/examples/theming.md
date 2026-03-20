# Mantine v7 - Theming Examples

> Theme customization, custom colors, component defaults, and color scheme management. See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand MantineProvider and createTheme from core examples.

---

## Pattern 1: Custom Colors with 10-Shade Tuples

Every custom color requires exactly 10 shades (index 0 lightest, index 9 darkest). Use Mantine's color generator or define manually.

```tsx
import { createTheme, MantineProvider } from "@mantine/core";

const BRAND_COLORS = [
  "#f0e4ff", // 0 - lightest
  "#d9b8ff", // 1
  "#c28dff", // 2
  "#aa61ff", // 3
  "#9336ff", // 4
  "#7b0bff", // 5
  "#6700d9", // 6
  "#5300b3", // 7
  "#3f008c", // 8
  "#2b0066", // 9 - darkest
] as const;

const theme = createTheme({
  colors: {
    brand: [...BRAND_COLORS],
  },
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 8 },
});
```

Usage in components:

```tsx
// By name (uses primaryShade)
<Button color="brand">Primary Brand</Button>

// By specific shade
<Badge color="brand.3">Light Brand</Badge>

// As CSS variable
<Box bg="brand.1" c="brand.9" p="md">
  Custom colored box
</Box>

// In CSS Modules
// .element { color: var(--mantine-color-brand-6); }
```

**Why good:** Named constant for color tuple, `primaryShade` adjusts for light/dark automatically, dot notation accesses specific shades

---

## Pattern 2: virtualColor for Dark/Light Mode

`virtualColor` creates a color that resolves to different palettes based on the active color scheme.

```tsx
import { createTheme, virtualColor } from "@mantine/core";

const theme = createTheme({
  colors: {
    surface: virtualColor({
      name: "surface",
      dark: "dark", // Uses Mantine's "dark" palette in dark mode
      light: "gray", // Uses Mantine's "gray" palette in light mode
    }),
    primary: virtualColor({
      name: "primary",
      dark: "cyan",
      light: "blue",
    }),
  },
});

// Usage - automatically switches based on color scheme
<Paper bg="surface.1" p="md">
  <Button color="primary">Adaptive Button</Button>
</Paper>;
```

**Why good:** No conditional logic needed in components, color switching is handled at the theme level

---

## Pattern 3: Component Default Overrides

Set default props and styles for any Mantine component globally via the theme.

```tsx
import {
  createTheme,
  Button,
  TextInput,
  Modal,
  Notification,
} from "@mantine/core";

const theme = createTheme({
  components: {
    // Override default props
    Button: Button.extend({
      defaultProps: {
        variant: "filled",
        size: "sm",
        radius: "md",
      },
    }),

    // Override styles via classNames
    TextInput: TextInput.extend({
      classNames: {
        label: "custom-label-class",
      },
      defaultProps: {
        size: "sm",
      },
    }),

    // Override with styles callback
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
      },
    }),

    // Override with CSS variables
    Notification: Notification.extend({
      vars: (theme, props) => ({
        root: {
          "--notification-radius": theme.radius.md,
        },
      }),
    }),
  },
});
```

**Why good:** Reduces prop repetition across the app, consistent defaults enforced at theme level, `Component.extend()` is type-safe

---

## Pattern 4: Auto-Contrast for Accessibility

`autoContrast` automatically selects white or black text based on background luminance.

```tsx
const theme = createTheme({
  autoContrast: true,
  luminanceThreshold: 0.3, // 0-1, default 0.3
});

// Text color automatically adjusts for readability
<Button color="yellow">Dark text on yellow</Button>
<Button color="dark">White text on dark</Button>
```

**Why good:** Ensures WCAG-compliant contrast ratios without manual color calculations, `luminanceThreshold` controls the switching point

---

## Pattern 5: Color Scheme Toggle with Persistence

```tsx
import {
  useMantineColorScheme,
  useComputedColorScheme,
  ActionIcon,
  Group,
  SegmentedControl,
} from "@mantine/core";

// Simple toggle button
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme("light");

  return (
    <ActionIcon
      variant="outline"
      onClick={() =>
        setColorScheme(computedScheme === "dark" ? "light" : "dark")
      }
      aria-label="Toggle color scheme"
    >
      {computedScheme === "dark" ? <SunIcon /> : <MoonIcon />}
    </ActionIcon>
  );
}

// Three-way selector (light / dark / auto)
export function ColorSchemeSelector() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      value={colorScheme}
      onChange={(value) => setColorScheme(value as "light" | "dark" | "auto")}
      data={[
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
        { label: "Auto", value: "auto" },
      ]}
    />
  );
}
```

**Why good:** `useComputedColorScheme` resolves `"auto"` to actual value for toggle logic, SegmentedControl gives three-way choice, localStorage persistence is automatic

---

## Pattern 6: Theme Extension with mergeThemeOverrides

Combine multiple theme configurations for modular theming.

```tsx
import { createTheme, mergeThemeOverrides } from "@mantine/core";

const baseTheme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: "Inter, sans-serif",
});

const darkModeOverrides = createTheme({
  primaryShade: { light: 6, dark: 8 },
});

const componentOverrides = createTheme({
  components: {
    Button: Button.extend({
      defaultProps: { size: "sm" },
    }),
  },
});

// Merge all theme layers
const theme = mergeThemeOverrides(
  baseTheme,
  darkModeOverrides,
  componentOverrides,
);
```

**Why good:** Modular theme composition, later overrides win, each concern is separated into its own createTheme call
