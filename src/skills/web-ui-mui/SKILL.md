---
name: web-ui-mui
description: Material UI component library patterns for React
---

# MUI (Material UI) Patterns

> **Quick Guide:** MUI is a pre-styled React component library built on a theme. `createTheme` +
> `ThemeProvider` define the tokens every component reads; `sx` styles one instance, `styled()`
> makes a reusable one, `theme.components` changes every instance, and `slots` / `slotProps` reach
> inner elements. **Current: v7.x (March 2025)** — CSS layers, `slots`/`slotProps` standardised
> everywhere, Grid v2 promoted to `Grid`, React 19 compatible. MUI X v8 covers DataGrid, DatePicker
> and Charts. Emotion is the styling engine; Pigment CSS is still alpha and on hold.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — theme with colour schemes, component overrides, dark-mode menu, TypeScript augmentation, SSR and SPA setup with CSS layers
- [examples/styling.md](examples/styling.md) — `styled()`, custom props via `shouldForwardProp`, `sx` theme-aware, responsive and callback forms
- [examples/form-inputs.md](examples/form-inputs.md) — TextField, Select, Autocomplete, slots and slotProps
- [examples/layout.md](examples/layout.md) — Grid, Stack, Box, Container, responsive card grid
- [examples/navigation.md](examples/navigation.md) — AppBar, Drawer, Tabs, responsive dashboard shell
- [examples/feedback.md](examples/feedback.md) — Dialog, Snackbar, Alert, Skeleton, CircularProgress
- [examples/data-grid.md](examples/data-grid.md) — DataGrid columns, pagination, cell rendering
- [reference.md](reference.md) — component tables, theme structure, `sx` shorthands, breakpoints, package list, v6 → v7 migration, anti-pattern code

---

<critical_requirements>

## Before writing MUI code

**Wrap the app in `ThemeProvider` with a `createTheme()` instance.** Without one, components fall
back to MUI's default theme and render correctly but wrong — no error, just someone else's design.

**Import from the path, not the barrel** — `@mui/material/Button`, not `{ Button } from
"@mui/material"`. The barrel makes the dev server parse the whole package on first load, and
`@mui/icons-material` alone is over 2000 modules.

**Use `slots` and `slotProps` to reach inner elements.** They are the v7 API across every component;
`components` and `componentsProps` are deprecated and scheduled for removal.

**Write dark-mode branches as `theme.applyStyles("dark", { … })`.** It emits both rulesets and lets
CSS pick, so the server and the client agree. `theme.palette.mode === "dark"` decides at render time,
which is what makes the wrong theme flash before hydration.

</critical_requirements>

---

**Auto-detection:** MUI, Material UI, @mui/material, @mui/system, @mui/icons-material,
@mui/x-data-grid, @mui/x-date-pickers, createTheme, ThemeProvider, CssBaseline, sx prop, styled,
useTheme, useColorScheme, colorSchemes, cssVariables, applyStyles, slots, slotProps,
shouldForwardProp, GridColDef, StyledEngineProvider, enableCssLayer

**Applies to:**

- Building on MUI's component set and customising it through the theme rather than by forking
- Choosing between `sx`, `styled()`, `theme.components` and `slots`/`slotProps` for a given override
- Colour schemes and dark mode, including the CSS-variables route that survives server rendering
- Typing custom palette colours and typography variants through module augmentation
- MUI X — DataGrid, date pickers, charts

**Handled elsewhere:**

- CSS methodology and design-token architecture beyond MUI's own theme — `enableCssLayer` puts MUI's
  styles in a named layer so an external stylesheet can order itself against them, and how that
  stylesheet is written is settled elsewhere
- Unstyled primitives — this library arrives fully styled, and a project that wants to own every
  pixel wants headless primitives instead
- Form state and validation — `TextField` takes `error` and `helperText` to render a failure, and
  `inputRef` to hand the underlying `<input>` to a library that registers by ref; what decides those
  values is not this skill's concern
- Server state — components take data as props

---

<philosophy>

**The theme is the product.** Palette, typography, spacing, shadows, breakpoints, z-index and
transitions are all one object, and every component reads from it. An override written at a call
site is a decision that will need repeating; the same decision in `theme.components` is made once.

**Customisation is layered, and the layer is the choice.** `sx` for this instance, `styled()` for a
reusable variant, `theme.components` for every instance, `slots`/`slotProps` for elements inside a
component you do not own. Reaching for a heavier layer than the situation needs is the usual source
of style that cannot be changed later.

**MUI components are client components.** They use context and effects, so a server-rendered app
needs a cache provider above `ThemeProvider` and a client boundary around the pages that use them.

</philosophy>

---

<decision_framework>

## Which styling layer

```
Used in one place                  → sx prop
Reused, same shape each time       → styled()
Every instance in the app          → theme.components.MuiX
An element inside the component    → slots / slotProps
```

## Which layout component

```
One axis, even spacing             → Stack
Twelve-column grid                 → Grid (size prop)
Centred page with a max width      → Container
Anything else that needs sx        → Box
```

## Colour scheme

```
No dark mode                       → one palette in createTheme
Follow the system only             → cssVariables: true
User can choose                    → colorSchemes + useColorScheme
Both, without a flash              → cssVariables: { colorSchemeSelector: "data" } + useColorScheme
```

## MUI X data display

```
Under ~100 rows, read-only         → Table
Sorting, filtering, pagination     → DataGrid
Very large datasets                → DataGridPro (row virtualisation)
Date or time entry                 → DatePicker / DateTimePicker
Charts                             → MUI X Charts
Hierarchy                          → TreeView
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Theme and provider

```tsx
const theme = createTheme({
  palette: { primary: { main: "#1976d2" } },
  typography: {
    fontFamily: '"Inter", sans-serif',
    button: { textTransform: "none" },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
});

<ThemeProvider theme={theme}>
  <CssBaseline />
  {children}
</ThemeProvider>;
```

`CssBaseline` applies MUI's normalisation and the theme's background and text colours to `<body>` —
without it the page around the components keeps the browser defaults.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: CSS variables and dark mode

```tsx
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "data" },
  colorSchemes: {
    light: { palette: { primary: { main: "#1976d2" } } },
    dark: { palette: { primary: { main: "#90caf9" } } },
  },
});

const { mode, setMode } = useColorScheme(); // "light" | "dark" | "system"
```

With `cssVariables`, both palettes are emitted as custom properties and a `data-*` attribute selects
between them, so the scheme is settled before React runs. `mode` is `undefined` on the first render —
guard on it before rendering anything that depends on the scheme.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: The `sx` prop

```tsx
<Box
  sx={{
    p: 3, // theme.spacing(3)
    bgcolor: "background.paper", // theme.palette.background.paper
    borderRadius: 1, // theme.shape.borderRadius
    boxShadow: 3, // theme.shadows[3]
    width: { xs: "100%", md: "50%" },
    "&:hover": { boxShadow: 6 },
  }}
/>
```

Numbers go through the theme's scales and dotted strings resolve against the palette, so a themed
value never needs to be repeated as a literal. Breakpoint objects replace media queries, and an
array of `sx` objects merges left to right — which is how a conditional style is added without
rebuilding the object.

Full code: [examples/styling.md](examples/styling.md)

---

### Pattern 4: `styled()`

```tsx
const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  "&:hover": { boxShadow: theme.shadows[8] },
  ...theme.applyStyles("dark", { backgroundColor: theme.palette.grey[900] }),
}));
```

Reach for this when the same styling appears more than once. A second argument takes
`shouldForwardProp`, which is what stops a styling-only prop reaching the DOM as an unknown
attribute.

Full code: [examples/styling.md](examples/styling.md)

---

### Pattern 5: Slots and slotProps

```tsx
<Autocomplete
  slots={{ paper: CustomPaper }}
  slotProps={{
    paper: { elevation: 8, sx: { borderRadius: 2 } },
    listbox: { sx: { maxHeight: 300 } },
    input: ({ open }) => ({
      sx: { borderColor: open ? "primary.main" : "divider" },
    }),
  }}
  renderInput={(params) => <TextField {...params} label="Framework" />}
/>
```

`slots` replaces an inner component, `slotProps` configures one, and a slotProp written as a callback
receives that slot's own state. Define slot components outside the render — an inline arrow is a new
component type each time, which remounts the slot on every render.

Full code: [examples/form-inputs.md](examples/form-inputs.md)

---

### Pattern 6: Layout

```tsx
<Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 4 }}><Sidebar /></Grid>
  <Grid size={{ xs: 12, md: 8 }}><MainContent /></Grid>
</Grid>

<Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
  <Button variant="contained">Save</Button>
</Stack>

<Container maxWidth="lg" sx={{ py: 4 }}>{children}</Container>
```

In v7 `Grid` is the former Grid2 and takes one `size` prop instead of separate `xs`/`sm`/`md` props;
the previous component is still available as `GridLegacy`.

Full code: [examples/layout.md](examples/layout.md)

---

### Pattern 7: TypeScript augmentation

```ts
declare module "@mui/material/styles" {
  interface Palette {
    neutral: Palette["primary"];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions["primary"];
  }
}
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}
```

Two augmentations, and both are needed: the first makes the token exist on the theme, the second
lets a component accept it as a prop value. Skip the second and `color="neutral"` is a type error at
every call site even though the theme carries it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 8: Server-rendered setup

```tsx
<AppRouterCacheProvider options={{ enableCssLayer: true }}>
  <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {children}
  </ThemeProvider>
</AppRouterCacheProvider>
```

Emotion generates styles as components render, so a server-rendered app needs a cache provider above
`ThemeProvider` to collect and flush them with the streamed HTML — without it the markup arrives
unstyled and restyles on hydration. MUI publishes an adapter package per supported server framework;
a client-only app uses `StyledEngineProvider` in the same position instead. `enableCssLayer` puts
MUI's output into a named layer, and the `@layer` declaration is what fixes the order of that layer
against everything else on the page.

Full code, both arrangements: [examples/core.md](examples/core.md)

</patterns>

---

<performance>

## Performance

**Path imports.** `import Button from "@mui/material/Button"` skips barrel parsing; the barrel form
costs several times the dev-server startup. Some bundlers and frameworks rewrite barrel imports
automatically — check before assuming the cost applies. A lint rule restricting the pattern
`^@mui/[^/]+$` is what keeps it from creeping back.

**Stable references for anything a component treats as identity.** DataGrid `columns`, slot
components, and `Dialog` `TransitionProps` are all compared by reference: define them at module
scope, or memoise them. Inline, they cause a re-render or a remount on every parent render.

**`createTheme` does not affect bundle size** — it is data, not components. The bundle is decided by
which components are imported.

</performance>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `theme.palette.mode === "dark"` in a style function — resolved at render time, so the server and
  the first client paint disagree and the wrong theme flashes
- An inline arrow in `slots` — a new component type each render, so the slot remounts and loses its
  state and focus
- Inline `columns` on a DataGrid — a new array each render, re-rendering the whole grid
- Importing more than one level deep, `@mui/material/styles/createTheme` — the v7 ESM package layout
  does not expose those paths
- `@mui/lab` imports for Alert, Skeleton or Autocomplete — they graduated to `@mui/material` in v7
- MUI components rendered on the server without a client boundary — they need context and effects,
  and the boundary belongs on the page, not only on the root layout

**Surprising behaviour:**

- `spacing` is a multiplier, not pixels: `spacing(2)` is 16px at the default base of 8
- `sx` arrays merge left to right, so a later entry wins — which is what makes conditional styles work
- `TextField` is three components in a trench coat (input, label, helper text), so targeting the
  actual `<input>` means `slotProps.input`
- Setting `zIndex` by hand fights MUI's own scale, where modal, drawer, snackbar and tooltip already
  have assigned values
- `useMediaQuery` returns `false` during server rendering, so a desktop-first branch renders the
  wrong thing before hydration
- `useColorScheme().mode` is `undefined` on the first render, and rendering a scheme-dependent icon
  from it produces a hydration mismatch
- A missing TypeScript augmentation for a custom palette colour is a type error at the usage site,
  not at the theme
- `components` and `componentsProps` still work in v7 but are deprecated

</red_flags>
