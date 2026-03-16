# Ant Design -- Next.js Integration Examples

> AntdRegistry, SSR setup, client components, and App Router patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Setup & Theme Configuration](setup.md)
- [Feedback Components](feedback.md)

---

## Complete Layout with Theme and Locale

```tsx
// app/layout.tsx
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";

const THEME: ThemeConfig = {
  cssVar: true,
  hashed: false,
  token: {
    colorPrimary: "#2563eb",
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Button: { algorithm: true },
  },
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

**Why good:** AntdRegistry extracts first-screen styles into HTML to prevent FOUC (flash of unstyled content). Wrapping order matters: AntdRegistry > ConfigProvider > App.

---

## Client Component for Interactive Features

```tsx
// components/interactive-section.tsx
"use client";

import { Button, Space, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";

function InteractiveSection() {
  const { message } = App.useApp();

  const handleCreate = () => {
    message.success("Item created!");
  };

  return (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
        Create
      </Button>
    </Space>
  );
}
export { InteractiveSection };
```

---

## Sub-Component Workaround (App Router)

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

**Why this matters:** Next.js App Router server components cannot resolve dot-notation sub-components. Use destructuring or the data-driven API.
