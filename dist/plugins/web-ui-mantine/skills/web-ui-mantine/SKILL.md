---
name: web-ui-mantine
description: Mantine v7 component library — theming, styling, hooks, forms, notifications
---

# Mantine v7 Component Patterns

> **Quick Guide:** Mantine is a batteries-included React component library whose v7 rewrite replaced
> Emotion with CSS Modules, so there is no CSS-in-JS runtime. Wrap the app in `MantineProvider` with
> a `createTheme` object, install `postcss-preset-mantine` for the mixins and `light-dark()`, and
> style through one of four routes: style props for one-offs, the Styles API (`classNames` /
> `styles`) for inner elements, CSS Modules for custom components, and `theme.components` for
> app-wide defaults. `@mantine/form`, `@mantine/hooks`, `@mantine/notifications` and `@mantine/dates`
> are separate packages, each with its own stylesheet.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — provider and PostCSS setup, SSR, CSS Modules, Styles API, style props, AppShell, loading states
- [examples/components.md](examples/components.md) — Modal, Drawer, Menu, Tabs, Accordion, notifications, dates
- [examples/theming.md](examples/theming.md) — custom colours, `virtualColor`, component defaults, auto-contrast, theme merging
- [examples/forms.md](examples/forms.md) — `useForm` validation, cross-field rules, nested fields, dynamic lists, schema resolvers
- [reference.md](reference.md) — component selection tree, style-prop and mixin tables, Styles API selectors, package list, anti-patterns

---

<critical_requirements>

## Before writing Mantine code

**Wrap the app in `MantineProvider` and import `@mantine/core/styles.css` at the root.** Every
component reads its CSS variables from the provider, and without the stylesheet they render as
unstyled markup rather than failing loudly.

**Install and configure `postcss-preset-mantine`.** It compiles `@mixin smaller-than`,
`@mixin hover`, `light-dark()` and `rem()`. Without it those lines pass through to the browser as
invalid CSS and are dropped.

**Write custom component styles as CSS Modules.** `createStyles` was removed in v7, and the theme's
values are available to plain CSS as `--mantine-*` custom properties.

**Give a custom colour all ten shades.** The palette is indexed 0 (lightest) to 9 (darkest) and the
type is a 10-tuple, so a short array is a compile error rather than a runtime surprise.

</critical_requirements>

---

**Auto-detection:** Mantine, @mantine/core, @mantine/hooks, @mantine/form, @mantine/notifications,
@mantine/dates, MantineProvider, createTheme, virtualColor, useMantineColorScheme,
useComputedColorScheme, ColorSchemeScript, mantineHtmlProps, useDisclosure, useDebouncedValue,
postcss-preset-mantine, light-dark(), getInputProps, form.key(), classNames prop, styles prop,
Component.extend()

**Applies to:**

- Building on Mantine's 100+ components, and customising them through the theme rather than by
  forking them
- Choosing between style props, the Styles API, CSS Modules and theme defaults for a given override
- Form state with `@mantine/form` — validation, nested paths, dynamic lists
- Colour scheme handling, including the SSR flash and the `auto` resolution trap
- The utility hooks in `@mantine/hooks`

**Handled elsewhere:**

- CSS methodology and design-token architecture beyond Mantine's own theme — the theme publishes
  `--mantine-*` custom properties, and how the rest of your stylesheet is organised is settled
  elsewhere
- Server state — components take data as props, and where it was fetched is not their concern
- Global client state beyond a component's own — `useDisclosure` is a local boolean, not a store
- Schema definition — `useForm` accepts a resolver, and the schema library that produces it is
  settled by whatever owns validation

---

<philosophy>

Mantine is pre-built rather than copy-and-own: you configure components through a theme, not by
holding their source. Two consequences shape everything below.

**The theme is the customisation surface.** Colours, radii, fonts, breakpoints and per-component
default props all live in one `createTheme` object, and every component reads them as CSS variables.
An override written at the call site is a decision that will need repeating.

**Every component exposes its internals by name.** The Styles API gives each inner element a
selector — `input`, `label`, `error`, `dropdown` — reachable through `classNames` and `styles`
without wrapping or forking the component. That is why v7 could drop CSS-in-JS: nothing needs to run
at render time to target an inner node.

</philosophy>

---

<decision_framework>

## Which styling route

```
One-off spacing or colour            → style props: p="md" bg="blue.1"
Every instance of a component        → theme.components with Component.extend()
An inner element, with pseudo-classes → classNames + CSS Modules
An inner element, quick and inline   → styles prop (no pseudo-classes)
A component of your own              → CSS Modules using var(--mantine-*)
Responsive, in JSX                   → style props with object syntax: w={{ base: "100%", sm: 400 }}
Responsive, in CSS                   → @mixin smaller-than / larger-than
Light/dark conditional               → light-dark() or @mixin light / @mixin dark
```

Full component-selection tree and the Styles API selector table: [reference.md](reference.md).

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Provider and theme

```tsx
import "@mantine/core/styles.css";
import { createTheme, MantineProvider } from "@mantine/core";

const theme = createTheme({ primaryColor: "blue", defaultRadius: "md" });

export function App() {
  return <MantineProvider theme={theme}>{/* app */}</MantineProvider>;
}
```

Create the theme at module scope — inline in the JSX it is a new object every render, and every
consumer re-renders with it. Server rendering additionally needs `ColorSchemeScript` in `<head>` and
`mantineHtmlProps` on `<html>`, or the first paint flashes the wrong scheme.

Full code, including `postcss.config.cjs`: [examples/core.md](examples/core.md)

---

### Pattern 2: Components share one prop vocabulary

```tsx
<Button variant="light" color="red" size="md" radius="sm" loading={isSaving} leftSection={<Icon />}>
  Delete
</Button>
<TextInput label="Email" placeholder="you@example.com" withAsterisk error={errors.email} />
<Select label="Role" data={["Admin", "Editor", "Viewer"]} searchable clearable />
<Group gap="md">{/* row */}</Group>
<Stack gap="sm">{/* column */}</Stack>
```

`variant`, `size`, `color` and `radius` mean the same thing on every component, and `Group` / `Stack`
replace hand-written flexbox. `loading`, `withAsterisk` and `error` are states the component already
renders — reimplementing them costs the built-in accessibility wiring.

---

### Pattern 3: Overlays and compound components

```tsx
const [opened, { open, close }] = useDisclosure(false);

<Modal opened={opened} onClose={close} title="Confirm action" centered>
  <Button onClick={close}>Cancel</Button>
</Modal>;
```

Overlays are controlled by `opened` / `onClose`, and `useDisclosure` is the handler set they expect.
Compound components — `Menu.Target` / `Menu.Dropdown`, `Tabs.Tab` / `Tabs.Panel`, `Accordion.Item` —
pair their parts by `value`, so reordering the list cannot desync them.

Full code: [examples/components.md](examples/components.md)

---

### Pattern 4: Styling — the four routes

```tsx
// Style props: theme values, not CSS values
<Box p="md" bg="blue.1" c="blue.9" fz="sm" w={{ base: "100%", sm: 400 }} />

// Styles API: named inner elements
<TextInput classNames={{ input: classes.input, label: classes.label }} />
<TextInput styles={{ input: { backgroundColor: "var(--mantine-color-blue-0)" } }} />
```

```css
/* your-component.module.css */
.card {
  padding: var(--mantine-spacing-md);
  background: light-dark(
    var(--mantine-color-white),
    var(--mantine-color-dark-6)
  );

  @mixin hover {
    box-shadow: var(--mantine-shadow-md);
  }
  @mixin smaller-than $mantine-breakpoint-sm {
    padding: var(--mantine-spacing-sm);
  }
}
```

`classNames` takes classes and so supports pseudo-classes; `styles` takes inline objects and does
not. Both target the same named selectors, listed per component in [reference.md](reference.md).

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Theming

```tsx
const theme = createTheme({
  colors: {
    brand: [...BRAND_COLORS], // exactly 10, index 0 lightest
    surface: virtualColor({ name: "surface", dark: "dark", light: "gray" }),
  },
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 8 },
  components: {
    Button: Button.extend({ defaultProps: { variant: "filled", size: "sm" } }),
  },
});
```

`primaryShade` picks a different index per scheme, so one colour name reads correctly in both.
`virtualColor` goes further and swaps the whole palette. `Component.extend()` sets defaults for
every instance and is type-checked against that component's props.

Full code: [examples/theming.md](examples/theming.md)

---

### Pattern 6: Colour scheme

```tsx
const { setColorScheme } = useMantineColorScheme();
const computed = useComputedColorScheme("light");

<ActionIcon
  onClick={() => setColorScheme(computed === "dark" ? "light" : "dark")}
>
  {computed === "dark" ? <SunIcon /> : <MoonIcon />}
</ActionIcon>;
```

Read the scheme through `useComputedColorScheme`, not through `useMantineColorScheme().colorScheme`.
The second returns the literal setting, which is `"auto"` for the default — so a toggle branching on
it treats a dark system as light. `lightHidden` and `darkHidden` cover the render-one-or-the-other
case without a hook at all.

Full code: [examples/theming.md](examples/theming.md)

---

### Pattern 7: Forms

```tsx
const form = useForm({
  mode: "uncontrolled",
  initialValues: { email: "", termsAccepted: false },
  validate: { email: (v) => (/^\S+@\S+$/.test(v) ? null : "Invalid email") },
});

<TextInput label="Email" withAsterisk key={form.key("email")} {...form.getInputProps("email")} />
<Checkbox label="I accept" key={form.key("termsAccepted")}
  {...form.getInputProps("termsAccepted", { type: "checkbox" })} />
```

`getInputProps` binds value, change handler and error in one spread; `{ type: "checkbox" }` switches
it to `checked`. `mode: "uncontrolled"` is the default and keeps keystrokes out of React's render
path — which is why `form.key()` is required alongside it, to give React a key that survives the
value changing outside its knowledge. Nested paths use dot notation (`address.city`,
`members.0.name`), and list items move through `insertListItem` / `removeListItem`.

Full code, including schema resolvers: [examples/forms.md](examples/forms.md)

---

### Pattern 8: Hooks

```tsx
const [opened, { open, close, toggle }] = useDisclosure(false);
const [debounced] = useDebouncedValue(search, 300);
const isMobile = useMediaQuery("(max-width: 48em)");
const ref = useClickOutside(() => close());
const clipboard = useClipboard({ timeout: 2000 }); // clipboard.copied stays true for the timeout
```

`useDebouncedValue` and `useClickOutside` own their own cleanup. `useMediaQuery` returns `undefined`
during server rendering rather than guessing, so branch on that third state instead of treating it
as `false`.

---

### Pattern 9: Notifications

```tsx
<Notifications position="top-right" />; // once, inside MantineProvider

const id = notifications.show({
  loading: true,
  message: "Uploading…",
  autoClose: false,
});
notifications.update({
  id,
  loading: false,
  message: "Uploaded",
  color: "green",
  autoClose: 3000,
});
```

The renderer mounts once; the API is imperative and callable from anywhere, including outside React.
Update by the returned id rather than showing a second notification.

Full code: [examples/components.md](examples/components.md)

---

### Pattern 10: Dates

```tsx
import "@mantine/dates/styles.css";

<DatesProvider settings={{ locale: "en", firstDayOfWeek: 0 }}>
  <DatePickerInput
    type="range"
    label="Date range"
    value={range}
    onChange={setRange}
  />
</DatesProvider>;
```

Separate package, separate stylesheet, dayjs as a peer. `type` (`default` / `range` / `multiple`)
changes the value's shape rather than the component.

Full code: [examples/components.md](examples/components.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `@mantine/core/styles.css` import — components render as unstyled markup with no error
- No `postcss-preset-mantine` — `@mixin`, `light-dark()` and `rem()` reach the browser as invalid CSS
  and are dropped, so responsive and dark-mode rules silently do nothing
- A package's own stylesheet left out — `@mantine/dates/styles.css`,
  `@mantine/notifications/styles.css` and the rest are separate imports
- `createStyles` — removed in v7
- A custom colour with fewer than ten shades — a TypeScript error, since the palette type is a
  10-tuple
- `createTheme(...)` inline in the JSX — a new theme object every render, re-rendering every consumer

**Surprising behaviour:**

- `useMantineColorScheme().colorScheme` returns `"auto"` when that is the setting, so a toggle
  branching on it misreads a dark system as light — `useComputedColorScheme` resolves it
- `form.key()` is not optional in uncontrolled mode; without it inputs keep stale values after a reset
- Style props take theme values, not CSS values: `p="md"` is `theme.spacing.md`, and `color="blue.6"`
  is shade 6 of the palette rather than a CSS colour
- The PostCSS breakpoint variables are a second copy of `theme.breakpoints` — change one and the CSS
  and the JS disagree with nothing to catch it
- `useMediaQuery` returns `undefined` during server rendering, which is a third state rather than
  `false`
- `light-dark()` here is compiled by the PostCSS preset rather than the native CSS function
- The `style` prop reaches only the outermost element and takes raw CSS values, so a colour written
  there is frozen against the colour scheme — inner elements need `classNames` or `styles`, and a
  theme-aware colour needs `bg` / `c` or a `--mantine-color-*` variable
- **v8 shipped in May 2025.** `@mantine/dates` moved from `Date` objects to `"YYYY-MM-DD"` strings,
  `DatesProvider` dropped `timezone`, and `CodeHighlight` dropped highlight.js. This skill documents
  v7; check the migration guide before upgrading.

</red_flags>
