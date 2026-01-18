# TanStack Table - Column Pinning

> Column pinning examples. See [core.md](core.md) for basic table setup.

**Use when:** Keeping important columns visible during horizontal scrolling (e.g., ID column on left, actions on right).

---

## Column Pinning with Sticky CSS

### Good Example - Pinned columns with sticky positioning

```typescript
import { useState, useMemo, useCallback } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnPinningState } from "@tanstack/react-table";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: string;
  actions: null;
};

const columnHelper = createColumnHelper<User>();

const PINNED_COLUMN_WIDTH = 150;
const LEFT_PIN_OFFSET = 0;

export function PinnedColumnTable({ data }: { data: User[] }) {
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["id"], // Pin ID column to left
    right: ["actions"], // Pin actions column to right
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "ID",
        size: PINNED_COLUMN_WIDTH,
      }),
      columnHelper.accessor("firstName", { header: "First Name" }),
      columnHelper.accessor("lastName", { header: "Last Name" }),
      columnHelper.accessor("email", { header: "Email", size: 250 }),
      columnHelper.accessor("department", { header: "Department" }),
      columnHelper.accessor("role", { header: "Role" }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button onClick={() => console.log("Edit", row.original.id)}>
            Edit
          </button>
        ),
        size: PINNED_COLUMN_WIDTH,
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnPinning },
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
  });

  // Calculate left offset for each pinned column
  const getLeftOffset = useCallback(
    (columnId: string) => {
      const leftPinnedColumns = columnPinning.left ?? [];
      const index = leftPinnedColumns.indexOf(columnId);
      if (index === 0) return LEFT_PIN_OFFSET;

      let offset = 0;
      for (let i = 0; i < index; i++) {
        const col = table.getColumn(leftPinnedColumns[i]);
        offset += col?.getSize() ?? 0;
      }
      return offset;
    },
    [columnPinning.left, table]
  );

  // Calculate right offset for each pinned column
  const getRightOffset = useCallback(
    (columnId: string) => {
      const rightPinnedColumns = columnPinning.right ?? [];
      const index = rightPinnedColumns.indexOf(columnId);
      const reversedIndex = rightPinnedColumns.length - 1 - index;

      if (reversedIndex === 0) return 0;

      let offset = 0;
      for (let i = rightPinnedColumns.length - 1; i > index; i--) {
        const col = table.getColumn(rightPinnedColumns[i]);
        offset += col?.getSize() ?? 0;
      }
      return offset;
    },
    [columnPinning.right, table]
  );

  return (
    <div style={{ overflow: "auto", maxWidth: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isPinnedLeft = header.column.getIsPinned() === "left";
                const isPinnedRight = header.column.getIsPinned() === "right";

                return (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      position: isPinnedLeft || isPinnedRight ? "sticky" : "relative",
                      left: isPinnedLeft ? getLeftOffset(header.column.id) : undefined,
                      right: isPinnedRight ? getRightOffset(header.column.id) : undefined,
                      background: isPinnedLeft || isPinnedRight ? "#fff" : "transparent",
                      zIndex: isPinnedLeft || isPinnedRight ? 1 : 0,
                      boxShadow: isPinnedLeft
                        ? "2px 0 4px -2px rgba(0,0,0,0.1)"
                        : isPinnedRight
                        ? "-2px 0 4px -2px rgba(0,0,0,0.1)"
                        : undefined,
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const isPinnedLeft = cell.column.getIsPinned() === "left";
                const isPinnedRight = cell.column.getIsPinned() === "right";

                return (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      position: isPinnedLeft || isPinnedRight ? "sticky" : "relative",
                      left: isPinnedLeft ? getLeftOffset(cell.column.id) : undefined,
                      right: isPinnedRight ? getRightOffset(cell.column.id) : undefined,
                      background: isPinnedLeft || isPinnedRight ? "#fff" : "transparent",
                      zIndex: isPinnedLeft || isPinnedRight ? 1 : 0,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Why good:** `ColumnPinningState` provides controlled pinning state, `getIsPinned()` returns "left" | "right" | false, sticky positioning with calculated offsets, shadows provide visual separation, background prevents content overlap

---

## Key Column Pinning Options

```typescript
import type { ColumnPinningState } from "@tanstack/react-table";

// State structure
const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
  left: ["id", "name"], // Columns pinned to left (in order)
  right: ["actions"],   // Columns pinned to right (in order)
});

// Table options
const table = useReactTable({
  state: { columnPinning },
  onColumnPinningChange: setColumnPinning,
  getCoreRowModel: getCoreRowModel(),
  // Column default can also be set:
  defaultColumn: {
    enablePinning: true, // Default: true
  },
});

// Column-level control
columnHelper.accessor("id", {
  enablePinning: true,  // Allow this column to be pinned
});

// Pinning utilities
column.pin("left");           // Pin column to left
column.pin("right");          // Pin column to right
column.pin(false);            // Unpin column
column.getIsPinned();         // Returns "left" | "right" | false
column.getCanPin();           // Can this column be pinned?

// Get cells by pin position
row.getLeftVisibleCells();    // Cells from left-pinned columns
row.getCenterVisibleCells();  // Cells from unpinned columns
row.getRightVisibleCells();   // Cells from right-pinned columns
```

---

## Split Table Approach (Alternative)

For complex pinning scenarios, you can render separate tables for pinned and center columns.

```typescript
export function SplitPinnedTable({ data }: { data: User[] }) {
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["id"],
    right: ["actions"],
  });

  const table = useReactTable({
    data,
    columns,
    state: { columnPinning },
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div style={{ display: "flex", overflow: "auto" }}>
      {/* Left pinned table */}
      <table style={{ position: "sticky", left: 0, zIndex: 2 }}>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getLeftVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Center (unpinned) table */}
      <table style={{ flex: 1 }}>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getCenterVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Right pinned table */}
      <table style={{ position: "sticky", right: 0, zIndex: 2 }}>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getRightVisibleCells().map((cell) => (
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

**When to use split approach:**
- Complex cell styling that conflicts with sticky positioning
- Virtual scrolling with pinned columns
- Separate column groups need different scroll behaviors

---

## Column Pinning UI Control

```typescript
// Toggle column pin state
function ColumnPinToggle({ column }: { column: Column<User> }) {
  const isPinned = column.getIsPinned();

  return (
    <div>
      <button
        onClick={() => column.pin("left")}
        disabled={isPinned === "left"}
        aria-label={`Pin ${column.id} to left`}
      >
        Pin Left
      </button>
      <button
        onClick={() => column.pin("right")}
        disabled={isPinned === "right"}
        aria-label={`Pin ${column.id} to right`}
      >
        Pin Right
      </button>
      <button
        onClick={() => column.pin(false)}
        disabled={!isPinned}
        aria-label={`Unpin ${column.id}`}
      >
        Unpin
      </button>
    </div>
  );
}
```
