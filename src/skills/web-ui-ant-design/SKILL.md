---
name: web-ui-ant-design
description: Ant Design enterprise UI library for React
---

# Ant Design Patterns

> **Quick Guide:** Ant Design is an enterprise React component library. Theme through `ConfigProvider` and the three-layer token system (Seed > Map > Alias) rather than CSS overrides, and reach feedback APIs through `App.useApp()` so they inherit that context. **Current: v6.x** — pure CSS variables by default, `zeroRuntime` available, React 18+ required. v5.x is in maintenance and every pattern here applies to both unless noted.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — enterprise theme, dark-mode toggle, algorithm combining, nested themes, `useToken`
- [examples/form.md](examples/form.md) — dependencies, async validators, `Form.List`, `Form.useWatch`, modal form
- [examples/table.md](examples/table.md) — server-driven table, expandable rows, summary rows, virtual scrolling
- [examples/layout.md](examples/layout.md) — Layout shell, 24-column grid, Flex
- [examples/feedback.md](examples/feedback.md) — `useApp`, declarative Modal, Drawer
- [examples/data-display.md](examples/data-display.md) — Descriptions, Statistic cards
- [examples/navigation.md](examples/navigation.md) — Menu items API, Breadcrumb, icon tree-shaking, custom SVG icons
- [examples/pro-components.md](examples/pro-components.md) — ProLayout, ProTable CRUD, StepsForm
- [examples/ssr.md](examples/ssr.md) — `AntdRegistry` style extraction, client components, server-component constraints
- [examples/i18n.md](examples/i18n.md) — ConfigProvider locale kept in sync with dayjs
- [reference.md](reference.md) — ConfigProvider props, token tables, component matrix, v5→v6 migration notes

---

## Which path applies

- **Building screens from individual components** — `Table`, `Form`, `Layout` and the rest of `antd`. Start at [examples/core.md](examples/core.md) and reach for the topic file the screen needs.
- **Building a CRUD admin from page-level abstractions** — `ProTable`, `ProForm` and `ProLayout` generate the search form, the toolbar and the route-based menu for you. Follow [examples/pro-components.md](examples/pro-components.md); the token and feedback rules below still apply.
- **Rendering on a server** — styles need extracting into the HTML or the first paint flashes unstyled. Follow [examples/ssr.md](examples/ssr.md).

---

<critical_requirements>

## Before writing Ant Design code

**Wrap the app in `ConfigProvider`, and customise through tokens.** Theme and locale reach every component through that context, and token overrides survive version upgrades where a global `.ant-btn` rule does not.

**Wrap the tree in `App` and take `message`, `notification` and `modal` from `App.useApp()`.** The static methods mount their own React root outside `ConfigProvider`, so they render with the wrong theme and no translations.

**Give `Form.useForm<T>()` and `<Form<T>>` the values type.** Field names, `initialValues` and the `onFinish` payload are then checked against one interface instead of inferred as `any`.

**Turn on `cssVar: true` in any app that switches theme.** Theme changes become a CSS-variable swap rather than a full style regeneration; it is the default in v6.

</critical_requirements>

---

**Auto-detection:** antd, ConfigProvider, ThemeConfig, theme.defaultAlgorithm, theme.darkAlgorithm, theme.compactAlgorithm, useToken, cssVar, App.useApp, Form.useForm, Form.List, Form.useWatch, ColumnsType, dataIndex, rowKey, ProTable, ProForm, ProLayout, StepsForm, @ant-design/icons, @ant-design/pro-components, AntdRegistry, antd/locale

**Applies to:**

- Enterprise admin panels, dashboards and data-heavy screens built from a ready-made component set
- Complex data tables — server-driven sorting, filtering, pagination, selection, virtual scrolling
- Forms with validation, cross-field dependencies and dynamic field arrays
- Theming: brand tokens, per-component tokens, dark and compact modes, nested themes
- Built-in internationalisation, RTL and accessibility

**Handled elsewhere:**

- **Unstyled primitives for a design system you own end to end** — Ant Design ships its opinions with it and is the wrong starting point for one.
- **Routing** — `Menu`, `Breadcrumb` and `ProLayout` emit keys and hrefs; which navigation layer consumes them is not this skill's concern.
- **Server state and caching** — `Table` takes rows through `dataSource` and `ProTable` through a `request` callback; where the rows came from is settled elsewhere.
- **A project's own CSS methodology** — utility classes, CSS modules and token pipelines are settled by whatever owns them; antd's own appearance comes from its token system.
- **The application's own translated strings** — `ConfigProvider` `locale` covers antd's built-in component text only.

---

<philosophy>

## Philosophy

Ant Design's bet is that a large team gains more from one consistent, complete component set than from per-screen design freedom. Sixty-plus components cover layout, data display, data entry, navigation and feedback, and every one of them reads its appearance from the same token tree.

**The token tree is the customisation surface.** Seed tokens (`colorPrimary`, `fontSize`, `borderRadius`) are the inputs; algorithms derive Map tokens from them (`colorPrimaryHover`); Alias tokens name use cases (`colorBgContainer`); component tokens override one component (`Table.headerBg`). Changing a seed token ripples correctly through all four layers, which is what a CSS override cannot do.

**Styles are generated, not shipped as a stylesheet.** `@ant-design/cssinjs` produces them at runtime, v6 emitting pure CSS variables so a theme switch is a variable reassignment. `zeroRuntime: true` pre-extracts them to static CSS instead. Tree-shaking works natively — `babel-plugin-import` has not been needed since v4.

</philosophy>

---

<decision_framework>

## Decision Framework

**Which feedback surface?**

```
Brief status (saved, failed, loading)  -> message via useApp()
Title plus description, stays on screen -> notification via useApp()
A yes/no the user must answer           -> modal.confirm() via useApp()
A form or rich content                  -> <Modal open> (declarative)
A side panel of content                 -> <Drawer open>
```

**Table or ProTable?**

```
Display with client-side sort/filter        -> Table
Search form generated from the columns      -> ProTable
Server-driven paging and filtering          -> ProTable (request API)
Toolbar actions on a CRUD page              -> ProTable (toolBarRender)
Custom UI wrapped tightly around the rows   -> Table (more control)
```

**Form or ProForm?**

```
One page of fields                -> Form
Multi-step wizard                 -> StepsForm
Form inside a modal or drawer     -> ModalForm / DrawerForm
Search or filter bar              -> QueryFilter / LightFilter
Unusual layout                    -> Form (more flexible)
```

</decision_framework>

---

<patterns>

## Core Patterns

### Pattern 1: App Root Setup

`ConfigProvider` supplies theme and locale; `App` enables the context-aware feedback APIs. Every other pattern assumes both are present.

```tsx
import { ConfigProvider, App as AntApp } from "antd";
import type { ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";

const THEME: ThemeConfig = {
  cssVar: true,
  token: { colorPrimary: "#1677ff", borderRadius: 6 },
};

<ConfigProvider theme={THEME} locale={enUS}>
  <AntApp>
    <MainContent />
  </AntApp>
</ConfigProvider>;
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Design Tokens and Theming

Customise by setting tokens, and read them back with `useToken()` so your own elements match the active theme — including dark mode, which changes the values under the same names.

```tsx
import { theme } from "antd";

function StatusPanel() {
  const { token } = theme.useToken();
  return (
    <div
      style={{ background: token.colorBgContainer, padding: token.paddingLG }}
    >
      Matches the active theme
    </div>
  );
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Dark Mode and Theme Switching

Algorithms rewrite the derived tokens. They compose, so dark and compact can be applied together.

```tsx
import { theme as antTheme } from "antd";

const themeConfig = {
  cssVar: true,
  algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: { colorPrimary: "#1677ff" },
};

const darkCompact = {
  algorithm: [antTheme.darkAlgorithm, antTheme.compactAlgorithm],
};
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Layout System

`Layout` for the page shell, `Row`/`Col` for responsive content areas, `Flex` for aligning inline elements, `Space` for uniform gaps between small ones.

```tsx
<Layout style={{ minHeight: "100vh" }}>
  <Sider width={200} collapsible>
    <Menu theme="dark" mode="inline" items={MENU_ITEMS} />
  </Sider>
  <Layout>
    <Header />
    <Content>{children}</Content>
  </Layout>
</Layout>;

<Row gutter={[16, 16]}>
  <Col xs={24} md={8}>
    <Card />
  </Col>
</Row>;

<Flex gap={8} justify="space-between" align="center" wrap />;
```

Full code: [examples/layout.md](examples/layout.md)

---

### Pattern 5: Table

Type both `Table<T>` and `ColumnsType<T>`, set `rowKey`, and type the `onChange` handler as `TableProps<T>["onChange"]`.

```tsx
import type { ColumnsType } from "antd/es/table";

const columns: ColumnsType<OrderRecord> = [
  { title: "Customer", dataIndex: "customerName", sorter: true },
];

<Table<OrderRecord>
  columns={columns}
  dataSource={rows}
  rowKey="id"
  onChange={handleTableChange}
/>;
```

Full code: [examples/table.md](examples/table.md)

---

### Pattern 6: Form with Validation and Dynamic Fields

`initialValues` belongs on `Form`, not on individual items. `Form.useWatch` reads a field without re-rendering the whole form on every keystroke elsewhere.

```tsx
const [form] = Form.useForm<MyFormValues>();
const accountType = Form.useWatch("accountType", form);

<Form<MyFormValues>
  form={form}
  layout="vertical"
  onFinish={handleSubmit}
  initialValues={{ role: "viewer" }}
>
  <Form.Item name="email" rules={[{ required: true, type: "email" }]}>
    <Input />
  </Form.Item>
</Form>;
```

Full code: [examples/form.md](examples/form.md)

---

### Pattern 7: Feedback Components

`App.useApp()` returns instances bound to the surrounding `ConfigProvider`.

```tsx
function DeleteButton() {
  const { message, modal } = App.useApp();

  const confirm = () =>
    modal.confirm({
      title: "Delete?",
      onOk: async () => {
        await remove();
        message.success("Deleted");
      },
    });

  return <Button danger onClick={confirm} />;
}
```

Full code: [examples/feedback.md](examples/feedback.md)

---

### Pattern 8: Data Display

`Descriptions` for detail views, `Statistic` for dashboard figures. Both take a data-driven `items` API.

```tsx
<Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} items={details} />;

<Statistic title="Revenue" value={112893} prefix="$" precision={2} />;
```

Full code: [examples/data-display.md](examples/data-display.md)

---

### Pattern 9: Navigation and Icons

`Menu` and `Breadcrumb` take `items` arrays rather than JSX children. Icons are imported one at a time — the whole set is over 500KB.

```tsx
import { UserOutlined } from "@ant-design/icons";

<Menu mode="inline" items={MENU_ITEMS} onClick={({ key }) => navigate(key)} />;

<Breadcrumb items={[{ href: "/", title: "Home" }, { title: current }]} />;
```

Full code: [examples/navigation.md](examples/navigation.md)

---

### Pattern 10: SSR Style Extraction

Ant Design publishes its own registry for the extraction step; it wraps `ConfigProvider` rather than sitting inside it.

```tsx
import { AntdRegistry } from "@ant-design/nextjs-registry";

<AntdRegistry>
  <ConfigProvider theme={THEME} locale={enUS}>
    <AntApp>{children}</AntApp>
  </ConfigProvider>
</AntdRegistry>;
```

Full code: [examples/ssr.md](examples/ssr.md)

---

### Pattern 11: Internationalization

`ConfigProvider` `locale` covers antd's own component text. Date formatting comes from dayjs, whose locale is set separately — set both from one map or they drift.

```tsx
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

<ConfigProvider locale={zhCN}>
  <DatePicker />
</ConfigProvider>;
```

Full code: [examples/i18n.md](examples/i18n.md)

---

### Pattern 12: Pro Components

A `request` callback replaces the fetch-and-store wiring around the table.

```tsx
<ProTable<ProductRecord>
  columns={columns}
  rowKey="id"
  search={{ labelWidth: "auto" }}
  request={async (params, sort, filter) => {
    const res = await fetchProducts({ ...params, sort, filter });
    return { data: res.items, success: true, total: res.total };
  }}
/>
```

Full code: [examples/pro-components.md](examples/pro-components.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Static `message.success()` / `notification.open()` / `Modal.confirm()` without the `App` wrapper — they mount outside `ConfigProvider`, so the theme colours, the locale and the CSS variable references are all wrong. Take them from `App.useApp()`.
- `value` or `defaultValue` on a control inside a `Form.Item` that has a `name` — two owners of the same state, and the form's copy loses.
- Missing `rowKey` on `Table` — React key warnings, and rows update in the wrong place.
- Virtual `Table` without explicit column `width` values and numeric `scroll.x` and `scroll.y` — columns collapse or virtual mode does not engage.
- `ProTable`'s `request` returning a payload without `success: true` — the table loads forever.
- `@ant-design/icons@6` against `antd@5` — incompatible; the two majors upgrade together.
- `AntdRegistry` nested inside `ConfigProvider` under SSR — style extraction never runs and the first paint flashes unstyled.

**Surprising behaviour:**

- `Form.useWatch` re-renders the component on every change of the watched field — reach for it deliberately in large forms.
- `Table`'s `onChange` fires for pagination, filters and sorting alike; the `extra` parameter says which.
- `Form.Item`'s `initialValue` and `Form`'s `initialValues` behave differently on reset — set them on `Form`.
- A `Modal` or `Drawer` containing a `Form` keeps stale field state across open and close without `destroyOnHidden` — the prop was `destroyOnClose` before 5.25.
- A nested `ConfigProvider` inherits every token the parent set; isolation means stating them explicitly.
- Component tokens with `algorithm: true` derive from that component's own `colorPrimary`, not the global one.
- `modal.confirm()` returns a handle for updating or destroying the dialog — keep it if anything else has to close it.
- Dot-notation sub-components (`<Select.Option>`) do not resolve in a server component; destructure them or use the `options` API.
- dayjs keeps its own locale — setting `ConfigProvider` `locale` alone leaves dates in the previous language.

</red_flags>
