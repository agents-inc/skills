# Ant Design Quick Reference

> Decision frameworks, component checklists, and ConfigProvider options for Ant Design. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for full code examples.

---

## ConfigProvider Props Reference

| Prop                      | Type                             | Description                                          |
| ------------------------- | -------------------------------- | ---------------------------------------------------- |
| `theme`                   | `ThemeConfig`                    | Design token configuration                           |
| `locale`                  | `Locale`                         | Component text locale (import from `antd/locale/*`)  |
| `direction`               | `"ltr" \| "rtl"`                 | Text direction                                       |
| `componentSize`           | `"small" \| "middle" \| "large"` | Global component size                                |
| `prefixCls`               | `string`                         | CSS class prefix (default: `ant`)                    |
| `getPopupContainer`       | `(triggerNode) => HTMLElement`   | Popup mount target                                   |
| `autoInsertSpaceInButton` | `boolean`                        | Auto-insert space between 2 CJK characters in Button |
| `componentDisabled`       | `boolean`                        | Disable all components globally                      |

---

## ThemeConfig Shape

```typescript
import type { ThemeConfig } from "antd";

const theme: ThemeConfig = {
  // CSS variables mode for efficient theme switching
  cssVar: true, // or { key: "my-app" } for React <18

  // Disable hashed class names (safe with single antd version)
  hashed: false,

  // Theme algorithm(s)
  algorithm: theme.defaultAlgorithm, // or darkAlgorithm, compactAlgorithm, or array

  // Global design tokens (Seed tokens)
  token: {
    colorPrimary: "#1677ff",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorInfo: "#1677ff",
    borderRadius: 6,
    fontSize: 14,
    fontFamily: "...",
    wireframe: false, // true for wireframe style
  },

  // Component-level token overrides
  components: {
    Button: {
      colorPrimary: "#00b96b",
      algorithm: true, // derive other tokens from this colorPrimary
    },
    Table: {
      headerBg: "#fafafa",
      rowHoverBg: "#f0f7ff",
    },
  },
};
```

---

## Seed Tokens (Foundational)

| Token           | Default      | Description                   |
| --------------- | ------------ | ----------------------------- |
| `colorPrimary`  | `#1677ff`    | Brand primary color           |
| `colorSuccess`  | `#52c41a`    | Success state color           |
| `colorWarning`  | `#faad14`    | Warning state color           |
| `colorError`    | `#ff4d4f`    | Error/danger state color      |
| `colorInfo`     | `#1677ff`    | Informational color           |
| `borderRadius`  | `6`          | Base border radius (px)       |
| `fontSize`      | `14`         | Base font size (px)           |
| `fontFamily`    | System fonts | Font stack                    |
| `wireframe`     | `false`      | Wireframe visual style        |
| `colorBgBase`   | `#fff`       | Base background color         |
| `colorTextBase` | `#000`       | Base text color               |
| `sizeUnit`      | `4`          | Base sizing unit              |
| `sizeStep`      | `4`          | Sizing step increment         |
| `controlHeight` | `32`         | Default control height (px)   |
| `lineWidth`     | `1`          | Default border width          |
| `lineType`      | `solid`      | Default border style          |
| `motionUnit`    | `0.1`        | Animation base unit (seconds) |

---

## Theme Algorithms

| Algorithm          | Import                   | Use Case              |
| ------------------ | ------------------------ | --------------------- |
| `defaultAlgorithm` | `theme.defaultAlgorithm` | Light mode (default)  |
| `darkAlgorithm`    | `theme.darkAlgorithm`    | Dark mode             |
| `compactAlgorithm` | `theme.compactAlgorithm` | Dense/compact spacing |

Algorithms can be combined: `algorithm: [theme.darkAlgorithm, theme.compactAlgorithm]`

---

## Table Component Checklist

- [ ] Generic type applied: `<Table<RecordType>>` and `ColumnsType<RecordType>`
- [ ] `rowKey` set (string key or function)
- [ ] Pagination configured (or `pagination={false}` if virtual)
- [ ] `loading` prop connected to data fetch state
- [ ] Column `key` set for each column
- [ ] Virtual mode has explicit column `width` values and both `scroll.x` and `scroll.y` as numbers
- [ ] `onChange` handler typed: `TableProps<RecordType>["onChange"]`
- [ ] Filters use `onFilter` for client-side or server-side pagination params

---

## Form Component Checklist

- [ ] `Form.useForm<T>()` with TypeScript generic for field types
- [ ] `initialValues` set on `<Form>` (not individual `Form.Item`)
- [ ] `onFinish` handler for successful validation
- [ ] Rules defined on `Form.Item` with proper messages
- [ ] `layout` set: `"vertical"` | `"horizontal"` | `"inline"`
- [ ] `destroyOnClose` on Modal/Drawer containing the Form
- [ ] `htmlType="submit"` on the submit button
- [ ] `Form.useWatch` for conditional field rendering (not `onValuesChange`)
- [ ] `Form.List` for dynamic field arrays with `add`/`remove` operations

---

## Common Imports

```typescript
// Core components
import { ConfigProvider, App, Button, Space, Flex, Divider } from "antd";

// Layout
import { Layout, Row, Col, Grid } from "antd";
const { Header, Content, Sider, Footer } = Layout;

// Data display
import {
  Table,
  Card,
  Descriptions,
  Statistic,
  List,
  Tree,
  Tag,
  Badge,
  Tooltip,
} from "antd";

// Data entry
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Checkbox,
  Radio,
  Switch,
  Upload,
  Transfer,
  Cascader,
  AutoComplete,
} from "antd";

// Navigation
import { Menu, Breadcrumb, Pagination, Steps, Tabs, Dropdown } from "antd";

// Feedback
import { Modal, Drawer, Spin, Alert, Result, Progress } from "antd";
// NOTE: message, notification - use App.useApp() instead of static imports

// Theme
import { theme } from "antd";
const { useToken, defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme;

// Types
import type { ThemeConfig, MenuProps, TableProps, FormInstance } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Rule } from "antd/es/form";
import type { Locale } from "antd/es/locale";

// Icons (import individually)
import { UserOutlined, SearchOutlined, PlusOutlined } from "@ant-design/icons";

// Locale
import enUS from "antd/locale/en_US";

// Pro Components
import {
  ProTable,
  ProForm,
  ProLayout,
  ProDescriptions,
  StepsForm,
  ModalForm,
  DrawerForm,
  QueryFilter,
} from "@ant-design/pro-components";
import type { ProColumns, ActionType } from "@ant-design/pro-components";

// Next.js
import { AntdRegistry } from "@ant-design/nextjs-registry";
```

---

## Component Quick Decision Matrix

| Need             | Component                                 | Key Props                                       |
| ---------------- | ----------------------------------------- | ----------------------------------------------- |
| Page shell       | `Layout` + `Sider` + `Header` + `Content` | `collapsible`, `width`                          |
| Responsive grid  | `Row` + `Col`                             | `gutter`, `xs`/`sm`/`md`/`lg`/`xl`              |
| Inline alignment | `Flex`                                    | `gap`, `justify`, `align`, `wrap`               |
| Uniform spacing  | `Space`                                   | `size`, `direction`, `wrap`                     |
| Data table       | `Table`                                   | `columns`, `dataSource`, `rowKey`, `virtual`    |
| CRUD table       | `ProTable`                                | `request`, `columns`, `search`, `toolBarRender` |
| Detail view      | `Descriptions`                            | `items`, `bordered`, `column`                   |
| Form             | `Form`                                    | `form`, `layout`, `onFinish`, `initialValues`   |
| Step wizard      | `StepsForm`                               | `onFinish`, `StepForm` children                 |
| Modal form       | `ModalForm`                               | `trigger`, `onFinish`, `title`                  |
| Sidebar menu     | `Menu`                                    | `items`, `mode="inline"`, `onClick`             |
| Tabs             | `Tabs`                                    | `items`, `onChange`, `activeKey`                |
| Confirm action   | `modal.confirm()`                         | via `App.useApp()`                              |
| Toast message    | `message.success()`                       | via `App.useApp()`                              |
| Notification     | `notification.open()`                     | via `App.useApp()`                              |
| Side panel       | `Drawer`                                  | `open`, `onClose`, `placement`, `width`         |
| Loading state    | `Spin`                                    | `spinning`, `size`, `tip`                       |
| Status display   | `Tag` or `Badge`                          | `color`, `status`                               |
| Stat card        | `Statistic`                               | `title`, `value`, `prefix`, `suffix`            |

---

## Bundle Size Tips

1. **Icons**: Import individually, never `import * as Icons`
2. **CSS Variables**: Enable `cssVar: true` to reduce runtime style generation
3. **Hashed**: Set `hashed: false` when only one antd version exists
4. **Dynamic imports**: Lazy-load heavy page components
5. **dayjs**: Default date library (2KB), no action needed
6. **Pro Components**: Import only what you use from `@ant-design/pro-components`

---

## Locale Files

Import from `antd/locale/{locale_code}`:

| Language              | Import              |
| --------------------- | ------------------- |
| English (US)          | `antd/locale/en_US` |
| English (UK)          | `antd/locale/en_GB` |
| Chinese (Simplified)  | `antd/locale/zh_CN` |
| Chinese (Traditional) | `antd/locale/zh_TW` |
| Japanese              | `antd/locale/ja_JP` |
| Korean                | `antd/locale/ko_KR` |
| French                | `antd/locale/fr_FR` |
| German                | `antd/locale/de_DE` |
| Spanish               | `antd/locale/es_ES` |
| Portuguese (Brazil)   | `antd/locale/pt_BR` |
| Russian               | `antd/locale/ru_RU` |
| Arabic                | `antd/locale/ar_EG` |

**Note:** ConfigProvider locale only covers antd component text. Set dayjs locale separately for date/time formatting.

---

## v5 to v6 Migration Notes

Ant Design v6 was released November 2025 and is the current major version (6.3.x as of March 2026). v5 is in a 1-year maintenance period.

**Key v6 changes:**

- CSS Variables mode is now the default (was opt-in with `cssVar: true` in v5)
- Zero-runtime mode available via `zeroRuntime: true` in theme config (use with `@ant-design/static-style-extract`)
- React 18+ required (React 17 dropped); React 19 fully supported without patches
- IE support completely removed
- DOM structure changes for better semantics -- some component tokens from the v4-to-v5 migration were cleaned up
- `findDOMNode` compatibility logic removed
- New components: Masonry, resizable Drawer, InputNumber spinner mode

**Upgrade path:** v6 is designed as a smooth upgrade from v5. Most component APIs remain compatible. Remove `@ant-design/v5-patch-for-react-19` if previously used. Check console for deprecation warnings on v5 before upgrading.

All patterns in this skill apply to both v5 and v6 unless noted.
