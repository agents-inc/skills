# TanStack Table - Virtual Scrolling

> Windowing the row output. See [core.md](core.md) for basic table setup.

**Use when:** the client holds every row, there are too many to render, and paging is not wanted.

**What this file teaches is the bridge, not the windowing.** The table produces a flat array from
`table.getRowModel().rows`; a windowing library produces a list of indices that are currently on
screen. The whole integration is `rows[virtualRow.index]`, plus padding rows that reserve the height
of what is not rendered. Any windowing library exposing a count, a scroll element, an estimated size
and a list of visible items substitutes into the same three points — the one used below is the
companion package to this table library and is shown because it needs no adapter.

---

## Bridging the Row Model to a Windowed List

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

**Why good:** the padding rows are what make the scrollbar honest — without them the container is
only as tall as the handful of rendered rows, and the scroll position means nothing. `overscan`
renders a few rows beyond the viewport so a fast scroll shows content rather than blank space. The
header sits outside the virtualised body and stays put. `aria-live` announces the true row count,
which a screen reader cannot otherwise learn from a DOM holding twenty of ten thousand rows.

---

## Choosing Between Windowing and Paging

Both stop the browser rendering ten thousand rows; they differ in what the user gets. Paging gives an
addressable position and a finite page to scan. Windowing gives an unbroken list, working browser
find-in-page over the rendered slice only, and no page state to keep in the URL. Below roughly a
thousand rows neither is needed; above it, the question is whether the list is something to browse or
something to look through.

---

## Tuning

**Keep `estimateSize` constant** where the rows really are a fixed height. A varying estimate forces
remeasurement, and the scroll position drifts as the total is revised.

**`overscan` of five to ten** is the usual range. Too low and fast scrolling shows blank bands; too
high and the saving shrinks.

**Windowing reduces DOM nodes, not render time.** A cell renderer that is slow for twenty rows is
still slow for twenty rows — it is just no longer slow for ten thousand.

Memoising `columns` and `data` matters exactly as much as it does for any other table.
