# Ant Design -- Pro Components Examples

> ProLayout, ProTable, ProForm, and StepsForm patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Tables & Data Display](table.md)
- [Forms & Validation](form.md)
- [Layout](layout.md)

---

## ProLayout with Route-Based Menu

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

## ProTable with Full CRUD

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

## ProForm StepsForm (Wizard)

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

**When to use:** ProTable for CRUD pages with search/filter, ProForm for step-by-step wizards and modal/drawer forms, ProLayout for admin shell with route-based menu generation.
