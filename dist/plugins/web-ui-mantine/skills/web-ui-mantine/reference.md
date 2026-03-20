# Mantine v7 Reference

> Decision frameworks, anti-patterns, and quick lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Component Selection

```
Need a UI component?
├─ Is it a form input?
│   ├─ Text → TextInput, Textarea, PasswordInput
│   ├─ Selection (few options) → Select, Radio, SegmentedControl
│   ├─ Selection (many options) → Select with searchable, MultiSelect, Autocomplete
│   ├─ Boolean → Checkbox, Switch
│   ├─ Number → NumberInput, Slider, RangeSlider
│   ├─ Date/Time → DatePickerInput, DateTimePicker, TimeInput (@mantine/dates)
│   └─ File → FileInput, Dropzone (@mantine/dropzone)
├─ Is it an overlay?
│   ├─ Confirmation → Modal (centered)
│   ├─ Side panel → Drawer (slides from edge)
│   ├─ Small contextual → Popover, HoverCard, Tooltip
│   └─ Actions menu → Menu
├─ Is it navigation?
│   ├─ Tabs → Tabs
│   ├─ Collapsible sections → Accordion
│   ├─ Breadcrumbs → Breadcrumbs
│   └─ Pagination → Pagination
├─ Is it layout?
│   ├─ Horizontal → Group (flexbox row)
│   ├─ Vertical → Stack (flexbox column)
│   ├─ Grid → Grid, SimpleGrid
│   ├─ Generic container → Box, Paper, Card
│   └─ App shell → AppShell (header, nav, footer, main)
├─ Is it feedback?
│   ├─ Toast notification → @mantine/notifications
│   ├─ Inline alert → Alert, Notification (component)
│   ├─ Loading → Loader, Skeleton, LoadingOverlay
│   └─ Progress → Progress, RingProgress
└─ Is it typography?
    ├─ Heading → Title
    ├─ Body text → Text
    ├─ Code → Code, CodeHighlight (@mantine/code-highlight)
    └─ Rich text → RichTextEditor (@mantine/tiptap)
```

### Styling Approach Decision

```
How to style a Mantine component?
├─ Quick prototype or one-off? → Style props (p="md", bg="blue.1")
├─ Theme-wide default? → createTheme components with Component.extend()
├─ Targeting inner elements?
│   ├─ With CSS classes → classNames prop + CSS Modules
│   └─ With inline styles → styles prop (no pseudo-classes)
├─ Need responsive layout? → Style props with object syntax: w={{ base: "100%", sm: 400 }}
├─ Need responsive styles in CSS? → PostCSS @mixin smaller-than / larger-than
├─ Need light/dark conditional? → PostCSS light-dark() function
└─ Custom component wrapper? → CSS Modules (.module.css)
```

### Form Architecture Decision

```
Building a form?
├─ Simple form (few fields, basic validation)?
│   └─ useForm with inline validate functions
├─ Complex validation (schemas)?
│   └─ useForm with zodResolver or yupResolver
├─ Dynamic field lists?
│   └─ useForm with insertListItem / removeListItem
├─ Nested objects?
│   └─ useForm with dot-notation paths: 'address.city'
└─ Multi-step form?
    └─ useForm with form.validate() per step, single form instance
```

---

## Anti-Patterns

### Using createStyles (v6 API)

```tsx
// WRONG - createStyles was removed in v7
import { createStyles } from "@mantine/core";
const useStyles = createStyles((theme) => ({
  root: { background: theme.colors.blue[0] },
}));

// CORRECT - CSS Modules
// component.module.css: .root { background: var(--mantine-color-blue-0); }
import classes from "./component.module.css";
<Box className={classes.root} />;
```

### Hardcoding Colors

```tsx
// WRONG - bypasses theming
<Button style={{ backgroundColor: "#228be6" }}>Click</Button>

// CORRECT - use variant system or theme colors
<Button variant="filled" color="blue">Click</Button>
<Button bg="blue.6" c="white">Click</Button>
```

### Wrong Color Scheme Toggle

```tsx
// WRONG - colorScheme can be "auto"
const { colorScheme, toggleColorScheme } = useMantineColorScheme();
const isDark = colorScheme === "dark"; // false when "auto" even if system is dark

// CORRECT - useComputedColorScheme resolves "auto"
const computed = useComputedColorScheme("light");
const isDark = computed === "dark";
```

### Missing form.key() in Uncontrolled Mode

```tsx
// WRONG - missing form.key(), inputs may not reset properly
<TextInput {...form.getInputProps("name")} />

// CORRECT - form.key() provides stable React key
<TextInput key={form.key("name")} {...form.getInputProps("name")} />
```

### Incomplete Custom Color

```tsx
// WRONG - fewer than 10 shades
const theme = createTheme({
  colors: {
    brand: ["#f0e4ff", "#c28dff", "#7b0bff"], // Only 3 shades - TypeScript error
  },
});

// CORRECT - exactly 10 shades required
const theme = createTheme({
  colors: {
    brand: [
      "#f0e4ff",
      "#d9b8ff",
      "#c28dff",
      "#aa61ff",
      "#9336ff",
      "#7b0bff",
      "#6700d9",
      "#5300b3",
      "#3f008c",
      "#2b0066",
    ],
  },
});
```

---

## Quick Reference

### Package Installation

```bash
# Core (required)
npm install @mantine/core @mantine/hooks

# PostCSS (required for CSS Modules mixins)
npm install --save-dev postcss postcss-preset-mantine postcss-simple-vars

# Optional packages
npm install @mantine/form            # Form management
npm install @mantine/notifications   # Toast notifications
npm install @mantine/dates dayjs     # Date components
npm install @mantine/dropzone        # File upload
npm install @mantine/code-highlight  # Code highlighting
npm install @mantine/tiptap          # Rich text editor
npm install @mantine/modals          # Modal manager
npm install @mantine/spotlight       # Spotlight search
npm install @mantine/carousel embla-carousel-react  # Carousel
npm install @mantine/nprogress       # Navigation progress
```

### CSS Import Order

```tsx
// Root of your application - order matters
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; // if using @mantine/dates
import "@mantine/notifications/styles.css"; // if using @mantine/notifications
import "@mantine/dropzone/styles.css"; // if using @mantine/dropzone
import "@mantine/code-highlight/styles.css"; // if using @mantine/code-highlight
import "@mantine/tiptap/styles.css"; // if using @mantine/tiptap
import "@mantine/carousel/styles.css"; // if using @mantine/carousel
import "@mantine/spotlight/styles.css"; // if using @mantine/spotlight
import "@mantine/nprogress/styles.css"; // if using @mantine/nprogress
// Your custom styles last
```

### Common Style Props

| Prop | CSS Property | Example               | Theme Reference   |
| ---- | ------------ | --------------------- | ----------------- |
| `p`  | padding      | `p="md"`              | `theme.spacing`   |
| `m`  | margin       | `m="lg"`              | `theme.spacing`   |
| `w`  | width        | `w={200}`             | px or theme value |
| `h`  | height       | `h={50}`              | px or theme value |
| `bg` | background   | `bg="blue.1"`         | `theme.colors`    |
| `c`  | color        | `c="dimmed"`          | `theme.colors`    |
| `fz` | fontSize     | `fz="sm"`             | `theme.fontSizes` |
| `fw` | fontWeight   | `fw={700}`            | CSS value         |
| `ta` | textAlign    | `ta="center"`         | CSS value         |
| `bd` | border       | `bd="1px solid gray"` | CSS value         |

### PostCSS Mixins Quick Reference

```css
/* Responsive */
@mixin smaller-than 48em {
  /* styles for < 48em */
}
@mixin larger-than 48em {
  /* styles for >= 48em */
}

/* Color scheme */
color: light-dark(black, white);
@mixin light {
  /* light-only styles */
}
@mixin dark {
  /* dark-only styles */
}

/* Interaction */
@mixin hover {
  /* hover styles (skipped on touch) */
}

/* Direction */
@mixin rtl {
  /* RTL-specific styles */
}

/* Units */
font-size: rem(16px); /* converts to rem */
width: em(320px); /* converts to em (for media queries) */

/* Color manipulation */
color: alpha(var(--mantine-color-red-4), 0.5);
border-color: lighten(#ffc, 0.2);
background: darken(#ffc, 0.1);
```

### Styles API Selectors (Common Components)

| Component | Selectors                                           |
| --------- | --------------------------------------------------- |
| Button    | root, inner, label, section, loader                 |
| TextInput | root, wrapper, input, label, description, error     |
| Select    | root, wrapper, input, label, dropdown, option       |
| Modal     | root, overlay, inner, header, title, body, close    |
| Tabs      | root, list, tab, panel                              |
| Accordion | root, item, control, label, chevron, panel, content |
| Menu      | dropdown, item, label, divider                      |

---

## Sources

- [Mantine Official Documentation](https://mantine.dev/)
- [Mantine Getting Started](https://mantine.dev/getting-started/)
- [Mantine Theming](https://mantine.dev/theming/theme-object/)
- [Mantine Styles API](https://mantine.dev/styles/styles-api/)
- [Mantine PostCSS Preset](https://mantine.dev/styles/postcss-preset/)
- [Mantine useForm](https://mantine.dev/form/use-form/)
- [Mantine Color Schemes](https://mantine.dev/theming/color-schemes/)
- [Mantine Notifications](https://mantine.dev/x/notifications/)
- [Mantine v7 Changelog](https://mantine.dev/changelog/7-0-0/)
