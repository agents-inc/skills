# Ant Design -- Table Examples

> Table patterns with sorting, filtering, pagination, row selection, virtual scrolling, and expandable rows. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Data Display Components](data-display.md)
- [Forms & Validation](form.md)
- [Pro Components](pro-components.md)

---

## Server-Side Table with Sorting, Filtering, and Selection

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

## Expandable Table with Summary Row

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

## Client-Side Table with Sorting and Filtering

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
    // Handle table change events
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

---

## Virtual Scrolling (Large Datasets)

```tsx
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

const VIRTUAL_SCROLL_HEIGHT = 500;
const VIRTUAL_SCROLL_WIDTH = 1200;

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
      scroll={{ x: VIRTUAL_SCROLL_WIDTH, y: VIRTUAL_SCROLL_HEIGHT }}
      pagination={false}
    />
  );
}
export { VirtualTable };
```

**Important:** Virtual scrolling requires both `scroll.x` and `scroll.y` to be set as numbers. All columns should have explicit `width` values to avoid alignment issues.
