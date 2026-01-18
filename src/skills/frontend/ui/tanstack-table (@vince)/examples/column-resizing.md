# TanStack Table - Column Resizing

> Column resizing examples. See [core.md](core.md) for basic table setup.

**Use when:** Users need to adjust column widths to fit their content or preferences.

---

## Performant Column Resizing with CSS Variables

### Good Example - 60fps resizing using CSS variables (Recommended)

The key to performant column resizing in React is using CSS variables instead of inline styles that trigger re-renders.

```typescript
import { useState, useMemo, useCallback } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnSizingState, ColumnResizeMode } from "@tanstack/react-table";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

const columnHelper = createColumnHelper<User>();

const DEFAULT_COLUMN_SIZE = 150;
const MIN_COLUMN_SIZE = 50;
const MAX_COLUMN_SIZE = 500;

export function ResizableTable({ data }: { data: User[] }) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "ID",
        size: DEFAULT_COLUMN_SIZE,
        minSize: MIN_COLUMN_SIZE,
        maxSize: MAX_COLUMN_SIZE,
      }),
      columnHelper.accessor("firstName", {
        header: "First Name",
        size: DEFAULT_COLUMN_SIZE,
        minSize: MIN_COLUMN_SIZE,
      }),
      columnHelper.accessor("lastName", {
        header: "Last Name",
        size: DEFAULT_COLUMN_SIZE,
        minSize: MIN_COLUMN_SIZE,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        size: 250,
        minSize: 100,
        maxSize: MAX_COLUMN_SIZE,
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange", // Live resize feedback
    enableColumnResizing: true,
  });

  // CRITICAL: Memoize CSS variables for performance
  // Only recalculate when sizing state changes
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: Record<string, number> = {};

    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }

    return colSizes;
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  return (
    <div style={{ overflow: "auto" }}>
      <table
        style={{
          ...columnSizeVars,
          width: table.getCenterTotalSize(),
          borderCollapse: "collapse",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: `calc(var(--header-${header.id}-size) * 1px)`,
                    position: "relative",
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}

                  {/* Resize handle */}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => header.column.resetSize()}
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        height: "100%",
                        width: "5px",
                        cursor: "col-resize",
                        userSelect: "none",
                        touchAction: "none",
                        background: header.column.getIsResizing()
                          ? "rgba(0, 0, 0, 0.5)"
                          : "transparent",
                      }}
                      aria-label={`Resize ${header.column.id} column`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <MemoizedTableBody table={table} />
      </table>
    </div>
  );
}

// CRITICAL: Memoize table body to prevent re-renders during resize
const MemoizedTableBody = React.memo(
  function TableBody<TData>({ table }: { table: Table<TData> }) {
    return (
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                style={{
                  width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  },
  (prev, next) => prev.table.options.data === next.table.options.data
);
```

**Why good:** CSS variables update without re-rendering, memoized table body prevents unnecessary renders, `columnResizeMode: "onChange"` provides live feedback, double-click resets column size, touch support included

---

## Basic Column Resizing (Simpler, Less Performant)

For smaller tables where performance isn't critical.

```typescript
export function SimpleResizableTable({ data }: { data: User[] }) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const table = useReactTable({
    data,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onEnd", // Only update when drag ends
    enableColumnResizing: true,
  });

  return (
    <table style={{ width: table.getCenterTotalSize() }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                style={{ width: header.getSize() }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}

                {/* Resize handle */}
                <div
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    height: "100%",
                    width: "4px",
                    cursor: "col-resize",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} style={{ width: cell.column.getSize() }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**When to use:** Smaller tables (< 100 rows), simpler setup needed, performance not critical

---

## Key Column Sizing Options

```typescript
import type { ColumnSizingState, ColumnResizeMode } from "@tanstack/react-table";

// State
const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
  firstName: 200, // Width in pixels
  email: 300,
});

// Table options
const table = useReactTable({
  state: { columnSizing },
  onColumnSizingChange: setColumnSizing,
  getCoreRowModel: getCoreRowModel(),
  enableColumnResizing: true,       // Enable resizing (default: true)
  columnResizeMode: "onChange",     // "onChange" | "onEnd"
  columnResizeDirection: "ltr",     // "ltr" | "rtl"
});

// Column definition options
columnHelper.accessor("field", {
  size: 150,        // Default size in pixels
  minSize: 50,      // Minimum resize limit
  maxSize: 500,     // Maximum resize limit
  enableResizing: true, // Allow this column to resize
});

// Column sizing utilities
header.getSize();           // Current header width
header.getResizeHandler();  // Drag handler for mouse/touch
header.column.getSize();    // Current column width
header.column.resetSize();  // Reset to default size
header.column.getIsResizing(); // Is currently being resized?
header.column.getCanResize();  // Can this column resize?

// Table sizing utilities
table.getCenterTotalSize(); // Total width of all columns
table.getState().columnSizing; // Current sizing state
table.getState().columnSizingInfo; // Resize in-progress info
```

---

## Column Resize Mode Comparison

| Mode | Behavior | Performance | Use Case |
|------|----------|-------------|----------|
| `"onChange"` | Updates width during drag | Requires optimization | Live resize feedback |
| `"onEnd"` | Updates width after drag ends | Better by default | Simple tables, less flicker |

---

## Performance Tips

1. **Use CSS variables** - Avoids inline style recalculations
2. **Memoize table body** - Prevents child re-renders during resize
3. **Use `columnResizeMode: "onEnd"`** - If live feedback not needed
4. **Limit column count** - Consider virtualization for 50+ columns
5. **Avoid complex cell renderers** - Keep cells simple during resize
