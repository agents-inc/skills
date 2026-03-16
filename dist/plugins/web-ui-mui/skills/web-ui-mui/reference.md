# MUI (Material UI) Reference

> Decision frameworks, anti-patterns, and quick reference for MUI. See [SKILL.md](SKILL.md) for core concepts and [examples/mui.md](examples/mui.md) for practical code examples. **Current: v7.x (March 2025)** - CSS layers, standardized slots, Grid v2 promoted.

---

## Quick Reference: Component Categories

### Layout

| Component   | Purpose                    | Key Props                             |
| ----------- | -------------------------- | ------------------------------------- |
| `Box`       | Base div with sx support   | `component`, `sx`                     |
| `Stack`     | 1D flex layout             | `direction`, `spacing`, `divider`     |
| `Grid`      | 12-column grid (was Grid2) | `container`, `size`, `spacing`        |
| `Container` | Centered content wrapper   | `maxWidth`, `fixed`, `disableGutters` |

### Inputs

| Component      | Purpose               | Key Props                                 |
| -------------- | --------------------- | ----------------------------------------- |
| `TextField`    | Text input with label | `variant`, `size`, `error`, `helperText`  |
| `Select`       | Dropdown select       | `value`, `onChange`, `multiple`           |
| `Autocomplete` | Searchable dropdown   | `options`, `renderInput`, `multiple`      |
| `Checkbox`     | Boolean input         | `checked`, `onChange`, `indeterminate`    |
| `Switch`       | Toggle switch         | `checked`, `onChange`                     |
| `RadioGroup`   | Single-select options | `value`, `onChange`                       |
| `Slider`       | Range input           | `value`, `onChange`, `min`, `max`, `step` |

### Data Display

| Component    | Purpose                | Key Props                               |
| ------------ | ---------------------- | --------------------------------------- |
| `Typography` | Text with theme styles | `variant`, `component`, `gutterBottom`  |
| `Table`      | Simple tabular data    | Standard HTML table anatomy             |
| `List`       | Vertical list          | `dense`, `disablePadding`               |
| `Card`       | Content container      | Uses CardContent, CardActions           |
| `Chip`       | Tag / badge            | `label`, `color`, `onDelete`, `variant` |
| `Avatar`     | User photo / initials  | `src`, `alt`, `sx`                      |
| `Badge`      | Notification count     | `badgeContent`, `color`, `max`          |
| `Tooltip`    | Hover hint             | `title`, `placement`, `arrow`           |

### Navigation

| Component          | Purpose              | Key Props                      |
| ------------------ | -------------------- | ------------------------------ |
| `AppBar`           | Top navigation bar   | `position`, `color`            |
| `Toolbar`          | AppBar content row   | `variant`, `disableGutters`    |
| `Drawer`           | Side navigation      | `variant`, `anchor`, `open`    |
| `Tabs` / `Tab`     | Tab navigation       | `value`, `onChange`, `variant` |
| `Breadcrumbs`      | Location breadcrumbs | `separator`, `maxItems`        |
| `BottomNavigation` | Mobile bottom nav    | `value`, `onChange`            |
| `Menu`             | Popup menu           | `anchorEl`, `open`, `onClose`  |

### Feedback

| Component          | Purpose             | Key Props                                  |
| ------------------ | ------------------- | ------------------------------------------ |
| `Dialog`           | Modal dialog        | `open`, `onClose`, `maxWidth`, `fullWidth` |
| `Snackbar`         | Toast notification  | `open`, `autoHideDuration`, `anchorOrigin` |
| `Alert`            | Status message      | `severity`, `variant`, `onClose`           |
| `Skeleton`         | Loading placeholder | `variant`, `width`, `height`               |
| `Backdrop`         | Full-screen overlay | `open`, `onClick`                          |
| `CircularProgress` | Loading spinner     | `size`, `color`, `variant`                 |
| `LinearProgress`   | Progress bar        | `value`, `variant`, `color`                |

### Surfaces

| Component   | Purpose          | Key Props                    |
| ----------- | ---------------- | ---------------------------- |
| `Paper`     | Elevated surface | `elevation`, `variant`, `sx` |
| `Card`      | Structured card  | Uses CardHeader, CardContent |
| `Accordion` | Expandable panel | `expanded`, `onChange`       |

---

## Theme Structure Reference

```typescript
createTheme({
  // Palette: color tokens
  palette: {
    mode: "light",           // "light" | "dark"
    primary: { main, light, dark, contrastText },
    secondary: { main, light, dark, contrastText },
    error: { main, light, dark, contrastText },
    warning: { main, light, dark, contrastText },
    info: { main, light, dark, contrastText },
    success: { main, light, dark, contrastText },
    text: { primary, secondary, disabled },
    background: { default, paper },
    divider: string,
    action: { active, hover, selected, disabled, focus },
  },

  // Typography: font tokens
  typography: {
    fontFamily: string,
    fontSize: number,         // Default 14
    htmlFontSize: number,     // Default 16
    h1: { fontSize, fontWeight, lineHeight, letterSpacing },
    h2: {},  h3: {},  h4: {},  h5: {},  h6: {},
    subtitle1: {},  subtitle2: {},
    body1: {},  body2: {},
    button: {},  caption: {},  overline: {},
  },

  // Spacing: base unit (default 8px)
  spacing: number | ((factor: number) => string),

  // Breakpoints: responsive thresholds
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },

  // Shape: border radius
  shape: { borderRadius: number },

  // Shadows: 0-24 elevation levels
  shadows: string[],

  // Z-index: stacking order
  zIndex: { mobileStepper, fab, speedDial, appBar, drawer, modal, snackbar, tooltip },

  // Transitions: animation tokens
  transitions: {
    easing: { easeInOut, easeOut, easeIn, sharp },
    duration: { shortest, shorter, short, standard, complex, enteringScreen, leavingScreen },
  },

  // Component overrides
  components: {
    MuiButton: { defaultProps, styleOverrides, variants },
    MuiTextField: { defaultProps, styleOverrides },
    // ...any MUI component
  },

  // CSS Variables mode
  cssVariables: boolean | { colorSchemeSelector: "data" | "class" },

  // Color schemes (enables dark mode)
  colorSchemes: {
    light: { palette: {} },
    dark: { palette: {} },
  },
});
```

---

## sx Prop Shorthand Reference

| Shorthand      | CSS Property       | Theme Key  |
| -------------- | ------------------ | ---------- |
| `m`            | margin             | spacing    |
| `mt`           | margin-top         | spacing    |
| `mr`           | margin-right       | spacing    |
| `mb`           | margin-bottom      | spacing    |
| `ml`           | margin-left        | spacing    |
| `mx`           | margin-left/right  | spacing    |
| `my`           | margin-top/bottom  | spacing    |
| `p`            | padding            | spacing    |
| `pt`           | padding-top        | spacing    |
| `pr`           | padding-right      | spacing    |
| `pb`           | padding-bottom     | spacing    |
| `pl`           | padding-left       | spacing    |
| `px`           | padding-left/right | spacing    |
| `py`           | padding-top/bottom | spacing    |
| `bgcolor`      | background-color   | palette    |
| `color`        | color              | palette    |
| `border`       | border             | borders    |
| `borderColor`  | border-color       | palette    |
| `borderRadius` | border-radius      | shape      |
| `boxShadow`    | box-shadow         | shadows    |
| `gap`          | gap                | spacing    |
| `rowGap`       | row-gap            | spacing    |
| `columnGap`    | column-gap         | spacing    |
| `typography`   | font-\*            | typography |
| `fontWeight`   | font-weight        | typography |
| `fontSize`     | font-size          | typography |
| `zIndex`       | z-index            | zIndex     |

**Spacing values:** Numbers are multiplied by the theme spacing unit (default 8px). `p: 2` = `padding: 16px`.

**Palette values:** Dot-notation strings access the theme palette. `color: "primary.main"` = `color: theme.palette.primary.main`.

---

## Breakpoint Reference

| Breakpoint | Default Min-Width | Typical Use      |
| ---------- | ----------------- | ---------------- |
| `xs`       | 0px               | Mobile portrait  |
| `sm`       | 600px             | Mobile landscape |
| `md`       | 900px             | Tablet           |
| `lg`       | 1200px            | Desktop          |
| `xl`       | 1536px            | Large desktop    |

**In sx prop:** `{ width: { xs: "100%", md: "50%" } }`

**In styled:** `[theme.breakpoints.up("md")]: { width: "50%" }`

**In JavaScript:** `useMediaQuery(theme.breakpoints.up("md"))`

---

## MUI v7 Migration Quick Reference

| v6 Pattern                                                       | v7 Pattern                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `import Grid2 from "@mui/material/Grid2"`                        | `import Grid from "@mui/material/Grid"`              |
| `<Grid2 xs={6} md={4}>`                                          | `<Grid size={{ xs: 6, md: 4 }}>`                     |
| `componentsProps={{ paper: {} }}`                                | `slotProps={{ paper: {} }}`                          |
| `components={{ Paper: MyPaper }}`                                | `slots={{ paper: MyPaper }}`                         |
| `import Alert from "@mui/lab/Alert"`                             | `import Alert from "@mui/material/Alert"`            |
| `import Skeleton from "@mui/lab/Skeleton"`                       | `import Skeleton from "@mui/material/Skeleton"`      |
| `import { createTheme } from "@mui/material/styles/createTheme"` | `import { createTheme } from "@mui/material/styles"` |

---

## Anti-Patterns

### Barrel Imports in Development

```typescript
// WRONG: Parses entire barrel -- 6x slower dev startup
import { Button, TextField, Box } from "@mui/material";
import { Delete, Edit, Save } from "@mui/icons-material";

// CORRECT: Path imports skip barrel parsing
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import DeleteIcon from "@mui/icons-material/Delete";
```

### Dark Mode Conditional with palette.mode

```typescript
// WRONG: Causes SSR flash of wrong theme
const StyledBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#333" : "#fff",
}));

// CORRECT: CSS variables prevent flickering
const StyledBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1a1a2e",
  }),
}));
```

### Hardcoded Values Bypassing Theme

```typescript
// WRONG: No theme consistency, no dark mode, no responsive
<Box style={{ padding: 24, backgroundColor: "#1976d2", borderRadius: 8 }}>

// CORRECT: Theme-aware, responsive, dark-mode safe
<Box sx={{ p: 3, bgcolor: "primary.main", borderRadius: 1 }}>
```

### Inline Slot Components

```typescript
// WRONG: New function reference every render causes remount
<Autocomplete
  slots={{
    paper: (props) => <Paper {...props} elevation={8} />,
  }}
/>

// CORRECT: Stable reference defined outside render
const CustomPaper = (props: PaperProps) => (
  <Paper {...props} elevation={8} />
);

<Autocomplete slots={{ paper: CustomPaper }} />
```

### Inline DataGrid Column Definitions

```typescript
// WRONG: New array every render causes DataGrid re-render
function Table({ rows }) {
  return (
    <DataGrid
      rows={rows}
      columns={[
        { field: "id", headerName: "ID", width: 90 },
      ]}
    />
  );
}

// CORRECT: Static array defined outside component
const columns: GridColDef[] = [
  { field: "id", headerName: "ID", width: 90 },
];

function Table({ rows }) {
  return <DataGrid rows={rows} columns={columns} />;
}
```

### Deep Imports Beyond One Level

```typescript
// WRONG: Broken in v7 ESM package layout
import createTheme from "@mui/material/styles/createTheme";

// CORRECT: Maximum one level deep
import { createTheme } from "@mui/material/styles";
```

---

## Installation Reference

### Core MUI

```bash
npm i @mui/material @emotion/react @emotion/styled
```

### With Icons

```bash
npm i @mui/material @emotion/react @emotion/styled @mui/icons-material
```

### With Next.js

```bash
npm i @mui/material @emotion/react @emotion/styled @emotion/cache @mui/material-nextjs
```

### MUI X Components

```bash
# DataGrid (free)
npm i @mui/x-data-grid

# DataGrid Pro (paid license)
npm i @mui/x-data-grid-pro

# Date Pickers
npm i @mui/x-date-pickers dayjs

# Charts
npm i @mui/x-charts

# Tree View
npm i @mui/x-tree-view
```
