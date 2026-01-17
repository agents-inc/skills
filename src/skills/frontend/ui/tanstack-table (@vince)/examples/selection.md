# TanStack Table - Row Selection

> Row selection examples. See [core.md](core.md) for basic table setup.

---

## Multi-Select with Bulk Actions

### Good Example - Selection with indeterminate state and bulk operations

```typescript
import { useState, useMemo } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { RowSelectionState } from "@tanstack/react-table";

type Task = {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  assignee: string;
};

const columnHelper = createColumnHelper<Task>();

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () => [
      // Checkbox column
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomeRowsSelected();
              }
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select row ${row.original.title}`}
          />
        ),
      }),
      columnHelper.accessor("title", { header: "Title" }),
      columnHelper.accessor("status", { header: "Status" }),
      columnHelper.accessor("assignee", { header: "Assignee" }),
    ],
    []
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);

  const handleBulkDelete = () => {
    console.log("Delete tasks:", selectedIds);
    // After deletion, clear selection
    setRowSelection({});
  };

  const handleBulkStatusChange = (status: Task["status"]) => {
    console.log("Change status to", status, "for:", selectedIds);
  };

  return (
    <div>
      {/* Bulk actions bar */}
      {selectedRows.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions">
          <span>{selectedRows.length} selected</span>
          <button onClick={handleBulkDelete}>Delete Selected</button>
          <select
            onChange={(e) =>
              handleBulkStatusChange(e.target.value as Task["status"])
            }
            defaultValue=""
          >
            <option value="" disabled>
              Change status...
            </option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      )}

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
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Why good:** indeterminate checkbox state for partial selection, `getRowId` ensures selection persists across data updates, bulk action bar shows only when items selected, aria-labels for accessibility

---

## Key Selection Options

```typescript
// Table options
const table = useReactTable({
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true,           // Enable selection
  enableMultiRowSelection: true,      // Default: true
  enableSubRowSelection: true,        // For hierarchical data
  getRowId: (row) => row.id,          // CRITICAL: stable IDs
});

// Selection utilities
table.getIsAllRowsSelected();         // All rows selected?
table.getIsSomeRowsSelected();        // Some (not all) selected?
table.getSelectedRowModel().rows;     // Get selected Row objects
table.getToggleAllRowsSelectedHandler(); // Toggle all handler
row.getIsSelected();                  // Is this row selected?
row.getCanSelect();                   // Can this row be selected?
row.getToggleSelectedHandler();       // Toggle handler for row
```
