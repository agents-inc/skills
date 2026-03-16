---
name: web-ui-mui
description: Material UI component library patterns for React
---

# MUI (Material UI) Patterns

> **Quick Guide:** MUI provides pre-styled React components implementing Material Design. Use `createTheme` + `ThemeProvider` for global theming, `sx` prop for one-off styles, `styled()` for reusable styled components, and `slots`/`slotProps` for deep component customization. Prefer path imports in development for faster builds. **Current: v7.x (March 2025)** - CSS layers support, standardized slot pattern, Grid v2 promoted, React 19 compatible. MUI X v8 for DataGrid, DatePicker, Charts.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap the app in `ThemeProvider` with a `createTheme()` instance -- never use MUI components without a theme)**

**(You MUST use path imports (`@mui/material/Button`) in development for faster startup -- barrel imports (`@mui/material`) cause 6x slower dev builds)**

**(You MUST use `slots`/`slotProps` for component inner-element customization -- `componentsProps` is deprecated in v7)**

**(You MUST use `theme.applyStyles('dark', {...})` for dark mode conditional styles -- never use `theme.palette.mode === 'dark'` which causes flickering)**

</critical_requirements>

---

**Auto-detection:** MUI, Material UI, @mui/material, @mui/system, @mui/icons-material, @mui/x-data-grid, @mui/x-date-pickers, createTheme, ThemeProvider, sx prop, styled, CssBaseline, useTheme, useMediaQuery, DataGrid, DatePicker, AppBar, Drawer, Dialog, Snackbar, TextField, Autocomplete, slotProps

**When to use:**

- Building React applications with pre-styled Material Design components
- Creating themed UIs with consistent design tokens (palette, typography, spacing)
- Implementing complex data views with DataGrid, DatePicker, or Charts (MUI X)
- Building admin dashboards, forms, and CRUD interfaces rapidly

**When NOT to use:**

- Headless/unstyled components needed (use Radix UI or Base UI)
- Minimal bundle size is critical (MUI adds significant weight)
- Non-Material Design aesthetic required without heavy theme customization
- Server Components needed as primary rendering strategy (MUI components are client-only)

**Detailed Resources:**

- For practical code examples (theme setup, forms, layout, DataGrid, dark mode), see [examples/mui.md](examples/mui.md)
- For decision frameworks, anti-patterns, and quick reference tables, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

MUI implements Material Design as a comprehensive React component library. It provides:

- **Design System**: Complete palette, typography, spacing, shadows, and breakpoint tokens
- **Pre-styled Components**: 50+ components with consistent visual language
- **Customization Layers**: From simple `sx` overrides to deep theme-level component restyling
- **Accessibility**: Built-in ARIA attributes, keyboard navigation, and focus management

**Core Principle:** Theme drives everything. Define your design tokens in `createTheme()`, and all components inherit consistent styling. Override at the component level with `sx`, `styled()`, or `slots`/`slotProps`.

**MUI v7 Key Changes (March 2025):**

- CSS layers support via `enableCssLayer` (integrates with Tailwind CSS v4)
- Standardized `slots`/`slotProps` across all components (replaces `components`/`componentsProps`)
- Grid v2 promoted to `Grid` (old Grid renamed to `GridLegacy`)
- Lab components graduated to `@mui/material` (Alert, Skeleton, Autocomplete, etc.)
- Package layout updated for ESM/CJS dual support (no deep imports beyond one level)
- React 19 full compatibility

**Pigment CSS Status:** MUI's zero-runtime CSS-in-JS engine is currently **on hold / alpha**. Production apps should continue using the default Emotion-based styling engine.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Theme Setup and Configuration

Every MUI app starts with `createTheme()` and `ThemeProvider`. The theme defines all design tokens.

#### Basic Theme Setup

```typescript
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
      contrastText: "#fff",
    },
    secondary: {
      main: "#9c27b0",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "2.5rem", fontWeight: 600 },
    button: { textTransform: "none" }, // Disable uppercase buttons
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8, // Base unit: theme.spacing(1) = 8px
});

function App({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalize + baseline styles */}
      {children}
    </ThemeProvider>
  );
}

export { App };
```

**Why good:** Centralized design tokens, CssBaseline normalizes cross-browser styles, all children inherit theme

```typescript
// BAD: Using MUI components without ThemeProvider
import Button from "@mui/material/Button";

function App() {
  return <Button variant="contained">Click me</Button>; // No theme context
}
```

**Why bad:** Components render with default theme instead of your design tokens, inconsistent styling across the app

---

### Pattern 2: CSS Variables and Color Schemes (Dark Mode)

MUI v6+ supports CSS variables natively. Use `colorSchemes` in the theme for light/dark mode without flickering.

#### CSS Variables Theme with Dark Mode

```typescript
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "data", // Uses [data-mui-color-scheme="dark"]
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1976d2" },
        background: { default: "#fafafa", paper: "#fff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#90caf9" },
        background: { default: "#121212", paper: "#1e1e1e" },
      },
    },
  },
});

export { theme };
```

#### Color Scheme Toggle Component

```typescript
"use client";

import { useColorScheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";

function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  return (
    <IconButton
      onClick={() => setMode(mode === "light" ? "dark" : "light")}
      color="inherit"
      aria-label="toggle color mode"
    >
      {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
    </IconButton>
  );
}

export { ColorModeToggle };
```

**Why good:** CSS variables prevent flash of wrong theme on SSR, `useColorScheme` persists preference to localStorage, no JavaScript palette-mode checks needed

```typescript
// BAD: Checking palette.mode for conditional dark styles
const StyledBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#333" : "#fff", // Causes flickering on SSR
}));
```

**Why bad:** `theme.palette.mode` causes flash of incorrect styles on page load -- use `theme.applyStyles('dark', {...})` instead

#### Correct Dark Mode Conditional Styling

```typescript
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";

const StyledBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1a1a2e",
    borderColor: "#16213e",
  }),
}));

export { StyledBox };
```

---

### Pattern 3: The sx Prop

The `sx` prop is MUI's primary styling escape hatch. It accesses theme values, supports responsive breakpoints, and handles pseudo-selectors.

#### Theme-Aware Values

```typescript
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function ProfileCard() {
  return (
    <Box
      sx={{
        p: 3,                              // padding: theme.spacing(3) = 24px
        m: 2,                              // margin: theme.spacing(2) = 16px
        bgcolor: "background.paper",       // theme.palette.background.paper
        color: "text.primary",             // theme.palette.text.primary
        borderRadius: 1,                   // theme.shape.borderRadius * 1
        boxShadow: 3,                      // theme.shadows[3]
        "&:hover": {
          boxShadow: 6,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        Profile
      </Typography>
    </Box>
  );
}

export { ProfileCard };
```

#### Responsive Values

```typescript
import Box from "@mui/material/Box";

// Object syntax: breakpoint keys map to values
<Box
  sx={{
    width: { xs: "100%", sm: "50%", md: "33.33%" },
    display: { xs: "block", md: "flex" },
    p: { xs: 1, sm: 2, md: 3 },
    fontSize: { xs: "0.875rem", md: "1rem" },
  }}
/>

// Array syntax (mobile-first): [xs, sm, md, lg, xl]
<Box sx={{ width: ["100%", "50%", "33.33%"] }} />
```

#### Callback Syntax for Complex Theme Access

```typescript
import Box from "@mui/material/Box";

<Box
  sx={(theme) => ({
    ...theme.typography.body2,
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.up("md")]: {
      padding: theme.spacing(4),
    },
  })}
/>
```

**Why good:** Theme-aware shorthand properties, responsive without media queries, callback for complex theme access

```typescript
// BAD: Inline styles bypassing theme
<Box style={{ padding: 24, backgroundColor: "#1976d2", borderRadius: 8 }}>
```

**Why bad:** Hardcoded values, no theme consistency, no responsive support, no dark mode awareness

---

### Pattern 4: styled() API for Reusable Components

Use `styled()` when you need a reusable component with theme-aware styles. Prefer `sx` for one-off styles.

#### Creating Styled Components

```typescript
import { styled } from "@mui/material/styles";
import Card from "@mui/material/Card";

const HOVER_ELEVATION = 8;

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  transition: theme.transitions.create(["box-shadow", "transform"], {
    duration: theme.transitions.duration.short,
  }),
  "&:hover": {
    boxShadow: theme.shadows[HOVER_ELEVATION],
    transform: "translateY(-4px)",
  },
  ...theme.applyStyles("dark", {
    backgroundColor: theme.palette.grey[900],
    border: `1px solid ${theme.palette.grey[800]}`,
  }),
}));

export { StyledCard };
```

#### Styled with Custom Props

```typescript
import { styled } from "@mui/material/styles";
import Chip from "@mui/material/Chip";

interface StatusChipProps {
  status: "active" | "inactive" | "pending";
}

const STATUS_COLORS = {
  active: "success",
  inactive: "error",
  pending: "warning",
} as const;

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "status",
})<StatusChipProps>(({ theme, status }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette[STATUS_COLORS[status]].light,
  color: theme.palette[STATUS_COLORS[status]].dark,
}));

export { StatusChip };
```

**Why good:** Reusable, theme-aware, `shouldForwardProp` prevents custom props from reaching the DOM

```typescript
// BAD: Creating styled components for single-use styles
const MyOneOffBox = styled(Box)({ padding: 16, marginTop: 8 });
// Use sx prop instead for one-off styles
```

**Why bad:** Over-engineering -- `sx` prop is simpler for non-reusable styles

---

### Pattern 5: Theme Component Overrides

Override default props, styles, and add custom variants globally via `createTheme`.

#### Global Component Customization

```typescript
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 2,
          textTransform: "none",
          fontWeight: 600,
        }),
        containedPrimary: ({ theme }) => ({
          "&:hover": {
            backgroundColor: theme.palette.primary.dark,
          },
        }),
      },
      variants: [
        {
          props: { variant: "dashed" as string },
          style: ({ theme }) => ({
            border: `2px dashed ${theme.palette.primary.main}`,
            backgroundColor: "transparent",
            color: theme.palette.primary.main,
          }),
        },
      ],
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 2,
          boxShadow: theme.shadows[2],
        }),
      },
    },
  },
});

export { theme };
```

**Why good:** Consistent defaults across the app, no repetitive prop passing, custom variants extend the component API

---

### Pattern 6: Slots and SlotProps (v7 Standard)

In MUI v7, `slots` and `slotProps` are the standardized API for customizing component inner elements. The older `components`/`componentsProps` API is deprecated.

#### Customizing Component Internals

```typescript
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";

function CustomAutocomplete() {
  return (
    <Autocomplete
      options={["React", "Angular", "Vue", "Svelte"]}
      slots={{
        paper: Paper, // Replace the dropdown paper component
      }}
      slotProps={{
        paper: {
          elevation: 8,
          sx: { borderRadius: 2, mt: 1 },
        },
        listbox: {
          sx: { maxHeight: 300 },
        },
        popper: {
          "data-testid": "autocomplete-popper",
        },
      }}
      renderInput={(params) => (
        <TextField {...params} label="Framework" />
      )}
    />
  );
}

export { CustomAutocomplete };
```

#### Callback SlotProps for State-Based Customization

```typescript
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

<Select
  value={value}
  onChange={handleChange}
  slotProps={{
    input: ({ open }) => ({
      sx: {
        borderColor: open ? "primary.main" : "divider",
      },
    }),
  }}
>
  <MenuItem value="one">Option One</MenuItem>
  <MenuItem value="two">Option Two</MenuItem>
</Select>
```

**Why good:** Standardized API across all MUI components, callback provides access to component state, replaces deprecated patterns

```typescript
// BAD: Using deprecated componentsProps (v5/v6 pattern)
<Autocomplete
  componentsProps={{
    paper: { elevation: 8 },      // Deprecated in v7
  }}
/>
```

**Why bad:** `componentsProps` is deprecated in v7 -- use `slotProps` for all component customization

---

### Pattern 7: Layout Components

MUI provides `Box`, `Stack`, `Grid`, and `Container` for layout. In v7, `Grid` is the former Grid2.

#### Box -- Base Layout Primitive

```typescript
import Box from "@mui/material/Box";

// Box renders a <div> by default and accepts all sx shorthand
<Box
  component="section"
  sx={{
    display: "flex",
    alignItems: "center",
    gap: 2,
    p: 3,
    bgcolor: "background.paper",
    borderRadius: 1,
  }}
>
  {children}
</Box>
```

#### Stack -- One-Dimensional Layout

```typescript
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";

// Stack arranges children along a single axis with consistent spacing
<Stack
  direction={{ xs: "column", sm: "row" }}
  spacing={2}
  divider={<Divider orientation="vertical" flexItem />}
  sx={{ alignItems: "center" }}
>
  <Button variant="contained">Save</Button>
  <Button variant="outlined">Cancel</Button>
  <Button color="error">Delete</Button>
</Stack>
```

#### Grid -- Two-Dimensional 12-Column Layout

```typescript
import Grid from "@mui/material/Grid";

const SIDEBAR_COLUMNS = 4;
const MAIN_COLUMNS = 8;
const FULL_WIDTH_COLUMNS = 12;

// In v7, Grid is the former Grid2 (container + item are automatic)
<Grid container spacing={3}>
  <Grid size={{ xs: FULL_WIDTH_COLUMNS, md: SIDEBAR_COLUMNS }}>
    <Sidebar />
  </Grid>
  <Grid size={{ xs: FULL_WIDTH_COLUMNS, md: MAIN_COLUMNS }}>
    <MainContent />
  </Grid>
</Grid>
```

#### Container -- Centered Content Wrapper

```typescript
import Container from "@mui/material/Container";

// maxWidth constrains width and centers content
<Container maxWidth="lg" sx={{ py: 4 }}>
  {children}
</Container>
```

**When to use each:**

- **Box**: Flex container, section wrapper, base element with sx
- **Stack**: Button groups, form rows, toolbar items (single axis)
- **Grid**: Dashboard layouts, card grids, sidebar + main (12-column)
- **Container**: Page-level centering with maxWidth constraint

---

### Pattern 8: TypeScript Theme Augmentation

Extend MUI's theme type system when adding custom palette colors, typography variants, or component props.

#### Custom Palette Colors

```typescript
// theme-augmentation.d.ts
import type {} from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    neutral: Palette["primary"];
    brand: Palette["primary"];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions["primary"];
    brand?: PaletteOptions["primary"];
  }
}

// Extend component props to accept custom colors
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    neutral: true;
    brand: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    neutral: true;
    brand: true;
  }
}
```

#### Using Custom Colors in Theme

```typescript
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    neutral: {
      main: "#64748b",
      light: "#94a3b8",
      dark: "#475569",
      contrastText: "#fff",
    },
    brand: {
      main: "#7c3aed",
      light: "#a78bfa",
      dark: "#5b21b6",
      contrastText: "#fff",
    },
  },
});

export { theme };
```

```typescript
// Now TypeScript allows custom colors on components
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";

<Button color="brand" variant="contained">Brand Action</Button>
<Chip color="neutral" label="Draft" />
```

#### Custom Typography Variants

```typescript
declare module "@mui/material/styles" {
  interface TypographyVariants {
    label: React.CSSProperties;
    code: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    label?: React.CSSProperties;
    code?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    label: true;
    code: true;
  }
}
```

**Why good:** Full type safety for custom theme properties, IDE autocomplete for custom colors/variants, compile-time validation

---

### Pattern 9: Feedback Components

MUI provides Dialog, Snackbar, Alert, and Skeleton for user feedback patterns.

#### Dialog with Form

```typescript
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

function EditDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSave = () => {
    onSave(name);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { EditDialog };
```

#### Snackbar with Alert

```typescript
import { useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const AUTO_HIDE_DURATION_MS = 4000;

function Notification() {
  const [open, setOpen] = useState(false);

  return (
    <Snackbar
      open={open}
      autoHideDuration={AUTO_HIDE_DURATION_MS}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert
        onClose={() => setOpen(false)}
        severity="success"
        variant="filled"
        sx={{ width: "100%" }}
      >
        Changes saved successfully
      </Alert>
    </Snackbar>
  );
}

export { Notification };
```

#### Skeleton Loading State

```typescript
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

function CardSkeleton() {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="rounded" width={100} height={36} />
    </Stack>
  );
}

export { CardSkeleton };
```

---

### Pattern 10: Navigation Components

AppBar, Drawer, Tabs, and Breadcrumbs for application navigation.

#### AppBar with Responsive Drawer

```typescript
import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const DRAWER_WIDTH = 280;

function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
              aria-label="open navigation menu"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap>
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? "permanent" : "temporary"}
        open={isDesktop || drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {/* Navigation items */}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>
    </Box>
  );
}

export { AppLayout };
```

#### Tabs with Panels

```typescript
import { useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function SettingsTabs() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, newValue: number) => setTab(newValue)}
        aria-label="settings tabs"
      >
        <Tab label="General" id="tab-0" aria-controls="tabpanel-0" />
        <Tab label="Security" id="tab-1" aria-controls="tabpanel-1" />
        <Tab label="Notifications" id="tab-2" aria-controls="tabpanel-2" />
      </Tabs>
      <TabPanel value={tab} index={0}>General settings</TabPanel>
      <TabPanel value={tab} index={1}>Security settings</TabPanel>
      <TabPanel value={tab} index={2}>Notification settings</TabPanel>
    </Box>
  );
}

export { SettingsTabs, TabPanel };
```

---

### Pattern 11: Next.js App Router Integration

MUI requires specific SSR configuration for Next.js. Components are client-rendered but support server-side rendering (not React Server Components).

#### Root Layout Setup

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/theme";

export const metadata: Metadata = {
  title: "My App",
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

export default RootLayout; // Next.js requires default export for layouts
```

#### Installation for Next.js

```bash
npm i @mui/material @mui/material-nextjs @emotion/react @emotion/cache @emotion/styled
```

#### With CSS Layers (for Tailwind v4 Integration)

```typescript
// app/layout.tsx
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import { StyledEngineProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { theme } from "@/theme";

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <StyledEngineProvider enableCssLayer>
            <GlobalStyles
              styles="@layer theme, mui, utilities;"
            />
            <ThemeProvider theme={theme}>
              <CssBaseline />
              {children}
            </ThemeProvider>
          </StyledEngineProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

export default RootLayout;
```

**Why good:** `AppRouterCacheProvider` prevents style hydration mismatches, CSS layers enable predictable specificity with Tailwind

---

### Pattern 12: CSS Layers (v7 Feature)

CSS layers wrap MUI styles in `@layer mui`, allowing predictable specificity control with external CSS frameworks.

#### Client-Side App (Vite)

```typescript
import { StyledEngineProvider } from "@mui/material/styles";
import { ThemeProvider } from "@mui/material/styles";
import GlobalStyles from "@mui/material/GlobalStyles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";

function App({ children }: { children: React.ReactNode }) {
  return (
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, mui, utilities;" />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export { App };
```

**Why good:** MUI styles in `@layer mui` have lower specificity than unlayered Tailwind utilities, eliminating `!important` hacks

**When to use:** Integrating MUI with Tailwind CSS v4 or other CSS layer-based frameworks

</patterns>

---

<performance>

## Performance Optimization

### Import Optimization

```typescript
// GOOD: Path imports -- fast in development
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

// BAD: Barrel imports -- 6x slower dev startup
import { Button, TextField, Box } from "@mui/material";
```

Path imports skip barrel file parsing, which significantly impacts development build times. In production, modern bundlers tree-shake correctly either way.

**Exception:** Next.js 13.5+ auto-optimizes barrel imports via `optimizePackageImports`, making either import style equivalent.

### Icons Import

```typescript
// GOOD: Path import for icons
import DeleteIcon from "@mui/icons-material/Delete";

// BAD: Named import from barrel -- extremely slow
import { Delete } from "@mui/icons-material";
```

`@mui/icons-material` contains 2000+ icon modules. Barrel imports force the bundler to parse all of them.

### Memoize Expensive Props

```typescript
import { useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

// GOOD: Define columns outside component or memoize
const columns: GridColDef[] = [
  { field: "id", headerName: "ID", width: 90 },
  { field: "name", headerName: "Name", flex: 1 },
];

function UserTable({ rows }: { rows: User[] }) {
  return <DataGrid rows={rows} columns={columns} />;
}

// BAD: Columns defined inline -- causes re-render on every parent render
function UserTable({ rows }: { rows: User[] }) {
  return (
    <DataGrid
      rows={rows}
      columns={[
        { field: "id", headerName: "ID", width: 90 },
        { field: "name", headerName: "Name", flex: 1 },
      ]}
    />
  );
}
```

### Slots Reference Stability

```typescript
// GOOD: Define custom slot components outside the render function
const CustomPaper = (props: PaperProps) => (
  <Paper {...props} elevation={8} sx={{ borderRadius: 2 }} />
);

function MyAutocomplete() {
  return (
    <Autocomplete
      slots={{ paper: CustomPaper }}
      // ...
    />
  );
}

// BAD: Inline component in slots causes remount every render
function MyAutocomplete() {
  return (
    <Autocomplete
      slots={{
        paper: (props) => <Paper {...props} elevation={8} />, // New ref each render
      }}
    />
  );
}
```

### ESLint Rule for Import Enforcement

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "regex": "^@mui/[^/]+$",
            "message": "Use path imports: import Button from '@mui/material/Button'"
          }
        ]
      }
    ]
  }
}
```

</performance>

---

<decision_framework>

## Decision Framework

### Styling Approach

```
How many places will this style be used?
├── One place → sx prop (inline, theme-aware)
├── Multiple places (same component type) → styled() (reusable, typed)
├── All instances of a component type → theme.components (global override)
└── Need to customize inner elements → slots/slotProps
```

### Layout Component Selection

```
What kind of layout?
├── Single axis (row or column) → Stack
├── 12-column grid → Grid
├── Centered page content → Container
├── Flexible box with sx → Box
└── Need both axes + complex → Grid (nested)
```

### Component vs Custom Build

```
Does MUI have this component?
├── YES → Use it (Button, TextField, Dialog, etc.)
│   ├── Need minor style changes → sx prop
│   ├── Need structural changes → slots/slotProps
│   └── Need completely different behavior → Build custom
└── NO → Build custom
    ├── Simple interaction → Base HTML + sx
    └── Complex interaction → Consider Radix UI primitives
```

### Color Scheme Strategy

```
Do you need dark mode?
├── YES → Use colorSchemes in createTheme
│   ├── System preference only → cssVariables: true (default)
│   ├── Manual toggle → useColorScheme hook
│   └── Both → colorSchemeSelector: "data" + useColorScheme
└── NO → Single palette in createTheme
```

### MUI X Component Selection

```
What data display do you need?
├── Tabular data
│   ├── Simple (< 100 rows, no editing) → Table component
│   ├── Complex (sorting, filtering, pagination) → DataGrid
│   └── Large dataset (100K+ rows) → DataGridPro (virtualized)
├── Date/time input → DatePicker / DateTimePicker / TimePicker
├── Charts → MUI X Charts
└── Tree structure → TreeView
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React 19**: Full compatibility in MUI v7
- **Next.js App Router**: Via `@mui/material-nextjs` with `AppRouterCacheProvider`
- **Tailwind CSS v4**: Via CSS layers (`enableCssLayer`)
- **React Hook Form**: TextField with `Controller`, or `register` with `inputRef`
- **React Query / TanStack Query**: Fetch data, pass to DataGrid rows
- **Zod**: Validate forms, map errors to TextField `helperText`
- **Emotion**: Default styling engine (included with `@mui/material`)

**Replaces / Conflicts with:**

- **Radix UI + custom styles**: MUI is pre-styled, Radix is headless -- use one or the other
- **Chakra UI**: Similar scope and philosophy, pick one
- **Ant Design**: Competing component library
- **styled-components**: MUI uses Emotion by default; adding styled-components requires `@mui/styled-engine-sc`

**Package Ecosystem:**

| Package                | Purpose                                   | Version |
| ---------------------- | ----------------------------------------- | ------- |
| `@mui/material`        | Core components (Button, TextField, etc.) | v7.x    |
| `@mui/system`          | sx prop, styled(), ThemeProvider          | v7.x    |
| `@mui/icons-material`  | 2000+ Material Design icons               | v7.x    |
| `@mui/x-data-grid`     | DataGrid (free tier)                      | v8.x    |
| `@mui/x-data-grid-pro` | DataGrid Pro (sorting, filtering, etc.)   | v8.x    |
| `@mui/x-date-pickers`  | DatePicker, TimePicker                    | v8.x    |
| `@mui/x-charts`        | Bar, Line, Pie, Scatter charts            | v8.x    |
| `@mui/x-tree-view`     | TreeView component                        | v8.x    |
| `@mui/material-nextjs` | Next.js SSR integration                   | v7.x    |
| `@emotion/react`       | Required peer dependency                  | v11.x   |
| `@emotion/styled`      | Required peer dependency                  | v11.x   |

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `theme.palette.mode === 'dark'` for conditional styles (causes SSR flicker -- use `theme.applyStyles('dark', {...})`)
- Missing `ThemeProvider` wrapper (components render with MUI defaults instead of your design tokens)
- Using barrel imports from `@mui/material` or `@mui/icons-material` (6x slower dev builds)
- Inline object/function definitions in `slots` prop (causes component remount every render)

**Medium Priority Issues:**

- Using deprecated `components`/`componentsProps` instead of `slots`/`slotProps` (removed in future versions)
- Using `GridLegacy` instead of the new `Grid` component with `size` prop
- Hardcoding colors/spacing instead of using theme tokens (`#1976d2` vs `primary.main`)
- Using `style` prop instead of `sx` (bypasses theme, no responsive support)
- Deep importing beyond one level: `@mui/material/styles/createTheme` (broken in v7 ESM)

**Common Mistakes:**

- Forgetting `CssBaseline` (inconsistent cross-browser baseline styles)
- Not memoizing DataGrid `columns` array (causes unnecessary re-renders)
- Using `@mui/lab` for graduated components (Alert, Skeleton, etc. are now in `@mui/material`)
- Missing TypeScript augmentation for custom palette colors (no autocomplete, type errors at usage)
- Setting `zIndex` manually on MUI components (conflicts with MUI's z-index scale)

**Gotchas & Edge Cases:**

- MUI components are **client-only** -- they require `'use client'` in Next.js App Router pages, not just layout
- `sx` prop arrays merge styles left-to-right; later items override earlier ones (useful for conditional styles)
- `spacing` theme value is a **multiplier**, not pixels: `spacing(2)` = `2 * 8px` = `16px` by default
- `Grid` `size` prop in v7 replaces `xs`/`sm`/`md`/`lg`/`xl` individual props from Grid2
- `TextField` is a composed component (Input + InputLabel + FormHelperText) -- use `slotProps.input` to target the actual input element
- `Dialog` `TransitionProps` must not remount the Transition component -- keep it stable between renders
- `useMediaQuery` returns `false` during SSR -- design for mobile-first and handle the hydration mismatch
- `createTheme` is not tree-shakeable -- a large theme config doesn't increase bundle, but unused components still need tree shaking via path imports

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap the app in `ThemeProvider` with a `createTheme()` instance -- never use MUI components without a theme)**

**(You MUST use path imports (`@mui/material/Button`) in development for faster startup -- barrel imports (`@mui/material`) cause 6x slower dev builds)**

**(You MUST use `slots`/`slotProps` for component inner-element customization -- `componentsProps` is deprecated in v7)**

**(You MUST use `theme.applyStyles('dark', {...})` for dark mode conditional styles -- never use `theme.palette.mode === 'dark'` which causes flickering)**

**Failure to follow these rules will cause SSR flickering, degraded dev performance, and deprecated API usage.**

</critical_reminders>
