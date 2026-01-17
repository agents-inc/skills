# TanStack Table - Virtual Scrolling

> Virtual scrolling examples. See [core.md](core.md) for basic table setup.

**Use when:** Rendering 1000+ rows where pagination is not suitable.

---

## Virtualized Table with @tanstack/react-virtual

### Good Example - Efficient rendering of large datasets

```typescript
import { useMemo, useRef } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type DataRow = {
  id: string;
  name: string;
  value: number;
};

const columnHelper = createColumnHelper<DataRow>();

const ROW_HEIGHT = 35;
const TABLE_HEIGHT = 400;
const OVERSCAN_COUNT = 5;

export function VirtualizedTable({ data }: { data: DataRow[] }) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: "ID" }),
      columnHelper.accessor("name", { header: "Name" }),
      columnHelper.accessor("value", { header: "Value" }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calculate padding for virtual scroll
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div
      ref={tableContainerRef}
      style={{
        height: `${TABLE_HEIGHT}px`,
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%" }}>
        <thead style={{ position: "sticky", top: 0 }}>
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
          {/* Top padding row */}
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}

          {/* Virtual rows */}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr key={row.id} style={{ height: `${ROW_HEIGHT}px` }}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Bottom padding row */}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>

      {/* Accessibility: announce row count */}
      <div aria-live="polite" style={{ position: "absolute", left: "-9999px" }}>
        Table has {rows.length} rows
      </div>
    </div>
  );
}
```

**Why good:** `@tanstack/react-virtual` for efficient rendering, overscan prevents blank spaces during scroll, padding rows maintain scroll position, sticky header for context, accessibility announcement for row count

---

## When to Use Virtual Scrolling

| Row Count | Recommendation |
|-----------|----------------|
| < 100 | Standard table |
| 100-500 | Consider pagination |
| 500-1000 | Pagination or virtualization |
| 1000+ | **Use virtualization** |

---

## Key Virtualization Options

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: rows.length,           // Total row count
  getScrollElement: () => ref,  // Scroll container ref
  estimateSize: () => ROW_HEIGHT, // Row height estimate (constant for best perf)
  overscan: 5,                  // Extra rows to render above/below viewport
});

// Virtualizer utilities
const virtualRows = rowVirtualizer.getVirtualItems(); // Currently visible items
const totalSize = rowVirtualizer.getTotalSize();      // Total height for scrollbar
rowVirtualizer.scrollToIndex(index);                  // Scroll to specific row
```

---

## Performance Tips

1. **Use constant row height** - `estimateSize` should return a fixed value for best performance
2. **Set appropriate overscan** - 5-10 is usually good; prevents flicker during fast scroll
3. **Memoize columns and data** - Same as regular tables
4. **Use sticky header** - Keep context visible during scroll
5. **Avoid complex cell renderers** - Virtualization helps with DOM count, not render time
