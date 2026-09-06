# TanStack Table Reference

> Imports, per-feature checklists and anti-patterns with code. See [SKILL.md](SKILL.md) for the
> decisions and red flags, [examples/](examples/) for full implementations. Targets v8.

---

## Implementation Choices

### Rendering pinned columns

| Layout                                  | Approach                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A few pinned columns, one scroll area   | `getIsPinned()` plus `position: sticky` and a computed offset on each pinned cell                  |
| Independent scrolling or complex sizing | Three tables, from `getLeftVisibleCells()`, `getCenterVisibleCells()` and `getRightVisibleCells()` |

### Resize mode

| Mode         | Cost                                                                   | Use when                              |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------- |
| `"onEnd"`    | One re-render, on release                                              | The default choice                    |
| `"onChange"` | A re-render per pointer move — needs CSS variables and a memoised body | Live width feedback is worth the work |

---

## Anti-Patterns

### Column definitions built inline

```typescript
// WRONG — a new array identity on every render, so the table rebuilds forever
function BadTable({ data }) {
  const table = useReactTable({
    data,
    columns: [{ accessorKey: "name", header: "Name" }],
    getCoreRowModel: getCoreRowModel(),
  });
}

// CORRECT — stable identities for both inputs
function GoodTable({ data }) {
  const columns = useMemo(() => [{ accessorKey: "name", header: "Name" }], []);

  const table = useReactTable({
    data: useMemo(() => data, [data]),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
}
```

### JSX returned from an accessor

The accessor's value is what sorting and filtering compare. Rendering belongs in `cell`.

```typescript
// WRONG — sorting now compares React elements
{
  accessorFn: (row) => <span>{row.status}</span>,
  id: "status",
}

// CORRECT — a primitive to sort by, markup to display
{
  accessorKey: "status",
  cell: (info) => <span data-status={info.getValue()}>{info.getValue()}</span>,
}
```

### Client-side row models alongside `manual*` flags

```typescript
// WRONG — manualPagination disables getPaginationRowModel, so the import
// is dead weight that reads as a working feature
const table = useReactTable({
  data: serverData,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  manualPagination: true,
});

// CORRECT
const table = useReactTable({
  data: serverData,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  rowCount: totalFromServer,
});
```

### Selection without a stable row id

```typescript
// WRONG — the selection map is keyed by array index, so sorting the table
// reassigns every selection to whichever record now sits in that position
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
});

// CORRECT
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
  getRowId: (row) => row.id,
});
```

### State left internal

Internal state cannot be read, so it cannot be persisted, put in the URL, or sent to a server.

```typescript
// WRONG — the sort exists but nothing outside the table can see it
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

// CORRECT
const [sorting, setSorting] = useState<SortingState>([]);

const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

---

## Imports

```typescript
// Always
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";

// Per feature — import only what is used; the rest tree-shakes out
import {
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
} from "@tanstack/react-table";

// Types
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  VisibilityState,
  ExpandedState,
  ColumnPinningState,
  ColumnSizingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
```

---

## Checklists

### Any table

- [ ] `data` and `columns` memoised, or defined outside the component
- [ ] `getCoreRowModel()` supplied
- [ ] `createColumnHelper<Row>()` given its type parameter
- [ ] `getRowId` set wherever rows are selected or the data reloads
- [ ] Cells and headers rendered through `flexRender`

### Server-side

- [ ] `manualPagination`, and `manualSorting` / `manualFiltering` for whatever the server handles
- [ ] `rowCount` or `pageCount` supplied
- [ ] No client-side row models beyond `getCoreRowModel`
- [ ] State lifted, so it can be turned into query parameters
- [ ] `autoResetPageIndex: false`, so arriving data does not reset the page

### Sorting

- [ ] `getSortedRowModel()` imported
- [ ] `sortingFn: "datetime"` on every `Date` column
- [ ] `enableSorting: false` on columns that should not sort
- [ ] Header click goes through `getToggleSortingHandler()`
- [ ] `aria-sort` reflects `getIsSorted()`, and a visible indicator matches it

### Filtering

- [ ] `getFilteredRowModel()` imported
- [ ] A custom `filterFn` wherever the built-ins do not fit
- [ ] `enableColumnFilter: false` on columns that should not filter
- [ ] Page index reset when a filter changes

### Pagination

- [ ] `getPaginationRowModel()` imported
- [ ] Navigation buttons disabled from `getCanPreviousPage()` / `getCanNextPage()`
- [ ] Page-size control calls `setPageSize()`

### Selection

- [ ] `enableRowSelection: true`
- [ ] `getRowId` supplies stable ids
- [ ] Checkbox column declared with `columnHelper.display()`
- [ ] Select-all shows indeterminate from `getIsSomeRowsSelected()`

### Pinning

- [ ] `position: sticky` and a computed offset on each pinned cell
- [ ] An opaque background on pinned cells, or content scrolls through them
- [ ] `enablePinning: false` on columns that should not pin

### Resizing

- [ ] `enableColumnResizing: true` and a `columnResizeMode` chosen
- [ ] Handle wired to `getResizeHandler()` on both `onMouseDown` and `onTouchStart`
- [ ] `size`, `minSize`, `maxSize` set on resizable columns
- [ ] Widths delivered as CSS variables, and the body memoised, under `"onChange"`
- [ ] The handle shows it is active, from `getIsResizing()`
- [ ] Double-click calls `resetSize()`

### Accessibility

- [ ] `aria-sort` on sortable headers
- [ ] `aria-label` on every icon-only control — sort, expand, resize, pagination
- [ ] `aria-expanded` on expander controls
- [ ] `aria-label` on selection checkboxes, naming the row
- [ ] Row count announced through `aria-live` where rows are windowed

---

## Performance

**Memoise** `columns` and `data` always, and any derived subset you pass in. The table instance itself
does not need memoising.

**Windowing** becomes worth its complexity somewhere past a thousand rows, and is hard to avoid past
ten thousand. It reduces DOM nodes rather than render work, so a slow cell renderer stays slow.

**Bundle** — import row models individually and use `import type` for types, both of which the
package is structured to reward.
