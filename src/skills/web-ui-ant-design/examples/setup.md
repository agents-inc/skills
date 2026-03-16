# Ant Design -- Setup & Theme Configuration Examples

> Theme configuration, design tokens, dark mode, and ConfigProvider setup. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Forms & Validation](form.md)
- [Tables & Data Display](table.md)
- [Feedback Components](feedback.md)
- [Next.js Integration](nextjs.md)

---

## Complete Enterprise Theme

```tsx
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import { theme } from "antd";
import enUS from "antd/locale/en_US";

const BRAND_PRIMARY = "#2563eb";
const BRAND_SUCCESS = "#16a34a";
const BRAND_WARNING = "#ea580c";
const BRAND_ERROR = "#dc2626";
const BRAND_BORDER_RADIUS = 8;
const BRAND_FONT_SIZE = 14;
const BRAND_FONT_FAMILY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const ENTERPRISE_THEME: ThemeConfig = {
  cssVar: true,
  hashed: false, // Safe when only one antd version in the app
  token: {
    colorPrimary: BRAND_PRIMARY,
    colorSuccess: BRAND_SUCCESS,
    colorWarning: BRAND_WARNING,
    colorError: BRAND_ERROR,
    borderRadius: BRAND_BORDER_RADIUS,
    fontSize: BRAND_FONT_SIZE,
    fontFamily: BRAND_FONT_FAMILY,
    colorBgLayout: "#f5f5f5",
  },
  components: {
    Button: {
      controlHeight: 36,
      algorithm: true,
    },
    Table: {
      headerBg: "#fafafa",
      headerColor: "#1f2937",
      rowHoverBg: "#eff6ff",
      headerSortActiveBg: "#e5e7eb",
    },
    Card: {
      headerFontSize: 16,
    },
    Menu: {
      itemHeight: 44,
      subMenuItemBg: "transparent",
    },
    Form: {
      labelFontSize: 14,
      verticalLabelPadding: "0 0 4px",
    },
    Input: {
      controlHeight: 36,
    },
    Select: {
      controlHeight: 36,
    },
  },
};

function EnterpriseApp() {
  return (
    <ConfigProvider theme={ENTERPRISE_THEME} locale={enUS}>
      <AntApp>
        <AppRoutes />
      </AntApp>
    </ConfigProvider>
  );
}
export { EnterpriseApp, ENTERPRISE_THEME };
```

---

## Dark Mode Toggle with Persistence

```tsx
import { useState, useEffect, useCallback } from "react";
import { ConfigProvider, App as AntApp, Switch, theme as antTheme } from "antd";
import type { ThemeConfig } from "antd";
import { SunOutlined, MoonOutlined } from "@ant-design/icons";

const STORAGE_KEY = "app-theme-mode";
const BRAND_PRIMARY = "#2563eb";

function useThemeMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "dark";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    // Optionally set data attribute for non-antd elements
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), []);

  return { isDark, toggle } as const;
}

function DarkModeApp() {
  const { isDark, toggle } = useThemeMode();

  const themeConfig: ThemeConfig = {
    cssVar: true,
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND_PRIMARY,
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <AntApp>
        <div style={{ padding: 24 }}>
          <Switch
            checked={isDark}
            onChange={toggle}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
          <MainContent />
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
export { DarkModeApp, useThemeMode };
```

---

## Combining Algorithms (Dark + Compact)

```tsx
import { ConfigProvider, theme } from "antd";

// Dark + Compact combined
const DARK_COMPACT_THEME = {
  cssVar: true,
  algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
  token: {
    colorPrimary: "#1677ff",
  },
};

function DarkCompactApp() {
  return (
    <ConfigProvider theme={DARK_COMPACT_THEME}>
      <MainContent />
    </ConfigProvider>
  );
}
export { DarkCompactApp };
```

**When to use:** Data-dense dashboards benefit from compact + dark. Algorithms can be combined in any order.

---

## Nested Themes

```tsx
import { ConfigProvider, Card, Button } from "antd";

function NestedThemeExample() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <Card title="Default Theme">
        <Button type="primary">Blue Button</Button>

        {/* Nested theme overrides only colorPrimary, inherits everything else */}
        <ConfigProvider theme={{ token: { colorPrimary: "#eb2f96" } }}>
          <Card title="Pink Theme Section">
            <Button type="primary">Pink Button</Button>
          </Card>
        </ConfigProvider>
      </Card>
    </ConfigProvider>
  );
}
export { NestedThemeExample };
```

**When to use:** Multi-brand sections within a single page, embedded widgets needing distinct themes, component library previews.

---

## Using useToken for Custom Components

```tsx
import { theme, Card } from "antd";

const { useToken } = theme;

function StatusCard({
  status,
  title,
  description,
}: {
  status: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
}) {
  const { token } = useToken();

  const STATUS_COLORS = {
    success: {
      bg: token.colorSuccessBg,
      border: token.colorSuccess,
      text: token.colorSuccessText,
    },
    error: {
      bg: token.colorErrorBg,
      border: token.colorError,
      text: token.colorErrorText,
    },
    warning: {
      bg: token.colorWarningBg,
      border: token.colorWarning,
      text: token.colorWarningText,
    },
    info: {
      bg: token.colorInfoBg,
      border: token.colorInfo,
      text: token.colorInfoText,
    },
  } as const;

  const colors = STATUS_COLORS[status];

  return (
    <Card
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: token.lineWidth,
        borderStyle: token.lineType,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <h3 style={{ color: colors.text, margin: 0, fontSize: token.fontSizeLG }}>
        {title}
      </h3>
      <p
        style={{
          color: token.colorTextSecondary,
          margin: `${token.marginXS}px 0 0`,
        }}
      >
        {description}
      </p>
    </Card>
  );
}
export { StatusCard };
```

**Why good:** useToken reads current ConfigProvider context, ensuring custom elements match the active theme including dark mode.
