# MUI -- Setup & Theming Examples

> Theme configuration, CSS variables, dark mode, TypeScript augmentation, server and client setup.
> See [SKILL.md](../SKILL.md) for which layer to customise at.

**Related examples:** [styling.md](styling.md), [form-inputs.md](form-inputs.md), [layout.md](layout.md)

---

## Production-Ready Theme with Color Schemes

```typescript
// theme.ts
import { createTheme } from "@mui/material/styles";

const BORDER_RADIUS = 8;
const SPACING_UNIT = 8;

const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "data",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#2563eb",
          light: "#60a5fa",
          dark: "#1d4ed8",
          contrastText: "#fff",
        },
        secondary: {
          main: "#7c3aed",
          light: "#a78bfa",
          dark: "#5b21b6",
          contrastText: "#fff",
        },
        background: {
          default: "#f8fafc",
          paper: "#ffffff",
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#60a5fa",
          light: "#93c5fd",
          dark: "#2563eb",
          contrastText: "#000",
        },
        secondary: {
          main: "#a78bfa",
          light: "#c4b5fd",
          dark: "#7c3aed",
          contrastText: "#000",
        },
        background: {
          default: "#0f172a",
          paper: "#1e293b",
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4 },
    h4: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: BORDER_RADIUS,
  },
  spacing: SPACING_UNIT,
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: BORDER_RADIUS * 1.5,
          padding: "8px 20px",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: BORDER_RADIUS * 2,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export { theme };
```

---

## TypeScript Theme Augmentation

```typescript
// theme-augmentation.d.ts
import type {} from "@mui/material/styles";

// Custom palette colors
declare module "@mui/material/styles" {
  interface Palette {
    neutral: Palette["primary"];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions["primary"];
  }
}

// Allow custom colors on components
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    neutral: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    neutral: true;
  }
}

declare module "@mui/material/IconButton" {
  interface IconButtonPropsColorOverrides {
    neutral: true;
  }
}

// Custom typography variant
declare module "@mui/material/styles" {
  interface TypographyVariants {
    label: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    label?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    label: true;
  }
}
```

---

## Global Component Overrides in Theme

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

---

**Why good:** the two augmentations do different jobs — the first puts `neutral` on the theme, the
second lets each component accept it as a `color` value. Only the first and `color="neutral"` is a
type error at every call site.

---

## Dark Mode Toggle with Menu

```typescript
"use client";

import { useColorScheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";
import { useState } from "react";

type ColorMode = "light" | "dark" | "system";

const MODE_OPTIONS: { value: ColorMode; label: string; icon: JSX.Element }[] = [
  { value: "light", label: "Light", icon: <Brightness7Icon /> },
  { value: "dark", label: "Dark", icon: <Brightness4Icon /> },
  { value: "system", label: "System", icon: <SettingsBrightnessIcon /> },
];

function ColorModeMenu() {
  const { mode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // mode is undefined on first render -- guard before rendering mode-dependent UI
  if (!mode) return null;

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        color="inherit"
        aria-label="toggle color mode"
      >
        {mode === "dark" ? <Brightness4Icon /> : <Brightness7Icon />}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {MODE_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={mode === option.value}
            onClick={() => {
              setMode(option.value);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export { ColorModeMenu };
```

---

## Server-Rendered Setup, with CSS Layers

The cache provider goes above `ThemeProvider` so Emotion's generated styles are collected and
flushed with the streamed HTML. MUI publishes one adapter package per supported server framework —
import its cache provider and the rest of the arrangement is the same everywhere.

```typescript
// root layout
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { theme } from "./theme";

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          {/* fixes the order of MUI's layer against everything else on the page */}
          <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

// A framework that loads layouts by module default export needs one here.
export default RootLayout;
```

```typescript
"use client"; // MUI components need client context — this goes on the page, not only the layout

import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export function HomePage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h2" gutterBottom>
        Welcome
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained">Get Started</Button>
        <Button variant="outlined">Learn More</Button>
      </Stack>
    </Container>
  );
}
```

---

## Client-Side App (SPA) with CSS Layers

No cache provider is needed when nothing renders on a server; `StyledEngineProvider` takes the same
position and carries the same `enableCssLayer` switch.

```typescript
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import GlobalStyles from "@mui/material/GlobalStyles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";

function App({ children }: { children: React.ReactNode }) {
  return (
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export { App };
```
