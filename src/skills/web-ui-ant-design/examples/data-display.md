# Ant Design -- Data Display Examples

> Descriptions, Statistic cards and Badge patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Tables & Data Display](table.md)
- [Layout](layout.md)
- [Core Setup & Theming](core.md)

---

## Descriptions (Detail View)

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

---

## Dashboard Stats Cards

```tsx
import { Card, Row, Col, Statistic, theme } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

const PRECISION = 2;

function DashboardCards() {
  const { token } = theme.useToken();

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Revenue"
            value={112893}
            precision={PRECISION}
            prefix="$"
            valueStyle={{ color: token.colorSuccess }}
            suffix={<ArrowUpOutlined />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Active Users"
            value={9280}
            valueStyle={{ color: token.colorError }}
            suffix={<ArrowDownOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
}
export { DashboardCards };
```

`valueStyle` takes a token rather than a hex, so the figures follow the dark and compact algorithms instead of staying green-on-anything.
