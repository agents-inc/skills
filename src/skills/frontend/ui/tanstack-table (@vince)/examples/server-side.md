# TanStack Table - Server-Side Data

> Server-side data examples. See [core.md](core.md) for basic table setup.

**Prerequisites**: Understand basic table setup and pagination patterns first.

---

## Server-Side Table with Combined Features

### Good Example - Full-featured server-side table

```typescript
import { useState, useMemo } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type {
  PaginationState,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type ApiResponse = {
  data: ApiUser[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
};

const columnHelper = createColumnHelper<ApiUser>();

const DEFAULT_PAGE_SIZE = 20;

export function ServerSideUserTable() {
  // Table state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Build query params from state
  const queryParams = useMemo(
    () => ({
      page: pagination.pageIndex + 1, // API is 1-indexed
      pageSize: pagination.pageSize,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? "desc" : "asc",
      ...Object.fromEntries(
        columnFilters.map((filter) => [filter.id, filter.value])
      ),
    }),
    [pagination, sorting, columnFilters]
  );

  // Use your data fetching solution here
  // Example: const { data, isLoading } = useQuery({ queryKey: ['users', queryParams], queryFn: ... })
  const { data, isLoading } = useFetchUsers(queryParams);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        enableSorting: true,
      }),
      columnHelper.accessor("role", {
        header: "Role",
        enableColumnFilter: true,
      }),
      columnHelper.accessor("createdAt", {
        header: "Created At",
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
        enableSorting: true,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: {
      pagination,
      sorting,
      columnFilters,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    // CRITICAL: Enable manual mode for server-side
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    // Provide total row count for pagination
    rowCount: data?.meta.total ?? 0,
    // Reset page when filters change
    autoResetPageIndex: false, // We handle this manually
  });

  // Reset to page 0 when filters change
  const handleFilterChange = (columnId: string, value: unknown) => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    table.getColumn(columnId)?.setFilterValue(value);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Filter controls */}
      <div>
        <select
          onChange={(e) => handleFilterChange("role", e.target.value || undefined)}
          defaultValue=""
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: header.column.getCanSort() ? "pointer" : "default",
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: " ↑",
                    desc: " ↓",
                  }[header.column.getIsSorted() as string] ?? null}
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

      {/* Pagination */}
      <div>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span>
          Page {pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

**Why good:** all manual options set for server-side, `rowCount` enables correct page count, query params memoized for stability, page reset on filter change, loading state handled

---

## Key Server-Side Options

```typescript
// CRITICAL: All three manual options for server-side
const table = useReactTable({
  data: apiData ?? [],
  columns,
  state: { pagination, sorting, columnFilters },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  // Disable client-side processing
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  // Required for correct page count
  rowCount: totalFromApi,
  // Don't auto-reset when data changes
  autoResetPageIndex: false,
});
```

---

## Query Param Patterns

```typescript
// Convert table state to API query params
const queryParams = useMemo(
  () => ({
    // Pagination (API often 1-indexed)
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    // Sorting
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
    // Filters
    ...Object.fromEntries(
      columnFilters.map((filter) => [filter.id, filter.value])
    ),
  }),
  [pagination, sorting, columnFilters]
);

// Use with React Query
const { data, isLoading } = useQuery({
  queryKey: ["users", queryParams],
  queryFn: () => fetchUsers(queryParams),
  keepPreviousData: true, // Prevent flicker during page changes
});
```
