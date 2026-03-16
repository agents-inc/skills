# MUI -- Navigation Examples

> AppBar, Drawer, Tabs, Breadcrumbs, Menu patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [layout.md](layout.md) -- Grid, Container for page structure
- [setup.md](setup.md) -- Dark mode toggle in AppBar
- [feedback.md](feedback.md) -- Dialog, Snackbar for user actions

---

## Responsive Dashboard Layout: AppBar + Drawer

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

## Tabs with Panels

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
