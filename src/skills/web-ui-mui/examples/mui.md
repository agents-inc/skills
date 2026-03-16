# MUI Practical Examples

> Complete, runnable examples for common MUI patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

---

## Theme Setup: Production-Ready Configuration

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

## Form Layout: Contact Form

```typescript
import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

const SUBJECT_OPTIONS = [
  { value: "general", label: "General Inquiry" },
  { value: "support", label: "Technical Support" },
  { value: "billing", label: "Billing Question" },
  { value: "feedback", label: "Feedback" },
] as const;

const MAX_MESSAGE_LENGTH = 500;

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Process form data...
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Thank you for your message. We will get back to you shortly.
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Contact Us
      </Typography>

      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            required
            fullWidth
            name="firstName"
            label="First Name"
            autoComplete="given-name"
          />
          <TextField
            required
            fullWidth
            name="lastName"
            label="Last Name"
            autoComplete="family-name"
          />
        </Stack>

        <TextField
          required
          fullWidth
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <TextField
          required
          fullWidth
          name="subject"
          label="Subject"
          select
          defaultValue=""
        >
          {SUBJECT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          required
          fullWidth
          name="message"
          label="Message"
          multiline
          rows={4}
          slotProps={{
            htmlInput: { maxLength: MAX_MESSAGE_LENGTH },
          }}
          helperText={`Maximum ${MAX_MESSAGE_LENGTH} characters`}
        />

        <Button type="submit" variant="contained" size="large">
          Send Message
        </Button>
      </Stack>
    </Box>
  );
}

export { ContactForm };
```

---

## DataGrid: User Management Table

```typescript
import { useState, useCallback } from "react";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "inactive";
  createdAt: string;
}

const ROLE_COLORS = {
  admin: "error",
  editor: "primary",
  viewer: "default",
} as const;

const STATUS_COLORS = {
  active: "success",
  inactive: "default",
} as const;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// Define columns outside component for referential stability
const columns: GridColDef<User>[] = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
  { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
  {
    field: "role",
    headerName: "Role",
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        color={ROLE_COLORS[params.value as User["role"]]}
        size="small"
        variant="outlined"
      />
    ),
  },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        color={STATUS_COLORS[params.value as User["status"]]}
        size="small"
      />
    ),
  },
  {
    field: "createdAt",
    headerName: "Created",
    width: 120,
    valueFormatter: (value: string) =>
      new Date(value).toLocaleDateString(),
  },
  {
    field: "actions",
    headerName: "Actions",
    width: 100,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <Box>
        <IconButton size="small" aria-label={`edit ${params.row.name}`}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={`delete ${params.row.name}`}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    ),
  },
];

function UserTable({ users }: { users: User[] }) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const handlePaginationChange = useCallback(
    (model: GridPaginationModel) => {
      setPaginationModel(model);
    },
    [],
  );

  return (
    <Box sx={{ height: 500, width: "100%" }}>
      <DataGrid
        rows={users}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        checkboxSelection
        disableRowSelectionOnClick
        sx={{
          "& .MuiDataGrid-cell:focus": {
            outline: "none",
          },
          "& .MuiDataGrid-columnHeader": {
            backgroundColor: "action.hover",
          },
        }}
      />
    </Box>
  );
}

export { UserTable };
export type { User };
```

---

## Responsive Dashboard Layout

```typescript
import { useState } from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
  { label: "Users", icon: <PeopleIcon />, path: "/users" },
  { label: "Settings", icon: <SettingsIcon />, path: "/settings" },
] as const;

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const drawerContent = (
    <Box>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          MyApp
        </Typography>
      </Toolbar>
      <List>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
              aria-label="open navigation"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap>
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }} // Better mobile performance
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar /> {/* Spacer */}
        {children}
      </Box>
    </Box>
  );
}

export { DashboardLayout };
```

---

## Card Grid: Responsive Product Cards

```typescript
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

const GRID_COLUMNS = { xs: 12, sm: 6, md: 4, lg: 3 } as const;

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <Grid container spacing={3}>
      {products.map((product) => (
        <Grid key={product.id} size={GRID_COLUMNS}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: 8,
              },
            }}
          >
            <CardMedia
              component="img"
              height={200}
              image={product.image}
              alt={product.name}
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" component="h2">
                  {product.name}
                </Typography>
                <Chip label={product.category} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {product.description}
              </Typography>
              <Typography
                variant="h6"
                color="primary"
                sx={{ mt: 2, fontWeight: 700 }}
              >
                ${product.price.toFixed(2)}
              </Typography>
            </CardContent>
            <CardActions sx={{ p: 2, pt: 0 }}>
              <Button variant="contained" fullWidth>
                Add to Cart
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export { ProductGrid };
export type { Product };
```

---

## Dialog: Confirmation with Loading State

```typescript
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  destructive?: boolean;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={destructive ? "error" : "primary"}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
```

---

## Dark Mode Toggle: Complete Implementation

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

## Next.js App Router: Complete Setup

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "@/theme";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with MUI and Next.js",
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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

```typescript
// app/page.tsx
"use client"; // Required: MUI components need client context

import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

function HomePage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h2" gutterBottom>
        Welcome
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Built with Material UI and Next.js App Router.
      </Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained">Get Started</Button>
        <Button variant="outlined">Learn More</Button>
      </Stack>
    </Container>
  );
}

export default HomePage; // Next.js requires default export for pages
```

---

## Custom Styled Components: Reusable Patterns

```typescript
import { styled } from "@mui/material/styles";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";

const HOVER_ELEVATION = 8;
const HOVER_TRANSLATE_PX = -4;

// Feature card with hover effect
const FeatureCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  transition: theme.transitions.create(
    ["box-shadow", "transform", "border-color"],
    {
      duration: theme.transitions.duration.short,
    },
  ),
  "&:hover": {
    boxShadow: theme.shadows[HOVER_ELEVATION],
    transform: `translateY(${HOVER_TRANSLATE_PX}px)`,
    borderColor: theme.palette.primary.main,
  },
  ...theme.applyStyles("dark", {
    backgroundColor: theme.palette.grey[900],
    borderColor: theme.palette.grey[800],
  }),
}));

// Gradient button
const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
  color: theme.palette.common.white,
  boxShadow: `0 3px 5px 2px ${theme.palette.primary.main}33`,
  "&:hover": {
    background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.secondary.dark} 90%)`,
  },
}));

export { FeatureCard, GradientButton };
```

---

## Autocomplete: Multi-Select with Custom Rendering

```typescript
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
}

function TeamMemberPicker({
  members,
  selected,
  onChange,
}: {
  members: TeamMember[];
  selected: TeamMember[];
  onChange: (value: TeamMember[]) => void;
}) {
  return (
    <Autocomplete
      multiple
      options={members}
      value={selected}
      onChange={(_, newValue) => onChange(newValue)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Team Members"
          placeholder="Search..."
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            key={key}
            component="li"
            {...rest}
            sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Avatar src={option.avatarUrl} sx={{ width: 32, height: 32 }}>
              {option.name[0]}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.role}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={option.name}
              avatar={<Avatar src={option.avatarUrl}>{option.name[0]}</Avatar>}
              size="small"
              {...tagProps}
            />
          );
        })
      }
    />
  );
}

export { TeamMemberPicker };
export type { TeamMember };
```
