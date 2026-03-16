# Ant Design -- Navigation & Icons Examples

> Menu, Breadcrumb, and icon tree-shaking patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Layout](layout.md)
- [Pro Components](pro-components.md)

---

## Menu with Items API

```tsx
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  HomeOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MailOutlined,
} from "@ant-design/icons";

type MenuItem = Required<MenuProps>["items"][number];

const MENU_ITEMS: MenuItem[] = [
  { key: "home", icon: <HomeOutlined />, label: "Home" },
  {
    key: "products",
    icon: <AppstoreOutlined />,
    label: "Products",
    children: [
      { key: "product-list", label: "Product List" },
      { key: "add-product", label: "Add Product" },
    ],
  },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: "Settings",
    children: [
      { key: "profile", label: "Profile" },
      { key: "security", label: "Security" },
    ],
  },
  { key: "contact", icon: <MailOutlined />, label: "Contact" },
];

function NavigationMenu({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <Menu
      mode="inline"
      defaultSelectedKeys={["home"]}
      defaultOpenKeys={["products"]}
      items={MENU_ITEMS}
      onClick={({ key }) => onSelect(key)}
    />
  );
}
export { NavigationMenu };
```

**Why good:** Uses items API (v4.20+) instead of JSX children pattern, proper TypeScript MenuItem type, named constants.

---

## Breadcrumb

```tsx
import { Breadcrumb } from "antd";
import { HomeOutlined } from "@ant-design/icons";

function PageBreadcrumb({ current }: { current: string }) {
  return (
    <Breadcrumb
      items={[
        { href: "/", title: <HomeOutlined /> },
        { href: "/users", title: "Users" },
        { title: current },
      ]}
    />
  );
}
export { PageBreadcrumb };
```

---

## Icon Imports (Tree-Shaking)

```tsx
// GOOD: Import individual icons for tree-shaking
import { UserOutlined, SearchOutlined, PlusOutlined } from "@ant-design/icons";

// GOOD: Alternative explicit path import (best tree-shaking)
import UserOutlined from "@ant-design/icons/UserOutlined";

// BAD: Never import the entire icon set
import * as Icons from "@ant-design/icons"; // Adds 500KB+ to bundle
```

---

## Custom Icons from SVG

```tsx
import Icon from "@ant-design/icons";
import type { CustomIconComponentProps } from "@ant-design/icons/lib/components/Icon";

const CustomSvg = () => (
  <svg viewBox="0 0 1024 1024" fill="currentColor" width="1em" height="1em">
    <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0z" />
  </svg>
);

const CustomIcon = (props: Partial<CustomIconComponentProps>) => (
  <Icon component={CustomSvg} {...props} />
);
export { CustomIcon };
```
