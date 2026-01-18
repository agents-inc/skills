# TanStack Table Reference

> Decision frameworks, anti-patterns, and red flags for TanStack Table development. See [SKILL.md](SKILL.md) for core concepts and [examples.md](examples.md) for code examples.

**Version:** TanStack Table v8.21.3 (latest as of April 2025)

---

## Decision Framework

### When to Use TanStack Table

```
Do you need a data table?
├─ NO → Use plain HTML table or list
└─ YES → Do you need interactive features (sort/filter/paginate)?
    ├─ NO → Use plain HTML table (simpler)
    └─ YES → Do you need full control over styling?
        ├─ YES → TanStack Table (headless)
        └─ NO → Consider Material React Table or similar pre-styled libraries
```

### Client-Side vs Server-Side

```
How much data do you have?
├─ < 10,000 rows → Client-side is likely fine
│   └─ Use getSortedRowModel, getFilteredRowModel, getPaginationRowModel
└─ > 10,000 rows → Consider server-side OR virtualization
    ├─ Is data relatively static?
    │   └─ YES → Virtualization with @tanstack/react-virtual
    └─ Does data change frequently / need fresh from server?
        └─ YES → Server-side with manualPagination/Sorting/Filtering
```

### Which Row Model to Import

```
What features do you need?
├─ getCoreRowModel → ALWAYS (required base)
├─ getSortedRowModel → Column sorting (client-side)
├─ getFilteredRowModel → Column/global filtering (client-side)
├─ getPaginationRowModel → Page navigation (client-side)
├─ getExpandedRowModel → Expandable rows / sub-rows
├─ getGroupedRowModel → Row grouping
└─ getFacetedRowModel → Faceted filtering (distinct values)

Note: Column pinning and column sizing are part of core - no extra row model needed
```

### Column Pinning vs Split Tables

```
Do you need pinned columns?
├─ NO → Standard rendering
└─ YES → How complex is your layout?
    ├─ Simple → Sticky CSS approach (getIsPinned + position: sticky)
    └─ Complex → Split table approach (getLeftVisibleCells, getCenterVisibleCells, getRightVisibleCells)
```

### Column Resize Mode

```
Do users need to resize columns?
├─ NO → Don't enable (smaller bundle)
└─ YES → What kind of feedback?
    ├─ Live resize → columnResizeMode: "onChange" (requires CSS variables + memoization)
    └─ Resize on release → columnResizeMode: "onEnd" (simpler, more performant)
```

### accessorKey vs accessorFn

```
How do you access the data?
├─ Direct property access (row.firstName)
│   └─ Use accessorKey: "firstName"
├─ Nested property (row.address.city)
│   └─ Use accessorKey: "address.city" (dot notation)
└─ Computed value (firstName + lastName)
    └─ Use accessorFn with explicit id
        └─ accessorFn: (row) => `${row.firstName} ${row.lastName}`, id: "fullName"
```

### Column Definition Type

```
What kind of column is it?
├─ Data column (displays/sorts/filters by data)
│   └─ Use columnHelper.accessor()
├─ Actions column (buttons, no data)
│   └─ Use columnHelper.display() with id
└─ Grouping header (groups other columns)
    └─ Use columnHelper.group()
```

---

## RED FLAGS

### High Priority Issues

- **Missing useMemo on columns** - Columns defined inline without memoization cause infinite re-renders. Columns must be memoized or defined outside the component.

- **Missing useMemo on data** - Passing an unstable data reference causes the table to re-render infinitely. Memoize data or define outside the component.

- **accessorFn without id** - Using `accessorFn` without providing an `id` causes runtime errors. Every accessor function MUST have an explicit id.

- **Missing manualPagination for server-side** - Forgetting to set `manualPagination: true` when using server-side pagination causes the table to try paginating already-paginated data.

- **Returning JSX from accessorFn** - Accessors should return primitive values for sorting/filtering. Use the `cell` option for JSX rendering.

### Medium Priority Issues

- **Not providing rowCount for server-side** - Without `rowCount` or `pageCount`, the table cannot calculate the correct number of pages.

- **Missing getRowId** - Without a custom `getRowId`, row selection uses array indices which break when data is re-ordered or filtered.

- **Importing unused row models** - Importing row models you don't use increases bundle size. Import only what you need for tree-shaking.

- **Not using flexRender** - Manually rendering header/cell values instead of using `flexRender` breaks when columnDef uses a function for header/cell.

### Common Mistakes

- **Inline column definitions** - Defining columns inside the render function without useMemo causes performance issues.

- **Sorting enabled with manualSorting** - Using `getSortedRowModel` with `manualSorting: true` is redundant. Manual mode means you handle sorting server-side.

- **Uncontrolled state for persistence** - Using default state without lifting it to component state makes it impossible to persist to URL or localStorage.

- **Missing aria attributes** - Icon-only buttons (sort indicators, expand buttons) need aria-labels for accessibility.

### Gotchas & Edge Cases

- **Date sorting requires sortingFn** - JavaScript dates don't sort correctly by default. Use `sortingFn: "datetime"` for Date objects.

- **Column filters are AND, not OR** - Multiple column filters combine with AND logic. For OR logic, use global filter or custom logic.

- **pageIndex is 0-based** - TanStack Table uses 0-based page indices, but many APIs use 1-based. Add 1 when sending to server.

- **autoResetPageIndex defaults true** - Page resets to 0 when data changes. Set `autoResetPageIndex: false` for server-side or manage manually.

- **Visibility state hides by false** - A column is hidden if its ID maps to `false` in visibility state. Missing keys mean visible.

- **getSortedRowModel needed for sort state** - Even if you just want to track sorting state without auto-sorting, you need a sorting row model or `manualSorting: true`.

- **Column pinning requires sticky CSS** - TanStack Table provides pinning state, but you must apply `position: sticky` CSS yourself.

- **Pinned column overlap** - Pinned cells need a background color, otherwise scrolling content shows through.

- **Column resizing "onChange" mode performance** - Using `columnResizeMode: "onChange"` without CSS variables and memoization causes poor performance. Use CSS variables pattern.

- **getResizeHandler needs both mouse and touch** - Attach handler to both `onMouseDown` and `onTouchStart` for mobile support.

- **Column order: Pinning affects order** - There are 3 features that reorder columns: Column Pinning, Column Ordering, and Grouping. Pinning happens first.

---

## Anti-Patterns

### Inline Column Definitions

Column definitions must be stable references. Defining them inline causes the table to think columns changed on every render.

```typescript
// WRONG - Creates new array every render
function BadTable({ data }) {
  const table = useReactTable({
    data,
    columns: [ // BAD: New array reference
      { accessorKey: "name", header: "Name" },
    ],
    getCoreRowModel: getCoreRowModel(),
  });
}

// CORRECT - Memoized columns
function GoodTable({ data }) {
  const columns = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
    ],
    []
  );

  const table = useReactTable({
    data: useMemo(() => data, [data]),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
}
```

### Returning JSX from Accessor Functions

Accessor functions should return primitive values that can be sorted and filtered. Use `cell` for custom rendering.

```typescript
// WRONG - JSX in accessor
{
  accessorFn: (row) => <span>{row.status}</span>, // BAD
  id: "status",
}

// CORRECT - Primitive accessor, JSX in cell
{
  accessorKey: "status",
  cell: (info) => <span data-status={info.getValue()}>{info.getValue()}</span>,
}
```

### Mixed Client/Server Modes

Using client-side row models with server-side data causes incorrect behavior. Be consistent.

```typescript
// WRONG - Mixed modes
const table = useReactTable({
  data: serverData, // Already paginated from server
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(), // BAD: Will paginate again
  manualPagination: true, // This disables getPaginationRowModel, making it pointless
});

// CORRECT - Server-side only
const table = useReactTable({
  data: serverData,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  rowCount: totalFromServer,
});
```

### Missing Row ID for Selection

Using default array index for row IDs breaks selection when data changes.

```typescript
// WRONG - Selection uses array index
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
  // No getRowId - selection will break on sort/filter
});

// CORRECT - Stable row ID
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  enableRowSelection: true,
  getRowId: (row) => row.id, // Use database ID
});
```

### Uncontrolled State

Using default state makes it impossible to persist or sync with URL.

```typescript
// WRONG - Uncontrolled, can't persist
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  // Sorting state is internal-only
});

// CORRECT - Controlled state
const [sorting, setSorting] = useState<SortingState>([]);

const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting, // Now can persist to URL
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

---

## Quick Reference

### Essential Imports

```typescript
// Core (always needed)
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
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

// Row models (import only what you need)
import {
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
} from "@tanstack/react-table";
```

### Minimum Table Setup Checklist

- [ ] Data memoized with `useMemo` or defined outside component
- [ ] Columns memoized with `useMemo` or defined outside component
- [ ] `getCoreRowModel()` provided (required)
- [ ] `getRowId` set for tables with selection or data changes
- [ ] Type parameter provided to `createColumnHelper<YourType>()`

### Server-Side Table Checklist

- [ ] `manualPagination: true` set
- [ ] `manualSorting: true` set (if sorting needed)
- [ ] `manualFiltering: true` set (if filtering needed)
- [ ] `rowCount` or `pageCount` provided
- [ ] State lifted to component (`useState`) for query params
- [ ] No client-side row models imported (except `getCoreRowModel`)

### Sorting Checklist

- [ ] `getSortedRowModel()` imported (client-side)
- [ ] Sorting state lifted if needed for persistence
- [ ] `sortingFn: "datetime"` for Date columns
- [ ] `enableSorting: false` on non-sortable columns
- [ ] Click handler uses `getToggleSortingHandler()`
- [ ] Sort indicator shows direction

### Filtering Checklist

- [ ] `getFilteredRowModel()` imported (client-side)
- [ ] Column filters and global filter state lifted
- [ ] Custom `filterFn` for complex filtering
- [ ] `enableColumnFilter: false` on non-filterable columns
- [ ] Page reset on filter change (`setPagination` with pageIndex: 0)

### Pagination Checklist

- [ ] `getPaginationRowModel()` imported (client-side)
- [ ] Pagination state lifted for persistence
- [ ] Navigation buttons use `getCanPreviousPage()`/`getCanNextPage()`
- [ ] Page count displayed correctly
- [ ] Page size selector updates `setPageSize()`

### Selection Checklist

- [ ] `enableRowSelection: true` set
- [ ] `getRowId` provides stable IDs
- [ ] Selection state lifted for bulk actions
- [ ] Checkbox column uses `columnHelper.display()`
- [ ] `indeterminate` state handled for select-all

### Column Pinning Checklist

- [ ] `ColumnPinningState` type for state
- [ ] `onColumnPinningChange` handler set
- [ ] Sticky CSS applied to pinned columns
- [ ] Background color set on pinned cells (prevents overlap)
- [ ] Left/right offsets calculated for multiple pinned columns
- [ ] Shadow on pinned columns for visual separation
- [ ] `enablePinning: false` on columns that shouldn't be pinnable

### Column Resizing Checklist

- [ ] `enableColumnResizing: true` set
- [ ] `columnResizeMode` chosen ("onChange" or "onEnd")
- [ ] Resize handle element with `getResizeHandler()`
- [ ] CSS variables for width (performance)
- [ ] Table body memoized (if using "onChange")
- [ ] `size`, `minSize`, `maxSize` set on columns
- [ ] Visual feedback during resize (`getIsResizing()`)
- [ ] Double-click to reset (`resetSize()`)

### Accessibility Checklist

- [ ] Sortable headers have `aria-sort` attribute
- [ ] Icon-only buttons have `aria-label`
- [ ] Expandable rows have `aria-expanded`
- [ ] Selection checkboxes have `aria-label`
- [ ] Virtual tables announce row count with `aria-live`
- [ ] Pagination has `aria-label` on navigation buttons
- [ ] Resize handles have `aria-label`

---

## Performance Guidelines

### When to Virtualize

- 1,000+ rows: Consider virtualization
- 5,000+ rows: Strongly recommend virtualization
- 10,000+ rows: Virtualization essential

### Memoization Rules

1. **Always memoize:** columns, data
2. **Memoize if derived:** filtered/sorted subsets
3. **Don't memoize:** table instance (created fresh is fine)

### Bundle Size Tips

1. Import row models individually (tree-shaking)
2. Don't import unused features
3. Use type-only imports for TypeScript types

```typescript
// Good - tree-shakable
import { getSortedRowModel } from "@tanstack/react-table";

// Also good - type-only
import type { SortingState } from "@tanstack/react-table";
```
