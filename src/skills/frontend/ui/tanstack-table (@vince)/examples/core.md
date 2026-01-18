# TanStack Table Examples

> Complete code examples for TanStack Table patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [sorting.md](sorting.md) - Column sorting with custom sort functions
- [filtering.md](filtering.md) - Column and global filtering
- [pagination.md](pagination.md) - Client-side pagination
- [selection.md](selection.md) - Row selection with bulk actions
- [expanding.md](expanding.md) - Expandable rows with sub-content
- [column-visibility.md](column-visibility.md) - Column visibility toggles
- [column-pinning.md](column-pinning.md) - Sticky pinned columns (left/right)
- [column-resizing.md](column-resizing.md) - Performant column resizing with CSS variables
- [server-side.md](server-side.md) - Server-side data handling
- [virtualization.md](virtualization.md) - Virtual scrolling for large datasets

---

## Pattern 1: Basic Table Setup

### Good Example - Complete type-safe table setup

```typescript
// user-table.tsx
import { useMemo } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

// Type definition
type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "active" | "inactive";
  age: number;
};

// Create column helper with type
const columnHelper = createColumnHelper<User>();

export function UserTable({ users }: { users: User[] }) {
  // CRITICAL: Memoize columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("firstName", {
        header: "First Name",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("lastName", {
        header: "Last Name",
        cell: (info) => info.getValue(),
      }),
      // Computed column with accessorFn - MUST have id
      columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
        id: "fullName",
        header: "Full Name",
      }),
      columnHelper.accessor("email", {
        header: "Email",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <span data-status={info.getValue()}>
            {info.getValue() === "active" ? "Active" : "Inactive"}
          </span>
        ),
      }),
      columnHelper.accessor("age", {
        header: "Age",
        cell: (info) => info.getValue(),
      }),
    ],
    []
  );

  // CRITICAL: Memoize data
  const data = useMemo(() => users, [users]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Use database ID for stable row keys
    getRowId: (row) => row.id,
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
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
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
  );
}
```

**Why good:** `createColumnHelper<User>()` provides type inference for accessors, memoized columns and data prevent infinite re-renders, `getRowId` uses database ID for stable keys, `flexRender` handles both string and component headers/cells

### Bad Example - Missing memoization and type safety

```typescript
// WRONG: No type safety, no memoization
export function BadTable({ users }) {
  // BAD: Columns recreated every render
  const columns = [
    {
      accessorKey: "firstName",
      header: "First Name",
    },
    // BAD: accessorFn without id
    {
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      header: "Full Name",
    },
  ];

  const table = useReactTable({
    data: users, // BAD: Unstable reference
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ... rest of component
}
```

**Why bad:** missing `useMemo` on columns causes re-renders on every state change, `accessorFn` without `id` causes runtime errors, no TypeScript types means accessor typos won't be caught, unstable data reference causes infinite re-render loops

---

## Quick Reference

### Essential Imports

```typescript
// Core
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

// Features (import as needed)
import {
  getSortedRowModel,      // For sorting
  getFilteredRowModel,    // For filtering
  getPaginationRowModel,  // For pagination
  getExpandedRowModel,    // For expanding rows
} from "@tanstack/react-table";

// Types (import as needed)
import type {
  SortingState,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  VisibilityState,
  ExpandedState,
} from "@tanstack/react-table";
```

### Critical Rules

1. **Always memoize columns and data** - Prevents infinite re-render loops
2. **Use `createColumnHelper<T>()`** - Provides type inference
3. **Use `getRowId`** - Ensures stable row keys from database IDs
4. **Add `id` to computed columns** - Required for `accessorFn` columns
5. **Import row models** - Each feature needs its corresponding row model
