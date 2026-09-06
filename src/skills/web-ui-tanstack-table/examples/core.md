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
  // Memoized: a new array identity here restarts the table on every render
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

  // Memoized for the same reason — the prop is a new array on each parent render
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

**Why good:** the type parameter on `createColumnHelper` is what checks every accessor key against
`User` and types each `info.getValue()` from the field it reads, so renaming a field breaks the build
rather than producing a column of `undefined`. `flexRender` is needed because `header` here is
sometimes a string and `cell` sometimes a function — reading `columnDef.header` directly would render
the function itself for the `status` column.

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

**Why bad:** three separate failures. The unmemoised `columns` and the raw `users` prop are both new
identities on every render, so the table rebuilds and re-renders without settling — the symptom is an
unresponsive tab rather than an error. The `accessorFn` has no `id` to derive, which throws while the
instance is built. And with no type parameter, a mistyped accessor key compiles and produces an empty
column.

---

## Pattern 2: A Reusable Generic Table

One component, any row type. The generics are what keep `columns` and `data` checked against each
other at the call site instead of collapsing to `unknown`.

```typescript
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData) => string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
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
        {table.getRowModel().rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>No results.</td>
          </tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// The caller keeps ownership of memoisation, since it owns both inputs
const columns = useMemo(() => buildUserColumns(), []);
<DataTable columns={columns} data={users} getRowId={(user) => user.id} />;
```

**Why good:** the two type parameters travel together, so a `ColumnDef<User, string>[]` cannot be
handed a `Product[]`. Memoisation stays with the caller — a generic component cannot memoise inputs
it did not create, and doing it internally would only hide an unstable reference one level down.
`getRowId` is optional and passed through rather than assumed, because not every row type has an
`id`. The empty branch is here because an empty `<tbody>` renders as nothing at all, which reads as a
broken table rather than as no results.

---

> See [reference.md](../reference.md) for essential imports, checklists, and decision frameworks.
