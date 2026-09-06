---
name: web-ui-tanstack-table
description: TanStack Table v8 patterns - useReactTable, column definitions, sorting, filtering, pagination, row selection, virtual scrolling, server-side data
---

# TanStack Table Patterns

> **Quick Guide:** TanStack Table v8 is table _logic_ — it computes rows, cells and header groups and
> renders nothing at all. You describe the data with `createColumnHelper<T>()`, opt into each feature
> by importing its row model, and render whatever markup you like from what the instance returns. Two
> facts cause most of the trouble: `data` and `columns` must be stable references or the table
> recomputes forever, and the `manual*` flags are what tell it the server has already done the work.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — instance setup, column definitions, `flexRender`
- [examples/sorting.md](examples/sorting.md) — sort functions, multi-sort, `aria-sort`
- [examples/filtering.md](examples/filtering.md) — column filters, global filter, custom `filterFn`
- [examples/pagination.md](examples/pagination.md) — page state and navigation controls
- [examples/selection.md](examples/selection.md) — checkbox column, indeterminate state, bulk actions
- [examples/expanding.md](examples/expanding.md) — expandable rows and sub-rows
- [examples/column-visibility.md](examples/column-visibility.md) — show and hide columns
- [examples/column-pinning.md](examples/column-pinning.md) — pinned columns and their sticky offsets
- [examples/column-resizing.md](examples/column-resizing.md) — resize handles and the CSS-variable technique
- [examples/server-side.md](examples/server-side.md) — the `manual*` flags and `rowCount`
- [examples/virtualization.md](examples/virtualization.md) — bridging the row model to a windowed list
- [reference.md](reference.md) — imports, per-feature checklists, anti-patterns with code

---

## Which path applies

**Where the sorting, filtering and paging happen is the fork that changes every other answer.**

- **The client holds every row.** Import the row models for the features you want —
  `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` — and the table does the work.
  Follow [examples/core.md](examples/core.md) and the per-feature files.
- **The server already did the work.** Set `manualSorting`, `manualFiltering` and `manualPagination`
  to `true`, supply `rowCount`, and import none of those row models — with a `manual*` flag set, the
  matching row model is ignored, so shipping both is dead weight that reads as a working feature.
  Follow [examples/server-side.md](examples/server-side.md).
- **Every row is present but too many to render.** Keep client-side row models and window the output
  rather than paging it. Follow [examples/virtualization.md](examples/virtualization.md).

---

<critical_requirements>

## Before writing TanStack Table code

**Give `data` and `columns` stable references** — `useMemo`, or a module-level constant. The table
compares by identity, so a fresh array each render is a fresh set of columns each render, and the
resulting update loop presents as a hung tab rather than as an error.

**Type the column helper: `createColumnHelper<Row>()`.** Every accessor key is then checked against
the row type and each cell's `getValue()` is typed from the field it reads, which is what turns a
renamed field into a compile error instead of a column of `undefined`.

**Give `accessorFn` an explicit `id`.** A string `accessorKey` supplies its own id; a function has no
name to derive one from, and the column cannot be addressed for sorting, filtering or visibility
without it.

**Set `getRowId` wherever rows are selected or the data reloads.** The default identity is the array
index, so a sort, a filter or a refetch silently moves the selection to whichever rows now occupy
those positions.

**Import only the row models you use.** Each is a separate entry point and the ones you leave out are
tree-shaken, which is the whole reason the features are packaged this way.

**Render through `flexRender`.** `header` and `cell` may each be a string or a component, and
`flexRender` is what handles both — reading `columnDef.header` directly works until the first column
that supplies a function.

</critical_requirements>

---

**Auto-detection:** @tanstack/react-table, useReactTable, createColumnHelper, columnHelper.accessor,
columnHelper.display, columnHelper.group, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
getPaginationRowModel, getExpandedRowModel, flexRender, ColumnDef, SortingState, ColumnFiltersState,
PaginationState, RowSelectionState, VisibilityState, ExpandedState, ColumnPinningState,
manualPagination, manualSorting, accessorKey, accessorFn, getRowId

**Applies to:**

- Modelling columns — accessors, computed values, display columns, grouped headers
- Table state: sorting, filtering, pagination, selection, expansion, visibility, pinning, sizing
- Choosing between client-side and server-side operation, and wiring the second
- Reading the instance to render: header groups, visible cells, row models
- Keeping a large table responsive — memoisation, tree-shaking, windowing the row output

**Handled elsewhere:**

- Every element and every style. This library returns data structures; the `<table>` in the examples
  is one way to render them, and the appearance of the result is not this skill's concern
- Where the rows came from. Server-side mode consumes an already-paginated array and a total count,
  by whatever means they arrived
- The controls used as filter and pagination inputs — the table needs a value and a change handler,
  and nothing about the widget that produces them
- Windowing itself. The table hands over a flat array of rows; measuring a viewport and rendering the
  slice that fits is a separate capability, and
  [examples/virtualization.md](examples/virtualization.md) shows only the bridge between the two

---

<philosophy>

Headless means the library has no opinion you have to argue with. There is no theme to override, no
markup to fight, and no component whose internals you need to reach into — the instance answers
questions and you decide what to draw.

The cost of that is that **nothing is on by default.** A table that does not sort is not broken; it
simply never imported `getSortedRowModel`. This trips people coming from a components library, where
features are props to switch on, and it is worth holding onto: when a feature does nothing, the first
question is whether its row model is present, and the second is whether a `manual*` flag has told the
table not to bother.

The same design makes the library framework-agnostic — the core is plain TypeScript and the React
adapter is thin — which is why the API reads as functions returning data rather than as hooks doing
things.

</philosophy>

---

<decision_framework>

## Which row model to import

| Feature                        | Row model               | Notes                               |
| ------------------------------ | ----------------------- | ----------------------------------- |
| Anything at all                | `getCoreRowModel`       | Always required                     |
| Sorting                        | `getSortedRowModel`     | Omit when `manualSorting` is set    |
| Column and global filtering    | `getFilteredRowModel`   | Omit when `manualFiltering` is set  |
| Paging                         | `getPaginationRowModel` | Omit when `manualPagination` is set |
| Expandable rows, sub-rows      | `getExpandedRowModel`   |                                     |
| Row grouping                   | `getGroupedRowModel`    |                                     |
| Distinct values for filter UIs | `getFacetedRowModel`    |                                     |
| Column pinning, column sizing  | none                    | Both are part of core               |

## How to declare a column

```
Reading a field directly?          → columnHelper.accessor("email")
Reading a nested field?            → columnHelper.accessor("address.city")   (dot notation)
Deriving a value from the row?     → columnHelper.accessor(fn, { id: "…" })  (id is required)
No data at all — buttons, a checkbox?
                                   → columnHelper.display({ id: "…" })
Heading a set of other columns?    → columnHelper.group({ columns: [...] })
```

The distinction that matters: an accessor's return value is what sorting and filtering operate on, so
it stays a primitive. Anything visual belongs in `cell`.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Table setup

The instance is built from data, columns and the row models you opted into. Both inputs are memoised;
`getRowId` replaces index-based identity with something stable.

```typescript
const columnHelper = createColumnHelper<User>();

const columns = useMemo(
  () => [
    columnHelper.accessor("firstName", { header: "First Name" }),
    columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: "fullName", // required — a function has no key to derive one from
      header: "Full Name",
    }),
  ],
  [],
);

const table = useReactTable({
  data: useMemo(() => users, [users]),
  columns,
  getCoreRowModel: getCoreRowModel(),
  getRowId: (row) => row.id,
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Sorting

Lift the state to make it persistable; the row model does the ordering.

```typescript
const [sorting, setSorting] = useState<SortingState>([]);

const table = useReactTable({
  /* … */
  state: { sorting },
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
});

columnHelper.accessor("createdAt", { sortingFn: "datetime" });
```

`Date` objects need `sortingFn: "datetime"` — the default comparator treats them as strings, which
orders by the day name.

Full code: [examples/sorting.md](examples/sorting.md)

### Pattern 3: Filtering

Column filters and the global filter are separate state with separate handlers, both served by one
row model.

```typescript
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [globalFilter, setGlobalFilter] = useState("");

const table = useReactTable({
  /* … */
  state: { columnFilters, globalFilter },
  onColumnFiltersChange: setColumnFilters,
  onGlobalFilterChange: setGlobalFilter,
  getFilteredRowModel: getFilteredRowModel(),
});
```

Multiple column filters intersect — a row must satisfy all of them. There is no built-in union; the
global filter, or a custom `filterFn`, is how you get one.

Full code: [examples/filtering.md](examples/filtering.md)

### Pattern 4: Pagination

```typescript
const [pagination, setPagination] = useState<PaginationState>({
  pageIndex: 0,
  pageSize: 10,
});

const table = useReactTable({
  /* … */
  state: { pagination },
  onPaginationChange: setPagination,
  getPaginationRowModel: getPaginationRowModel(),
});
```

`pageIndex` counts from zero. Most APIs count from one, so the conversion belongs at the request
boundary and nowhere else.

Full code: [examples/pagination.md](examples/pagination.md)

### Pattern 5: Row selection

```typescript
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

const table = useReactTable({
  /* … */
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true,
  getRowId: (row) => row.id, // the selection is keyed by this
});
```

The selection is a map keyed by row id, so without `getRowId` it is keyed by array position — and
sorting the table then reassigns every selection to a different record.

Full code: [examples/selection.md](examples/selection.md)

### Pattern 6: Server-side data

The `manual*` flags tell the table that the array it was handed is already sorted, filtered and
paged. It then reports state changes and computes nothing.

```typescript
const table = useReactTable({
  data: apiData ?? [],
  columns,
  state: { pagination, sorting, columnFilters },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  rowCount: totalFromApi, // it cannot count rows it never received
});
```

Full code: [examples/server-side.md](examples/server-side.md)

### Pattern 7: Column visibility

```typescript
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
  email: false, // hidden until asked for
});

columnHelper.accessor("id", { enableHiding: false }); // never offered in the toggle UI
```

Hidden columns leave `getVisibleCells()` but stay in the table, so their filters and sorts still
apply.

Full code: [examples/column-visibility.md](examples/column-visibility.md)

### Pattern 8: Expanding rows

```typescript
const [expanded, setExpanded] = useState<ExpandedState>({});

const table = useReactTable({
  /* … */
  state: { expanded },
  onExpandedChange: setExpanded,
  getExpandedRowModel: getExpandedRowModel(),
  getRowCanExpand: () => true, // or a predicate over row.original
});
```

Expanded rows are interleaved into the row model rather than nested, so rendering a detail panel
means checking `row.getIsExpanded()` and emitting an extra element yourself.

Full code: [examples/expanding.md](examples/expanding.md)

### Pattern 9: A reusable generic table

Generics let one component serve every row type without losing inference at the call site.

```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  // render from table.getHeaderGroups() and table.getRowModel()
}
```

Full code: [examples/core.md](examples/core.md)

### Pattern 10: Column pinning

```typescript
const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
  left: ["id"],
  right: ["actions"],
});
```

Pinning reorders the columns and reports which side each one is on. It applies no positioning — the
`position: sticky`, the offset and an opaque background are yours, and the background is what stops
scrolling content showing through.

Full code: [examples/column-pinning.md](examples/column-pinning.md)

### Pattern 11: Column resizing

```typescript
const table = useReactTable({
  /* … */
  enableColumnResizing: true,
  columnResizeMode: "onChange", // or "onEnd"
});
```

`"onChange"` updates during the drag and re-renders every cell with it, so it needs the CSS-variable
technique and a memoised body to hold a frame rate. `"onEnd"` commits on release and needs neither.

Full code: [examples/column-resizing.md](examples/column-resizing.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `columns` or `data` built inline — a new array identity every render, and the table updates in a
  loop until the tab stops responding
- `accessorFn` without `id` — the column has no identifier, and the instance throws while building
- A client-side row model alongside its `manual*` flag — the flag wins, so the row model is inert
  while looking like the feature is wired
- `manualPagination` without `rowCount` or `pageCount` — the table cannot derive a page count from a
  single page, so navigation stops at page one
- Selection without `getRowId` — keyed by array index, so sorting or refetching moves the selection
  to different records
- JSX returned from an accessor — sorting and filtering then compare React elements instead of
  values, and the column orders by nothing meaningful
- Reading `columnDef.header` or `columnDef.cell` directly instead of through `flexRender` — works for
  string headers, renders a raw function for every other column

**Surprising behaviour:**

- `pageIndex` is zero-based, where most APIs are one-based
- `autoResetPageIndex` defaults to `true`, so any data change jumps back to page one — usually wrong
  in server-side mode, where new data arriving _is_ the page change
- Column filters combine with AND; there is no built-in OR
- Column pinning and column sizing need no row model, unlike every other feature
- Pinning happens before column ordering and grouping, so it wins where they disagree
- A resize handle needs `onMouseDown` _and_ `onTouchStart` from `getResizeHandler()`, or it is
  inert on touch devices
- Hidden columns still filter and sort; visibility affects `getVisibleCells()` and nothing upstream

</red_flags>
