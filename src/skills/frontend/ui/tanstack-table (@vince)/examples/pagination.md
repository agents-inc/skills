# TanStack Table - Pagination

> Pagination examples. See [core.md](core.md) for basic table setup.

---

## Client-Side Pagination

### Good Example - Pagination with page size selector

```typescript
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { PaginationState, ColumnDef } from "@tanstack/react-table";

const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function PaginatedTable<T extends object>({
  data,
  columns,
}: {
  data: T[];
  columns: ColumnDef<T>[];
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: DEFAULT_PAGE_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  return (
    <div>
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

      {/* Pagination controls */}
      <nav aria-label="Table pagination">
        <div>
          <button
            onClick={() => table.firstPage()}
            disabled={!canPreviousPage}
            aria-label="Go to first page"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!canPreviousPage}
            aria-label="Go to previous page"
          >
            Previous
          </button>

          <span>
            Page{" "}
            <strong>
              {pageIndex + 1} of {pageCount}
            </strong>
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!canNextPage}
            aria-label="Go to next page"
          >
            Next
          </button>
          <button
            onClick={() => table.lastPage()}
            disabled={!canNextPage}
            aria-label="Go to last page"
          >
            Last
          </button>
        </div>

        <div>
          <label htmlFor="page-size">Rows per page:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span>
            Showing {pageIndex * pageSize + 1} to{" "}
            {Math.min((pageIndex + 1) * pageSize, data.length)} of {data.length}{" "}
            entries
          </span>
        </div>
      </nav>
    </div>
  );
}
```

**Why good:** named constants for defaults, aria-labels for accessibility, disabled states prevent invalid navigation, shows entry count for context

---

## Key Pagination Options

```typescript
// Table options
const table = useReactTable({
  state: { pagination },
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  // For server-side pagination:
  manualPagination: true,
  rowCount: totalFromApi,
});

// Pagination utilities
table.getCanPreviousPage();    // Can go back?
table.getCanNextPage();        // Can go forward?
table.getPageCount();          // Total pages
table.firstPage();             // Go to first
table.previousPage();          // Go back
table.nextPage();              // Go forward
table.lastPage();              // Go to last
table.setPageIndex(n);         // Go to specific page
table.setPageSize(n);          // Change page size
```
