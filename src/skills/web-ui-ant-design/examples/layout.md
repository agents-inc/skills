# Ant Design -- Layout Examples

> Application layout, responsive grid, Flex, and Space patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Navigation Components](navigation.md)
- [Data Display Components](data-display.md)
- [Setup & Theme Configuration](setup.md)

---

## Application Layout (Sidebar + Header + Content)

```tsx
import { Layout, Menu, Breadcrumb } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";

const { Header, Content, Sider, Footer } = Layout;

const SIDER_WIDTH = 200;

const MENU_ITEMS: MenuProps["items"] = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "users", icon: <UserOutlined />, label: "Users" },
  { key: "settings", icon: <SettingOutlined />, label: "Settings" },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={SIDER_WIDTH} collapsible>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={["dashboard"]}
          items={MENU_ITEMS}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0 }} />
        <Content style={{ margin: "16px" }}>
          <Breadcrumb items={[{ title: "Home" }, { title: "Dashboard" }]} />
          <div style={{ padding: 24, minHeight: 360 }}>{children}</div>
        </Content>
        <Footer style={{ textAlign: "center" }}>My App</Footer>
      </Layout>
    </Layout>
  );
}
export { AppLayout };
```

---

## Grid System (24-Column)

```tsx
import { Row, Col } from "antd";

const GUTTER_RESPONSIVE = { xs: 8, sm: 16, md: 24, lg: 32 } as const;

function ResponsiveGrid() {
  return (
    <Row gutter={[GUTTER_RESPONSIVE, 16]}>
      {/* Full width on mobile, 1/3 on medium+ */}
      <Col xs={24} md={8}>
        <Card title="Panel 1" />
      </Col>
      <Col xs={24} md={8}>
        <Card title="Panel 2" />
      </Col>
      <Col xs={24} md={8}>
        <Card title="Panel 3" />
      </Col>
    </Row>
  );
}
export { ResponsiveGrid };
```

---

## Flex Component (v5.10+)

```tsx
import { Flex, Button } from "antd";

const FLEX_GAP = 8;

function FlexExample() {
  return (
    <Flex gap={FLEX_GAP} justify="space-between" align="center" wrap>
      <Button type="primary">Save</Button>
      <Button>Cancel</Button>
      <Button type="link">Reset</Button>
    </Flex>
  );
}
export { FlexExample };
```

**When to use:** Use Layout for page-level structure, Grid (Row/Col) for responsive content areas, Flex for inline element alignment, Space for uniform gaps between small elements.
