# Ant Design Practical Examples

> Complete, runnable code examples for common Ant Design patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

---

## Theme Configuration

### Complete Enterprise Theme

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

### Dark Mode Toggle with Persistence

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

## Advanced Table

### Server-Side Table with Sorting, Filtering, and Selection

```tsx
import { useState, useCallback } from "react";
import { Table, Button, Space, Tag, Input, App } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import {
  SearchOutlined,
  ExportOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

interface OrderRecord {
  id: string;
  customerName: string;
  email: string;
  amount: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
  sortField?: string;
  sortOrder?: "ascend" | "descend";
  filters: Record<string, FilterValue | null>;
}

const DEFAULT_PAGE_SIZE = 20;

const STATUS_CONFIG: Record<
  OrderRecord["status"],
  { color: string; label: string }
> = {
  pending: { color: "default", label: "Pending" },
  processing: { color: "processing", label: "Processing" },
  shipped: { color: "blue", label: "Shipped" },
  delivered: { color: "success", label: "Delivered" },
  cancelled: { color: "error", label: "Cancelled" },
};

function OrderTable() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: { current: 1, pageSize: DEFAULT_PAGE_SIZE },
    filters: {},
  });

  const fetchData = useCallback(async (params: TableParams) => {
    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: params.pagination.current,
          pageSize: params.pagination.pageSize,
          sortField: params.sortField,
          sortOrder: params.sortOrder,
          filters: params.filters,
        }),
      });
      const result = await response.json();
      setData(result.items);
      setTableParams((prev) => ({
        ...prev,
        pagination: { ...prev.pagination, total: result.total },
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<OrderRecord> | SorterResult<OrderRecord>[],
  ) => {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const newParams: TableParams = {
      pagination,
      filters,
      sortField: singleSorter?.field as string | undefined,
      sortOrder: singleSorter?.order ?? undefined,
    };
    setTableParams(newParams);
    fetchData(newParams);
  };

  const handleBulkDelete = () => {
    modal.confirm({
      title: `Delete ${selectedRowKeys.length} orders?`,
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        await deleteOrders(selectedRowKeys as string[]);
        message.success(`Deleted ${selectedRowKeys.length} orders`);
        setSelectedRowKeys([]);
        fetchData(tableParams);
      },
    });
  };

  const columns: ColumnsType<OrderRecord> = [
    {
      title: "Customer",
      dataIndex: "customerName",
      sorter: true,
      ellipsis: true,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search customer"
            value={selectedKeys[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => confirm()}
            style={{ marginBottom: 8, display: "block" }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              icon={<SearchOutlined />}
            >
              Search
            </Button>
            <Button onClick={() => clearFilters?.()} size="small">
              Reset
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      sorter: true,
      align: "right",
      render: (amount: number) => `$${amount.toFixed(2)}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      filters: Object.entries(STATUS_CONFIG).map(([value, config]) => ({
        text: config.label,
        value,
      })),
      render: (status: OrderRecord["status"]) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      sorter: true,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ExportOutlined />}>Export</Button>
        {selectedRowKeys.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete}>
            Delete ({selectedRowKeys.length})
          </Button>
        )}
      </Space>
      <Table<OrderRecord>
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...tableParams.pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        onChange={handleTableChange}
      />
    </>
  );
}
export { OrderTable };
export type { OrderRecord };
```

---

### Expandable Table with Summary Row

```tsx
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

const columns: ColumnsType<InvoiceItem> = [
  { title: "Description", dataIndex: "description" },
  { title: "Qty", dataIndex: "quantity", align: "right" },
  {
    title: "Unit Price",
    dataIndex: "unitPrice",
    align: "right",
    render: (price: number) => `$${price.toFixed(2)}`,
  },
  {
    title: "Total",
    key: "total",
    align: "right",
    render: (_, record) =>
      `$${(record.quantity * record.unitPrice).toFixed(2)}`,
  },
];

function InvoiceTable({ items }: { items: InvoiceItem[] }) {
  return (
    <Table<InvoiceItem>
      columns={columns}
      dataSource={items}
      rowKey="id"
      pagination={false}
      expandable={{
        expandedRowRender: (record) =>
          record.notes ? <p style={{ margin: 0 }}>{record.notes}</p> : null,
        rowExpandable: (record) => !!record.notes,
      }}
      summary={(pageData) => {
        const total = pageData.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        return (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}>
              <strong>Grand Total</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>${total.toFixed(2)}</strong>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        );
      }}
    />
  );
}
export { InvoiceTable };
```

---

## Form Patterns

### Complex Form with Dependencies and Async Validation

```tsx
import { Form, Input, Select, InputNumber, Divider, Button, App } from "antd";
import type { Rule } from "antd/es/form";

interface RegistrationFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: "personal" | "business";
  companyName?: string;
  employeeCount?: number;
}

const MIN_PASSWORD_LENGTH = 8;
const MAX_COMPANY_NAME_LENGTH = 100;

// Async validator to check username availability
const checkUsernameAvailable = async (_: Rule, value: string) => {
  if (!value) return;
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  if (!available) {
    throw new Error("Username is already taken");
  }
};

function RegistrationForm() {
  const [form] = Form.useForm<RegistrationFormValues>();
  const { message } = App.useApp();
  const accountType = Form.useWatch("accountType", form);

  const handleFinish = async (values: RegistrationFormValues) => {
    try {
      await registerUser(values);
      message.success("Registration successful!");
    } catch {
      message.error("Registration failed. Please try again.");
    }
  };

  return (
    <Form<RegistrationFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ accountType: "personal" }}
    >
      <Form.Item
        name="username"
        label="Username"
        hasFeedback
        rules={[
          { required: true, message: "Username is required" },
          { min: 3, max: 20, message: "Username must be 3-20 characters" },
          {
            pattern: /^[a-zA-Z0-9_]+$/,
            message: "Only letters, numbers, and underscores",
          },
          { validator: checkUsernameAvailable },
        ]}
        validateDebounce={500}
      >
        <Input placeholder="Choose a username" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: "Email is required" },
          { type: "email", message: "Enter a valid email" },
        ]}
      >
        <Input placeholder="you@example.com" />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[
          { required: true, message: "Password is required" },
          {
            min: MIN_PASSWORD_LENGTH,
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          },
        ]}
      >
        <Input.Password placeholder="Enter password" />
      </Form.Item>

      {/* Password confirmation with dependency on 'password' field */}
      <Form.Item
        name="confirmPassword"
        label="Confirm Password"
        dependencies={["password"]}
        rules={[
          { required: true, message: "Please confirm your password" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("Passwords do not match"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="Confirm password" />
      </Form.Item>

      <Divider />

      <Form.Item
        name="accountType"
        label="Account Type"
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { label: "Personal", value: "personal" },
            { label: "Business", value: "business" },
          ]}
        />
      </Form.Item>

      {/* Conditional fields based on accountType */}
      {accountType === "business" && (
        <>
          <Form.Item
            name="companyName"
            label="Company Name"
            rules={[
              { required: true, message: "Company name is required" },
              { max: MAX_COMPANY_NAME_LENGTH },
            ]}
          >
            <Input placeholder="Your company name" />
          </Form.Item>
          <Form.Item
            name="employeeCount"
            label="Number of Employees"
            rules={[{ required: true, message: "Employee count is required" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          Register
        </Button>
      </Form.Item>
    </Form>
  );
}
export { RegistrationForm };
```

---

### Modal Form Pattern

```tsx
import { useState } from "react";
import { Modal, Form, Input, Select, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface InviteFormValues {
  email: string;
  role: "admin" | "member" | "viewer";
  message?: string;
}

function InviteMemberModal() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<InviteFormValues>();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await sendInvite(values);
      message.success(`Invitation sent to ${values.email}`);
      form.resetFields();
      setOpen(false);
    } catch {
      // validateFields rejection is handled by Form UI
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setOpen(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
      >
        Invite Member
      </Button>
      <Modal
        title="Invite Team Member"
        open={open}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form<InviteFormValues>
          form={form}
          layout="vertical"
          initialValues={{ role: "member" }}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="colleague@company.com" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Admin", value: "admin" },
                { label: "Member", value: "member" },
                { label: "Viewer", value: "viewer" },
              ]}
            />
          </Form.Item>
          <Form.Item name="message" label="Personal Message">
            <Input.TextArea rows={3} placeholder="Optional welcome message" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
export { InviteMemberModal };
```

---

## Pro Components

### ProLayout with Route-Based Menu

```tsx
import { ProLayout } from "@ant-design/pro-components";
import type { ProLayoutProps } from "@ant-design/pro-components";
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const ROUTE_CONFIG: ProLayoutProps["route"] = {
  path: "/",
  routes: [
    { path: "/dashboard", name: "Dashboard", icon: <DashboardOutlined /> },
    {
      path: "/users",
      name: "Users",
      icon: <UserOutlined />,
      routes: [
        { path: "/users/list", name: "User List" },
        { path: "/users/roles", name: "Roles & Permissions" },
      ],
    },
    {
      path: "/orders",
      name: "Orders",
      icon: <ShoppingCartOutlined />,
      routes: [
        { path: "/orders/list", name: "Order List" },
        { path: "/orders/returns", name: "Returns" },
      ],
    },
    { path: "/settings", name: "Settings", icon: <SettingOutlined /> },
  ],
};

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProLayout
      title="Admin Portal"
      logo="/logo.svg"
      route={ROUTE_CONFIG}
      layout="mix"
      fixedHeader
      fixSiderbar
      menuItemRender={(item, dom) => <a href={item.path}>{dom}</a>}
    >
      {children}
    </ProLayout>
  );
}
export { AdminLayout };
```

---

### ProTable with Full CRUD

```tsx
import { useRef } from "react";
import {
  ProTable,
  ModalForm,
  ProFormText,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { ProColumns, ActionType } from "@ant-design/pro-components";
import { Button, App, Popconfirm } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface ProductRecord {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "active" | "draft" | "archived";
}

function ProductManagement() {
  const actionRef = useRef<ActionType>();
  const { message } = App.useApp();

  const columns: ProColumns<ProductRecord>[] = [
    {
      title: "Product Name",
      dataIndex: "name",
      copyable: true,
      ellipsis: true,
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: "Category",
      dataIndex: "category",
      valueEnum: {
        electronics: { text: "Electronics" },
        clothing: { text: "Clothing" },
        books: { text: "Books" },
        home: { text: "Home & Garden" },
      },
    },
    {
      title: "Price",
      dataIndex: "price",
      valueType: "money",
      sorter: true,
      hideInSearch: true,
    },
    {
      title: "Stock",
      dataIndex: "stock",
      valueType: "digit",
      sorter: true,
      hideInSearch: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      valueEnum: {
        active: { text: "Active", status: "Success" },
        draft: { text: "Draft", status: "Default" },
        archived: { text: "Archived", status: "Error" },
      },
    },
    {
      title: "Actions",
      valueType: "option",
      width: 180,
      render: (_, record) => [
        <a key="edit" onClick={() => handleEdit(record)}>
          Edit
        </a>,
        <Popconfirm
          key="delete"
          title="Delete this product?"
          onConfirm={async () => {
            await deleteProduct(record.id);
            message.success("Product deleted");
            actionRef.current?.reload();
          }}
        >
          <a style={{ color: "red" }}>Delete</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<ProductRecord>
      columns={columns}
      actionRef={actionRef}
      request={async (params, sort, filter) => {
        const response = await fetchProducts({ ...params, sort, filter });
        return {
          data: response.items,
          success: true,
          total: response.total,
        };
      }}
      rowKey="id"
      search={{ labelWidth: "auto" }}
      pagination={{ defaultPageSize: 20 }}
      dateFormatter="string"
      headerTitle="Product Management"
      toolBarRender={() => [
        <ModalForm<Omit<ProductRecord, "id">>
          key="add"
          title="Add Product"
          trigger={
            <Button type="primary" icon={<PlusOutlined />}>
              Add Product
            </Button>
          }
          onFinish={async (values) => {
            await createProduct(values);
            message.success("Product created");
            actionRef.current?.reload();
            return true; // Close modal
          }}
        >
          <ProFormText
            name="name"
            label="Product Name"
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="category"
            label="Category"
            options={[
              { label: "Electronics", value: "electronics" },
              { label: "Clothing", value: "clothing" },
              { label: "Books", value: "books" },
              { label: "Home & Garden", value: "home" },
            ]}
            rules={[{ required: true }]}
          />
          <ProFormText
            name="price"
            label="Price"
            rules={[{ required: true }]}
          />
          <ProFormText
            name="stock"
            label="Stock"
            rules={[{ required: true }]}
          />
        </ModalForm>,
      ]}
    />
  );
}
export { ProductManagement };
```

---

## Next.js App Router Setup

### Complete Layout with Theme and Locale

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

### Client Component for Interactive Features

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

## Drawer Pattern

### Settings Drawer

```tsx
import { useState } from "react";
import { Drawer, Form, Input, Switch, Select, Button, Space, App } from "antd";
import { SettingOutlined } from "@ant-design/icons";

interface SettingsFormValues {
  displayName: string;
  emailNotifications: boolean;
  language: string;
  timezone: string;
}

const DRAWER_WIDTH = 480;

function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<SettingsFormValues>();
  const { message } = App.useApp();

  const handleSave = async () => {
    const values = await form.validateFields();
    await updateSettings(values);
    message.success("Settings saved");
    setOpen(false);
  };

  return (
    <>
      <Button icon={<SettingOutlined />} onClick={() => setOpen(true)}>
        Settings
      </Button>
      <Drawer
        title="Settings"
        width={DRAWER_WIDTH}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>
              Save
            </Button>
          </Space>
        }
      >
        <Form<SettingsFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            emailNotifications: true,
            language: "en",
            timezone: "UTC",
          }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="emailNotifications"
            label="Email Notifications"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="language" label="Language">
            <Select
              options={[
                { label: "English", value: "en" },
                { label: "Chinese", value: "zh" },
                { label: "Japanese", value: "ja" },
              ]}
            />
          </Form.Item>
          <Form.Item name="timezone" label="Timezone">
            <Select
              showSearch
              options={[
                { label: "UTC", value: "UTC" },
                { label: "US/Eastern", value: "US/Eastern" },
                { label: "US/Pacific", value: "US/Pacific" },
                { label: "Asia/Tokyo", value: "Asia/Tokyo" },
                { label: "Europe/London", value: "Europe/London" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
export { SettingsDrawer };
```

---

## Custom Token Consumer

### Using useToken for Custom Components

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
