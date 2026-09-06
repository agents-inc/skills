# Ant Design -- SSR Style Extraction Examples

> `AntdRegistry`, client components, and the server-component constraints. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Core Setup & Theming](core.md)
- [Feedback Components](feedback.md)

---

## Root Layout with Registry, Theme and Locale

`AntdRegistry` from `@ant-design/nextjs-registry` collects the styles antd's CSS-in-JS engine generates during the server render and inlines them into the HTML, so the first paint is already styled. It wraps `ConfigProvider`, which wraps `App`.

```tsx
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";

const THEME: ThemeConfig = {
  cssVar: true,
  hashed: false,
  token: { colorPrimary: "#2563eb", borderRadius: 8, fontSize: 14 },
  components: { Button: { algorithm: true } },
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

**Why good:** the registry sits outermost, so it sees every style the tree below it generates. Nested inside `ConfigProvider` it would miss the provider's own output and the page flashes unstyled.

---

## Interactive Components Opt Into the Client

Anything using hooks — including `App.useApp()` — runs on the client. Mark those modules and keep the rest of the tree on the server.

```tsx
"use client";

import { Button, Space, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";

function InteractiveSection() {
  const { message } = App.useApp();

  return (
    <Space>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => message.success("Item created!")}
      >
        Create
      </Button>
    </Space>
  );
}
export { InteractiveSection };
```

---

## Sub-Components in a Server Component Tree

Dot-notation sub-components do not survive the server-component boundary — the module reaching the server renderer exposes the top-level export only.

```tsx
// BAD in a server component:
// <Select.Option value="a">A</Select.Option>
// <Typography.Text>Hello</Typography.Text>

// GOOD: destructure at module scope
import { Select, Typography } from "antd";
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

// Better still: use the data-driven API and skip sub-components entirely
<Select
  options={[
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
  ]}
/>;
```
