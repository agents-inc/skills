# TanStack Table - Column Visibility

> Column visibility examples. See [core.md](core.md) for basic table setup.

---

## Column Visibility Toggle Dropdown

### Good Example - Dropdown to show/hide columns with persistence

```typescript
import { useState, useMemo, useEffect } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { VisibilityState } from "@tanstack/react-table";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

const columnHelper = createColumnHelper<User>();

export function TableWithColumnToggle({ data }: { data: User[] }) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "ID",
        enableHiding: false, // Always visible
      }),
      columnHelper.accessor("firstName", { header: "First Name" }),
      columnHelper.accessor("lastName", { header: "Last Name" }),
      columnHelper.accessor("email", { header: "Email" }),
      columnHelper.accessor("phone", { header: "Phone" }),
      columnHelper.accessor("address", { header: "Address" }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      {/* Column visibility dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowColumnMenu(!showColumnMenu)}
          aria-expanded={showColumnMenu}
          aria-haspopup="true"
        >
          Columns
        </button>
        {showColumnMenu && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 10,
            }}
          >
            {table.getAllLeafColumns().map((column) => (
              <label key={column.id} role="menuitemcheckbox">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={column.getToggleVisibilityHandler()}
                  disabled={!column.getCanHide()}
                />
                {typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id}
              </label>
            ))}
          </div>
        )}
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
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

**Why good:** `enableHiding: false` for required columns, `getCanHide()` to disable toggle, dropdown menu with proper ARIA roles, `getVisibleCells()` respects visibility state

---

## Persisting Column Visibility

```typescript
const STORAGE_KEY = "user-table-columns";

// Load from localStorage on mount
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
  () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }
);

// Save to localStorage on change
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
}, [columnVisibility]);
```

---

## Key Visibility Options

```typescript
// Column definition
columnHelper.accessor("id", {
  enableHiding: false, // Prevent hiding this column
});

// Table options
const table = useReactTable({
  state: { columnVisibility },
  onColumnVisibilityChange: setColumnVisibility,
});

// Visibility utilities
column.getIsVisible();             // Is column visible?
column.getCanHide();               // Can column be hidden?
column.getToggleVisibilityHandler(); // Toggle function
table.getAllLeafColumns();         // All columns for toggle UI
row.getVisibleCells();             // Only visible cells
table.setColumnVisibility({});     // Reset all to visible
```
