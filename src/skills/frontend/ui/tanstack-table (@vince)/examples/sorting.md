# TanStack Table - Sorting

> Sorting examples. See [core.md](core.md) for basic table setup.

---

## Sortable Table with Custom Sort Functions

### Good Example - Sortable table with multiple column types

```typescript
import { useState, useMemo } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { SortingState } from "@tanstack/react-table";

type Product = {
  id: string;
  name: string;
  price: number;
  createdAt: Date;
  rating: number;
};

const columnHelper = createColumnHelper<Product>();

export function SortableProductTable({ products }: { products: Product[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        // Default alphanumeric sorting
      }),
      columnHelper.accessor("price", {
        header: "Price",
        cell: (info) => `$${info.getValue().toFixed(2)}`,
        // Numbers sort correctly by default
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => info.getValue().toLocaleDateString(),
        // Use datetime sort for Date objects
        sortingFn: "datetime",
      }),
      columnHelper.accessor("rating", {
        header: "Rating",
        // Invert sorting: highest rating first on "ascending"
        invertSorting: true,
        sortDescFirst: true,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: products,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Multi-column sort (hold Shift + click)
    enableMultiSort: true,
    maxMultiSortColCount: 3,
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              const sorted = header.column.getIsSorted();

              return (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: canSort ? "pointer" : "default",
                    userSelect: canSort ? "none" : "auto",
                  }}
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                      ? "descending"
                      : "none"
                  }
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Sort indicator */}
                  {sorted && (
                    <span aria-hidden="true">
                      {sorted === "asc" ? " ↑" : " ↓"}
                    </span>
                  )}
                </th>
              );
            })}
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

**Why good:** controlled sorting state for persistence, `sortingFn: "datetime"` for Date objects, `invertSorting` for ratings (higher is better), `aria-sort` for accessibility, multi-sort with limit

---

## Key Sorting Options

```typescript
// Column definition options
columnHelper.accessor("field", {
  enableSorting: true,       // Default: true
  sortingFn: "datetime",     // Built-in: "alphanumeric", "datetime", "basic"
  invertSorting: true,       // Flip asc/desc meaning
  sortDescFirst: true,       // Start with descending
});

// Table options
const table = useReactTable({
  state: { sorting },
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
  enableMultiSort: true,          // Shift+click for multi-column
  maxMultiSortColCount: 3,        // Limit multi-sort columns
  enableSortingRemoval: true,     // Allow unsorted state
});

// Sorting utilities
header.column.getCanSort();           // Is column sortable?
header.column.getIsSorted();          // "asc" | "desc" | false
header.column.getToggleSortingHandler(); // Click handler
```
