---
name: web-ui-ant-design
description: Ant Design enterprise UI library for React
---

# Ant Design Patterns

> **Quick Guide:** Ant Design is an enterprise-grade React UI library providing a complete set of high-quality components. Use ConfigProvider with design tokens for theming, the three-layer token system (Seed, Map, Alias) for customization, and the App component for context-aware feedback methods. **Current: v5.x (latest 5.29.x)** - CSS-in-JS engine with design tokens, CSS variables mode, tree-shaking support. Note: v6 has been released but v5 remains widely deployed.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap your app with ConfigProvider for theming and locale - never override component styles with global CSS)**

**(You MUST use the App component and useApp() hook for message/notification/modal - never use static methods directly as they cannot consume ConfigProvider context)**

**(You MUST use Form.useForm() with TypeScript generics for type-safe form handling - never use untyped form instances)**

**(You MUST use CSS variables mode (cssVar: true) for optimal theme-switching performance in production)**

</critical_requirements>

---

**Auto-detection:** Ant Design, antd, ConfigProvider, theme.defaultAlgorithm, theme.darkAlgorithm, theme.compactAlgorithm, useToken, Form.useForm, Form.List, Form.useWatch, ProTable, ProForm, ProLayout, @ant-design/icons, @ant-design/pro-components, AntdRegistry, Table columns, message.success, notification.open, Modal.confirm

**When to use:**

- Building enterprise admin panels, dashboards, and data-heavy applications
- Need a comprehensive component library with consistent design language out of the box
- Working with complex data tables, forms with validation, and multi-step workflows
- Requiring built-in internationalization, dark mode, and theme customization

**When NOT to use:**

- Building a custom design system from scratch (use Radix UI or headless primitives)
- Need minimal bundle size for a simple marketing site (Ant Design is large)
- Want full control over styling without design opinions (use unstyled primitives)
- Building non-React applications (Ant Design is React-specific)

**Key patterns covered:**

- ConfigProvider theming with design tokens (Seed, Map, Alias, Component tokens)
- Table with sorting, filtering, virtual scrolling, and custom rendering
- Form with validation, dynamic fields (Form.List), and TypeScript generics
- Layout system (Layout, Grid, Space, Flex)
- Feedback patterns (Modal, Message, Notification via App/useApp)
- Dark mode and theme switching with algorithms
- Next.js SSR with AntdRegistry
- Pro Components (ProTable, ProForm, ProLayout)
- Bundle optimization and icon tree-shaking
- Internationalization with ConfigProvider locale

**Detailed Resources:**

- For practical code examples, see [examples/ant-design.md](examples/ant-design.md)
- For quick reference and component checklists, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Ant Design follows the principles of **Natural**, **Certain**, **Meaningful**, and **Growing** to provide an enterprise-grade design system. It solves UI consistency across large teams by providing:

- **Complete component set**: 60+ components covering layout, data display, data entry, navigation, and feedback
- **Design token system**: Three-layer architecture (Seed > Map > Alias) enabling systematic customization without CSS overrides
- **Enterprise patterns**: Built-in pagination, filtering, form validation, internationalization, and accessibility

**v5 Architecture (CSS-in-JS):** Ant Design v5 replaced Less variables with a CSS-in-JS engine (`@ant-design/cssinjs`) and design tokens. Styles are generated at runtime and cached, with tree-shaking support eliminating the need for `babel-plugin-import`. CSS variables mode reduces runtime cost for theme switching.

**When to use Ant Design:**

- Enterprise admin interfaces with data tables, forms, and dashboards
- Internal tools where development speed matters more than unique design
- Projects needing i18n, RTL, and accessibility out of the box
- Teams wanting a comprehensive, well-documented component library

**When NOT to use:**

- Consumer-facing products needing distinctive brand design (too opinionated)
- Performance-critical SPAs where bundle size must be minimal
- Projects using a different styling paradigm (Tailwind-first, etc.)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Installation and Setup

#### Installation

```bash
# Core library
npm install antd

# Icons (import individually for tree-shaking)
npm install @ant-design/icons

# Pro components (optional - enterprise patterns)
npm install @ant-design/pro-components

# Next.js SSR support (optional)
npm install @ant-design/nextjs-registry
```

#### Basic App Setup

```tsx
// app.tsx
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";

const THEME_CONFIG: ThemeConfig = {
  cssVar: true,
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
    fontSize: 14,
  },
};

function App() {
  return (
    <ConfigProvider theme={THEME_CONFIG} locale={enUS}>
      <AntApp>
        <MainContent />
      </AntApp>
    </ConfigProvider>
  );
}
export { App };
```

**Why this structure:** ConfigProvider provides theme tokens and locale to all children, App component enables context-aware message/notification/modal APIs, cssVar mode optimizes theme switching performance

```tsx
// BAD: Using antd without ConfigProvider and App wrapper
import { Button, message } from "antd";

function BadExample() {
  const handleClick = () => {
    message.success("Saved!"); // Static method - cannot read ConfigProvider context
  };
  return <Button onClick={handleClick}>Save</Button>;
}
```

**Why bad:** Static message/notification/modal methods bypass ConfigProvider context (theming, locale, prefix), leading to inconsistent appearance and broken i18n

---

### Pattern 2: Design Tokens and Theming

Ant Design v5 uses a three-layer token system:

- **Seed Tokens**: Foundational values (`colorPrimary`, `fontSize`, `borderRadius`) that derive all other tokens
- **Map Tokens**: Derived from seed tokens via algorithms (`colorPrimaryBg`, `colorPrimaryHover`, `colorPrimaryActive`)
- **Alias Tokens**: Semantic tokens mapping to specific use cases (`colorBgContainer`, `colorTextHeading`)
- **Component Tokens**: Per-component overrides (`Button.primaryShadow`, `Table.headerBg`)

#### Global Theme Configuration

```tsx
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";

const BRAND_PRIMARY = "#00b96b";
const BRAND_BORDER_RADIUS = 8;
const BRAND_FONT_SIZE = 14;

const CUSTOM_THEME: ThemeConfig = {
  cssVar: true,
  token: {
    // Seed tokens - these derive Map and Alias tokens automatically
    colorPrimary: BRAND_PRIMARY,
    borderRadius: BRAND_BORDER_RADIUS,
    fontSize: BRAND_FONT_SIZE,
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorInfo: "#1677ff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    // Component-level token overrides
    Button: {
      colorPrimary: BRAND_PRIMARY,
      algorithm: true, // Use algorithm to derive other button colors from colorPrimary
    },
    Table: {
      headerBg: "#fafafa",
      rowHoverBg: "#f0f7ff",
    },
    Input: {
      activeBorderColor: BRAND_PRIMARY,
    },
  },
};

function ThemedApp() {
  return (
    <ConfigProvider theme={CUSTOM_THEME}>
      <MainContent />
    </ConfigProvider>
  );
}
export { ThemedApp };
```

**Why good:** Seed tokens propagate through the algorithm to derive consistent Map/Alias tokens, component tokens enable surgical overrides without CSS hacks, cssVar mode eliminates runtime hash recalculation

#### Accessing Tokens Programmatically

```tsx
import { theme } from "antd";

const { useToken } = theme;

function TokenConsumer() {
  const { token } = useToken();

  return (
    <div
      style={{
        backgroundColor: token.colorBgContainer,
        padding: token.paddingLG,
        borderRadius: token.borderRadiusLG,
        color: token.colorText,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      Styled with design tokens
    </div>
  );
}
export { TokenConsumer };
```

**Why good:** useToken reads current ConfigProvider context, ensuring custom elements match the active theme including dark mode

#### Nested Themes

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

**When to use:** Multi-brand sections within a single page, embedded widgets needing distinct themes, component library previews

---

### Pattern 3: Dark Mode and Theme Switching

```tsx
import { useState } from "react";
import { ConfigProvider, Switch, theme as antTheme } from "antd";
import type { ThemeConfig } from "antd";

const BRAND_COLOR = "#1677ff";

function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(false);

  const themeConfig: ThemeConfig = {
    cssVar: true,
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND_COLOR,
    },
  };

  return (
    <ConfigProvider theme={themeConfig}>
      <Switch
        checked={isDark}
        onChange={setIsDark}
        checkedChildren="Dark"
        unCheckedChildren="Light"
      />
      <MainContent />
    </ConfigProvider>
  );
}
export { ThemeSwitcher };
```

**Why good:** Algorithm handles all color derivations for dark mode automatically, cssVar mode makes switching near-instant by updating CSS variables instead of recalculating styles

#### Combining Algorithms

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

**When to use:** Data-dense dashboards benefit from compact + dark, algorithms can be combined in any order

---

### Pattern 4: Layout System

#### Application Layout

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

#### Grid System (24-column)

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

#### Flex Component (v5.10+)

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

**When to use:** Use Layout for page-level structure, Grid (Row/Col) for responsive content areas, Flex for inline element alignment, Space for uniform gaps between small elements

---

### Pattern 5: Table (Advanced)

#### Typed Table with Sorting, Filtering, and Custom Rendering

```tsx
import { Table, Tag, Space, Button } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "inactive";
  lastLogin: string;
}

const ROLE_COLORS: Record<UserRecord["role"], string> = {
  admin: "red",
  editor: "blue",
  viewer: "green",
};

const STATUS_FILTERS = [
  { text: "Active", value: "active" },
  { text: "Inactive", value: "inactive" },
] as const;

const PAGE_SIZE = 20;

const columns: ColumnsType<UserRecord> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    sorter: (a, b) => a.name.localeCompare(b.name),
    ellipsis: true,
  },
  {
    title: "Email",
    dataIndex: "email",
    key: "email",
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    render: (role: UserRecord["role"]) => (
      <Tag color={ROLE_COLORS[role]}>{role.toUpperCase()}</Tag>
    ),
    filters: [
      { text: "Admin", value: "admin" },
      { text: "Editor", value: "editor" },
      { text: "Viewer", value: "viewer" },
    ],
    onFilter: (value, record) => record.role === value,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    filters: [...STATUS_FILTERS],
    onFilter: (value, record) => record.status === value,
    render: (status: UserRecord["status"]) => (
      <Tag color={status === "active" ? "green" : "default"}>{status}</Tag>
    ),
  },
  {
    title: "Actions",
    key: "actions",
    render: (_, record) => (
      <Space>
        <Button type="link" onClick={() => handleEdit(record)}>
          Edit
        </Button>
        <Button type="link" danger onClick={() => handleDelete(record.id)}>
          Delete
        </Button>
      </Space>
    ),
  },
];

function UserTable({
  data,
  loading,
}: {
  data: UserRecord[];
  loading: boolean;
}) {
  const handleChange: TableProps<UserRecord>["onChange"] = (
    pagination,
    filters,
    sorter,
  ) => {
    console.log("Table changed:", { pagination, filters, sorter });
  };

  return (
    <Table<UserRecord>
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={{
        pageSize: PAGE_SIZE,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} items`,
      }}
      onChange={handleChange}
    />
  );
}
export { UserTable };
export type { UserRecord };
```

**Why good:** Full TypeScript generics on Table and ColumnsType, named constants for page sizes and filter values, proper rowKey, typed onChange handler

#### Virtual Scrolling (Large Datasets)

```tsx
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

const VIRTUAL_SCROLL_HEIGHT = 500;

const columns: ColumnsType<DataRecord> = [
  { title: "ID", dataIndex: "id", width: 100 },
  { title: "Name", dataIndex: "name", width: 200 },
  { title: "Value", dataIndex: "value", width: 150 },
];

function VirtualTable({ data }: { data: DataRecord[] }) {
  return (
    <Table<DataRecord>
      columns={columns}
      dataSource={data}
      rowKey="id"
      virtual
      scroll={{ y: VIRTUAL_SCROLL_HEIGHT }}
      pagination={false}
    />
  );
}
export { VirtualTable };
```

**When to use:** Datasets with 10,000+ rows where pagination is not desired, requires fixed column widths

---

### Pattern 6: Form with Validation and Dynamic Fields

#### Typed Form with Validation

```tsx
import { Form, Input, Select, Button, InputNumber, App } from "antd";
import type { Rule } from "antd/es/form";

interface CreateUserFormValues {
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  age: number;
}

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_AGE = 18;
const MAX_AGE = 120;

const NAME_RULES: Rule[] = [
  { required: true, message: "Name is required" },
  {
    min: MIN_NAME_LENGTH,
    max: MAX_NAME_LENGTH,
    message: `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`,
  },
];

const EMAIL_RULES: Rule[] = [
  { required: true, message: "Email is required" },
  { type: "email", message: "Enter a valid email" },
];

function CreateUserForm({
  onSubmit,
}: {
  onSubmit: (values: CreateUserFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<CreateUserFormValues>();
  const { message } = App.useApp();

  const handleFinish = async (values: CreateUserFormValues) => {
    try {
      await onSubmit(values);
      message.success("User created successfully");
      form.resetFields();
    } catch {
      message.error("Failed to create user");
    }
  };

  return (
    <Form<CreateUserFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ role: "viewer" }}
    >
      <Form.Item name="name" label="Name" rules={NAME_RULES}>
        <Input placeholder="Enter name" />
      </Form.Item>

      <Form.Item name="email" label="Email" rules={EMAIL_RULES}>
        <Input placeholder="Enter email" />
      </Form.Item>

      <Form.Item name="role" label="Role" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "Admin", value: "admin" },
            { label: "Editor", value: "editor" },
            { label: "Viewer", value: "viewer" },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="age"
        label="Age"
        rules={[
          { required: true, message: "Age is required" },
          {
            type: "number",
            min: MIN_AGE,
            max: MAX_AGE,
            message: `Age must be ${MIN_AGE}-${MAX_AGE}`,
          },
        ]}
      >
        <InputNumber style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Create User
        </Button>
      </Form.Item>
    </Form>
  );
}
export { CreateUserForm };
export type { CreateUserFormValues };
```

**Why good:** TypeScript generic on Form.useForm and Form ensures field names are type-checked, useApp() hook for context-aware messages, named rule constants, initialValues on Form (not Form.Item)

#### Dynamic Fields with Form.List

```tsx
import { Form, Input, Button, Space } from "antd";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";

interface TeamFormValues {
  teamName: string;
  members: Array<{ name: string; email: string }>;
}

function TeamForm() {
  const [form] = Form.useForm<TeamFormValues>();

  return (
    <Form<TeamFormValues> form={form} layout="vertical" onFinish={console.log}>
      <Form.Item name="teamName" label="Team Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.List
        name="members"
        rules={[
          {
            validator: async (_, members: TeamFormValues["members"]) => {
              if (!members || members.length < 1) {
                return Promise.reject(new Error("At least 1 member required"));
              }
            },
          },
        ]}
      >
        {(fields, { add, remove }, { errors }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space
                key={key}
                style={{ display: "flex", marginBottom: 8 }}
                align="baseline"
              >
                <Form.Item
                  {...restField}
                  name={[name, "name"]}
                  rules={[{ required: true, message: "Member name required" }]}
                >
                  <Input placeholder="Member name" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, "email"]}
                  rules={[
                    {
                      required: true,
                      type: "email",
                      message: "Valid email required",
                    },
                  ]}
                >
                  <Input placeholder="Email" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} />
              </Space>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add()}
                icon={<PlusOutlined />}
                block
              >
                Add Member
              </Button>
            </Form.Item>
            <Form.ErrorList errors={errors} />
          </>
        )}
      </Form.List>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
}
export { TeamForm };
```

#### Form.useWatch for Reactive Fields

```tsx
import { Form, Input, Select, InputNumber } from "antd";

function PricingForm() {
  const [form] = Form.useForm();
  const planType = Form.useWatch("planType", form);

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="planType" label="Plan">
        <Select
          options={[
            { label: "Free", value: "free" },
            { label: "Pro", value: "pro" },
            { label: "Enterprise", value: "enterprise" },
          ]}
        />
      </Form.Item>

      {/* Conditionally show fields based on watched value */}
      {planType !== "free" && (
        <Form.Item
          name="seats"
          label="Number of Seats"
          rules={[{ required: true }]}
        >
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>
      )}
    </Form>
  );
}
export { PricingForm };
```

**When to use:** Form.useWatch is ideal for conditional rendering based on field values, avoids unnecessary re-renders compared to onValuesChange

---

### Pattern 7: Feedback Components (Modal, Message, Notification)

#### Using App Component and useApp Hook

```tsx
import { App, Button, Space } from "antd";

// Wrap your application root with <App> component
function FeedbackDemo() {
  const { message, notification, modal } = App.useApp();

  const showMessage = () => {
    message.success("Operation completed successfully");
  };

  const showNotification = () => {
    notification.open({
      message: "New Update Available",
      description: "Version 2.0 is ready to install.",
      placement: "topRight",
    });
  };

  const showConfirm = () => {
    modal.confirm({
      title: "Delete this item?",
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        await deleteItem();
        message.success("Item deleted");
      },
    });
  };

  return (
    <Space>
      <Button onClick={showMessage}>Show Message</Button>
      <Button onClick={showNotification}>Show Notification</Button>
      <Button danger onClick={showConfirm}>
        Delete Item
      </Button>
    </Space>
  );
}
export { FeedbackDemo };
```

**Why good:** useApp() reads ConfigProvider context (theme, locale, prefixCls), all feedback renders consistently with the current theme

```tsx
// BAD: Using static methods
import { message, Modal } from "antd";

function BadFeedback() {
  message.success("Saved!"); // Ignores ConfigProvider theme/locale
  Modal.confirm({ title: "Sure?" }); // Ignores ConfigProvider context
}
```

**Why bad:** Static methods create their own React root outside ConfigProvider, resulting in wrong theme colors, missing locale translations, and broken CSS variable references

#### Declarative Modal

```tsx
import { useState } from "react";
import { Modal, Button, Form, Input } from "antd";

function EditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();

  const handleOk = async () => {
    const values = await form.validateFields();
    await saveData(values);
    onClose();
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
export { EditModal };
```

**When to use:** Declarative Modal (open prop) for form modals and complex content, modal.confirm() via useApp for simple confirmation dialogs

---

### Pattern 8: Data Display Components

#### Descriptions (Detail View)

```tsx
import { Descriptions, Badge } from "antd";
import type { DescriptionsProps } from "antd";

const USER_DETAILS: DescriptionsProps["items"] = [
  { key: "name", label: "Name", children: "John Doe" },
  { key: "email", label: "Email", children: "john@example.com" },
  { key: "phone", label: "Phone", children: "+1 234 567 890" },
  { key: "role", label: "Role", children: "Administrator" },
  {
    key: "status",
    label: "Status",
    children: <Badge status="success" text="Active" />,
  },
];

function UserDetail() {
  return (
    <Descriptions
      title="User Information"
      bordered
      column={{ xs: 1, sm: 2, md: 3 }}
      items={USER_DETAILS}
    />
  );
}
export { UserDetail };
```

#### Card Grid

```tsx
import { Card, Row, Col, Statistic } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

const PRECISION = 2;

function DashboardCards() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Revenue"
            value={112893}
            precision={PRECISION}
            prefix="$"
            valueStyle={{ color: "#3f8600" }}
            suffix={<ArrowUpOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Active Users"
            value={9280}
            valueStyle={{ color: "#cf1322" }}
            suffix={<ArrowDownOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
}
export { DashboardCards };
```

---

### Pattern 9: Navigation Components

#### Menu with Items API

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

**Why good:** Uses items API (v4.20+) instead of JSX children pattern, proper TypeScript MenuItem type, named constants

#### Breadcrumb

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

### Pattern 10: Icons

```tsx
// GOOD: Import individual icons for tree-shaking
import { UserOutlined, SearchOutlined, PlusOutlined } from "@ant-design/icons";

// GOOD: Alternative explicit path import (best tree-shaking)
import UserOutlined from "@ant-design/icons/UserOutlined";

// BAD: Never import the entire icon set
import * as Icons from "@ant-design/icons"; // Adds 500KB+ to bundle
```

**Why good:** Individual imports enable tree-shaking, path imports are even more explicit for bundlers

#### Custom Icons from SVG

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

---

### Pattern 11: Next.js App Router Integration

```tsx
// app/layout.tsx
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";

const THEME: ThemeConfig = {
  cssVar: true,
  token: { colorPrimary: "#1677ff" },
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={THEME} locale={enUS}>
            <AntApp>{children}</AntApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
export { RootLayout };
```

**Why good:** AntdRegistry extracts first-screen styles into HTML to prevent FOUC (flash of unstyled content), wrapping order matters: AntdRegistry > ConfigProvider > App

#### Sub-Component Workaround

```tsx
// Next.js App Router does NOT support dot notation for sub-components
// BAD in App Router:
// <Select.Option value="a">A</Select.Option>
// <Typography.Text>Hello</Typography.Text>

// GOOD: Import sub-components directly
import { Select, Typography } from "antd";
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

// Or use the items/options API instead of JSX children
<Select
  options={[
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
  ]}
/>;
```

**Why this matters:** Next.js App Router server components cannot resolve dot-notation sub-components, use destructuring or the data-driven API

---

### Pattern 12: Internationalization

```tsx
import { useState } from "react";
import { ConfigProvider, Select, DatePicker } from "antd";
import type { Locale } from "antd/es/locale";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import jaJP from "antd/locale/ja_JP";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "dayjs/locale/ja";

const LOCALE_MAP: Record<string, { antd: Locale; dayjs: string }> = {
  en: { antd: enUS, dayjs: "en" },
  zh: { antd: zhCN, dayjs: "zh-cn" },
  ja: { antd: jaJP, dayjs: "ja" },
};

function I18nApp() {
  const [lang, setLang] = useState("en");

  const currentLocale = LOCALE_MAP[lang] ?? LOCALE_MAP.en;
  dayjs.locale(currentLocale.dayjs);

  return (
    <ConfigProvider locale={currentLocale.antd}>
      <Select value={lang} onChange={setLang} style={{ width: 120 }}>
        <Select.Option value="en">English</Select.Option>
        <Select.Option value="zh">Chinese</Select.Option>
        <Select.Option value="ja">Japanese</Select.Option>
      </Select>
      <DatePicker />
    </ConfigProvider>
  );
}
export { I18nApp };
```

**Why good:** ConfigProvider locale handles all antd component text, dayjs locale must be set separately for date/time formatting, both are kept in sync

---

### Pattern 13: Pro Components

Pro Components (`@ant-design/pro-components`) provide page-level abstractions for common enterprise patterns.

#### ProTable (Advanced Data Table)

```tsx
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns, ActionType } from "@ant-design/pro-components";
import { useRef } from "react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
}

const columns: ProColumns<UserItem>[] = [
  { title: "Name", dataIndex: "name", copyable: true, ellipsis: true },
  { title: "Email", dataIndex: "email", copyable: true },
  {
    title: "Status",
    dataIndex: "status",
    valueEnum: {
      active: { text: "Active", status: "Success" },
      inactive: { text: "Inactive", status: "Default" },
    },
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    valueType: "dateTime",
    sorter: true,
    hideInSearch: true,
  },
  {
    title: "Actions",
    valueType: "option",
    render: (_, record, __, action) => [
      <a key="edit" onClick={() => handleEdit(record)}>
        Edit
      </a>,
      <a key="delete" onClick={() => handleDelete(record.id)}>
        Delete
      </a>,
    ],
  },
];

function UserManagement() {
  const actionRef = useRef<ActionType>();

  return (
    <ProTable<UserItem>
      columns={columns}
      actionRef={actionRef}
      request={async (params, sort, filter) => {
        const response = await fetchUsers({ ...params, sort, filter });
        return {
          data: response.items,
          success: true,
          total: response.total,
        };
      }}
      rowKey="id"
      search={{ labelWidth: "auto" }}
      pagination={{ pageSize: 20 }}
      headerTitle="User Management"
      toolBarRender={() => [
        <Button key="add" type="primary" icon={<PlusOutlined />}>
          Add User
        </Button>,
      ]}
    />
  );
}
export { UserManagement };
```

**Why good:** ProTable auto-generates search form from columns, handles pagination/sorting/filtering via request API, valueEnum provides filter options and display mapping, actionRef enables external table control (reload, reset)

#### ProForm (Step Form)

```tsx
import {
  ProForm,
  ProFormText,
  ProFormSelect,
  StepsForm,
} from "@ant-design/pro-components";

function CreateProjectWizard() {
  return (
    <StepsForm
      onFinish={async (values) => {
        await createProject(values);
        return true;
      }}
    >
      <StepsForm.StepForm name="basic" title="Basic Info">
        <ProFormText
          name="name"
          label="Project Name"
          rules={[{ required: true }]}
        />
        <ProFormText name="description" label="Description" />
      </StepsForm.StepForm>

      <StepsForm.StepForm name="config" title="Configuration">
        <ProFormSelect
          name="type"
          label="Project Type"
          options={[
            { label: "Web App", value: "web" },
            { label: "API", value: "api" },
            { label: "Library", value: "lib" },
          ]}
          rules={[{ required: true }]}
        />
      </StepsForm.StepForm>

      <StepsForm.StepForm name="review" title="Review">
        <ProForm.Group>{/* Summary fields */}</ProForm.Group>
      </StepsForm.StepForm>
    </StepsForm>
  );
}
export { CreateProjectWizard };
```

**When to use:** ProTable for CRUD pages with search/filter, ProForm for step-by-step wizards and modal/drawer forms, ProLayout for admin shell with route-based menu generation

</patterns>

---

<performance>

## Performance Optimization

### CSS Variables Mode

```tsx
// Enable CSS variables for efficient theme switching
const THEME: ThemeConfig = {
  cssVar: true, // Converts tokens to CSS custom properties
  hashed: false, // Disable hash when only one antd version in the app
  token: { colorPrimary: "#1677ff" },
};
```

**Why:** CSS variables mode eliminates runtime style recalculation when switching themes. Combined with `hashed: false` (safe when only one antd version exists), this reduces total style output size.

### Tree-Shaking

```tsx
// v5 supports tree-shaking natively - no babel-plugin-import needed
// Just import what you use
import { Button, Table, Form } from "antd";

// Icons: ALWAYS import individually
import { UserOutlined } from "@ant-design/icons";
// Or use path imports for stricter tree-shaking
import UserOutlined from "@ant-design/icons/UserOutlined";
```

### Dynamic Imports for Heavy Components

```tsx
import { lazy, Suspense } from "react";
import { Spin } from "antd";

// Lazy-load heavy components (editors, charts, complex forms)
const RichEditor = lazy(() => import("./rich-editor"));

function EditorPage() {
  return (
    <Suspense fallback={<Spin size="large" />}>
      <RichEditor />
    </Suspense>
  );
}
export { EditorPage };
```

### Virtual Scrolling for Large Lists

```tsx
// Table: use virtual prop for 10,000+ rows
<Table virtual scroll={{ y: 500 }} />

// Select: use virtual prop for large option lists
<Select virtual options={largeOptionsList} />

// Tree/TreeSelect: use virtual prop
<Tree virtual treeData={largeTreeData} />
```

### Date Library Optimization

```bash
# Use dayjs (default in v5) instead of moment.js
# dayjs is 2KB vs moment's 300KB+
# If you see moment in your bundle, check for legacy dependencies
```

</performance>

---

<decision_framework>

## Decision Framework

### Choosing Feedback Components

```
Need to show user feedback?
├─ Brief status update (success/error/loading) → message via useApp()
├─ Detailed notification with title + description → notification via useApp()
├─ Requires user decision → modal.confirm() via useApp()
├─ Complex form or content → Modal component (declarative, with open prop)
└─ Side panel with content → Drawer component
```

### Table vs ProTable

```
Building a data table?
├─ Simple display with basic sort/filter → Table
├─ Need auto-generated search form → ProTable
├─ Need server-side pagination + filtering → ProTable (request API)
├─ Custom complex UI around table → Table (more control)
└─ CRUD page with toolbar actions → ProTable (toolBarRender)
```

### Form vs ProForm

```
Building a form?
├─ Simple single-page form → Form
├─ Multi-step wizard → StepsForm (from ProForm)
├─ Form in modal → ModalForm (from ProForm)
├─ Form in drawer → DrawerForm (from ProForm)
├─ Search/filter form → QueryFilter or LightFilter (from ProForm)
└─ Need full layout control → Form (more flexible)
```

### Layout Approach

```
How to lay out content?
├─ Page-level shell (sidebar + header + content) → Layout
├─ Responsive grid of cards/panels → Row + Col (24-column grid)
├─ Flex alignment of inline elements → Flex (v5.10+)
├─ Uniform spacing between small elements → Space
├─ Enterprise admin with route-based menu → ProLayout
└─ Responsive breakpoints needed → Row + Col with xs/sm/md/lg/xl props
```

### Theming Approach

```
How to customize appearance?
├─ Brand colors only → Seed tokens (colorPrimary, etc.)
├─ Specific component tweaks → Component tokens (Button.colorPrimary)
├─ Dark mode → algorithm: theme.darkAlgorithm
├─ Compact spacing → algorithm: theme.compactAlgorithm
├─ Section-specific theme → Nested ConfigProvider
├─ Access tokens in custom components → useToken() hook
└─ Dynamic theme switching → cssVar: true + state-driven algorithm
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React Router / Next.js**: Layout, Menu, Breadcrumb integrate with routing
- **React Query / SWR**: Use with Table/ProTable for server state management
- **dayjs**: Default date library in v5 (replaces moment.js)
- **@ant-design/pro-components**: Enterprise patterns (ProTable, ProForm, ProLayout)
- **@ant-design/nextjs-registry**: SSR style extraction for Next.js

**Conflicts with / Considerations:**

- **Tailwind CSS**: Can coexist but requires careful CSS specificity management; avoid styling antd components with Tailwind utility classes directly
- **Other UI libraries** (MUI, Chakra): Should not mix component libraries in the same project
- **CSS Modules / global CSS**: Avoid overriding antd styles with global CSS; use design tokens and component tokens instead
- **moment.js**: v5 uses dayjs by default; remove moment.js dependency if migrating from v4

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using static `message.success()`, `notification.open()`, `Modal.confirm()` without App wrapper - they bypass ConfigProvider context, leading to wrong theme and broken locale
- Overriding antd styles with global CSS (`.ant-btn { ... }`) - breaks on theme changes and version upgrades, use component tokens instead
- Importing entire icon set (`import * as Icons from "@ant-design/icons"`) - adds 500KB+ to bundle
- Using `value`/`defaultValue` on form controls inside `Form.Item` with `name` - conflicts with Form's state management

**Medium Priority Issues:**

- Missing `rowKey` on Table - causes React key warnings and update bugs
- Using `Form.Item initialValue` instead of `Form initialValues` - inconsistent behavior with form reset
- Not wrapping app with `<App>` component when using feedback methods - feedback renders outside theme context
- Missing `destroyOnClose` on Modal with Form inside - stale form state persists across open/close

**Common Mistakes:**

- Forgetting to set dayjs locale alongside ConfigProvider locale (date components show wrong language)
- Using dot-notation sub-components in Next.js App Router server components (`<Select.Option>`)
- Not enabling `cssVar: true` for apps that switch themes (causes full style recalculation)
- Wrapping AntdRegistry inside ConfigProvider instead of outside in Next.js (breaks style extraction)

**Gotchas & Edge Cases:**

- `Form.useWatch` triggers component re-render - use sparingly in performance-sensitive forms
- Table `onChange` fires for pagination, filters, AND sorting - check the extra parameter to determine which changed
- `Modal.confirm()` returns a reference for updating/destroying - store it if you need to close programmatically
- ConfigProvider `theme.components` tokens with `algorithm: true` derive from the component's `colorPrimary`, not the global one
- Virtual Table requires explicit column `width` values - without them, columns collapse
- ProTable `request` must return `{ data, success, total }` - missing `success: true` causes infinite loading
- Nested ConfigProvider inherits unset tokens from parent - set tokens explicitly if you want isolation

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap your app with ConfigProvider for theming and locale - never override component styles with global CSS)**

**(You MUST use the App component and useApp() hook for message/notification/modal - never use static methods directly as they cannot consume ConfigProvider context)**

**(You MUST use Form.useForm() with TypeScript generics for type-safe form handling - never use untyped form instances)**

**(You MUST use CSS variables mode (cssVar: true) for optimal theme-switching performance in production)**

**Failure to follow these rules will cause theme inconsistencies, broken internationalization, and degraded performance.**

</critical_reminders>
