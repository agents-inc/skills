# TanStack Table - Expanding Rows

> Expanding rows examples. See [core.md](core.md) for basic table setup.

---

## Expandable Rows with Sub-Content

### Good Example - Orders table with expandable item details

```typescript
import { useState, useMemo, Fragment } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ExpandedState } from "@tanstack/react-table";

type Order = {
  id: string;
  customer: string;
  total: number;
  status: string;
  items: Array<{ name: string; quantity: number; price: number }>;
};

const columnHelper = createColumnHelper<Order>();

export function ExpandableOrderTable({ orders }: { orders: Order[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columns = useMemo(
    () => [
      // Expander column
      columnHelper.display({
        id: "expander",
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={row.getIsExpanded()}
            aria-label={
              row.getIsExpanded() ? "Collapse order details" : "Expand order details"
            }
          >
            {row.getIsExpanded() ? "▼" : "▶"}
          </button>
        ),
      }),
      columnHelper.accessor("id", { header: "Order ID" }),
      columnHelper.accessor("customer", { header: "Customer" }),
      columnHelper.accessor("total", {
        header: "Total",
        cell: (info) => `$${info.getValue().toFixed(2)}`,
      }),
      columnHelper.accessor("status", { header: "Status" }),
    ],
    []
  );

  const table = useReactTable({
    data: orders,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <Fragment key={row.id}>
            <tr>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {/* Expanded content row */}
            {row.getIsExpanded() && (
              <tr>
                <td colSpan={row.getVisibleCells().length}>
                  <div>
                    <h4>Order Items</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Quantity</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.original.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>${item.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

**Why good:** the detail row is a second `<tr>` emitted beside the first, which is why the pair needs
a `Fragment` — the table has no slot for it, and `getExpandedRowModel` interleaves sub-rows rather
than nesting them. `colSpan` spans the detail across every column so it does not inherit the column
grid. `aria-expanded` on the toggle is what tells a screen reader the control has two states, and
`getRowCanExpand` is what keeps a toggle off rows with nothing behind them.

---

## Key Expansion Options

```typescript
// Table options
const table = useReactTable({
  state: { expanded },
  onExpandedChange: setExpanded,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: (row) => row.original.hasChildren, // Control expandability
  // For hierarchical data with nested rows:
  getSubRows: (row) => row.subRows,
});

// Expansion utilities
row.getIsExpanded(); // Is row expanded?
row.getToggleExpandedHandler(); // Toggle function
row.getCanExpand(); // Can this row expand?
table.getExpandedRowModel(); // All expanded rows
table.toggleAllRowsExpanded(); // Expand/collapse all
```
