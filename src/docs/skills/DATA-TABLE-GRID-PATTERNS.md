# Data Table and Grid Best Practices Research

**Research Date:** 2026-01-15
**Purpose:** Comprehensive patterns for creating atomic skills around data tables and grids
**Focus Areas:** TanStack Table, AG Grid, virtual scrolling, sorting/filtering, column management, cell editing, row selection, export, responsive patterns, accessibility

---

## Table of Contents

1. [TanStack Table Core Patterns](#1-tanstack-table-core-patterns)
2. [AG Grid Patterns](#2-ag-grid-patterns)
3. [Virtual Scrolling Patterns](#3-virtual-scrolling-patterns)
4. [Sorting and Filtering Patterns](#4-sorting-and-filtering-patterns)
5. [Column Resizing and Reordering](#5-column-resizing-and-reordering)
6. [Cell Editing Patterns](#6-cell-editing-patterns)
7. [Row Selection Patterns](#7-row-selection-patterns)
8. [Export Functionality](#8-export-functionality)
9. [Responsive Table Patterns](#9-responsive-table-patterns)
10. [Accessibility in Tables](#10-accessibility-in-tables)

---

## 1. TanStack Table Core Patterns

TanStack Table (formerly React Table) is a headless UI library providing table logic without UI opinions. It was rewritten in TypeScript for v8 and supports React, Vue, Solid, and Svelte.

### Core Patterns

#### Pattern 1.1: Type-Safe Column Definitions with `createColumnHelper`

```typescript
import { createColumnHelper, useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";

// Define data type
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  status: "active" | "inactive";
}

// Use createColumnHelper for type inference
const columnHelper = createColumnHelper<User>();

const columns = [
  columnHelper.accessor("id", {
    header: "ID",
    size: 80,
  }),
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => info.getValue(), // Type-safe access
  }),
  columnHelper.accessor("email", {
    header: "Email",
  }),
  columnHelper.accessor("age", {
    header: "Age",
    cell: (info) => `${info.getValue()} years`,
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <span data-status={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
];
```

**Why good:** `createColumnHelper` provides full TypeScript inference for accessor keys and cell values, preventing runtime errors from typos.

#### Pattern 1.2: Stable Data References (CRITICAL)

```typescript
// GOOD: Data outside component or with useState/useMemo
const DataTable = () => {
  // Option 1: useState for mutable data
  const [data, setData] = useState<User[]>([]);

  // Option 2: useMemo for derived/filtered data
  const filteredData = useMemo(
    () => data.filter((user) => user.status === "active"),
    [data]
  );

  // Option 3: React Query (TanStack Query)
  const { data: queryData } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const table = useReactTable({
    data: filteredData, // Stable reference
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <Table table={table} />;
};

// BAD: Data defined in render scope causes infinite loops
const BadDataTable = () => {
  const table = useReactTable({
    data: [{ id: "1", name: "John" }], // NEW ARRAY EVERY RENDER!
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  // ...
};
```

**Why critical:** Unstable data references cause infinite re-renders. TanStack Table detects data changes by reference, not deep equality.

#### Pattern 1.3: Memoized Columns

```typescript
const DataTable = ({ showEmail }: { showEmail: boolean }) => {
  // Memoize columns to prevent unnecessary recalculations
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      columnHelper.accessor("name", { header: "Name" }),
      ...(showEmail
        ? [columnHelper.accessor("email", { header: "Email" })]
        : []),
    ],
    [showEmail]
  );

  const table = useReactTable({
    data,
    columns, // Stable reference due to useMemo
    getCoreRowModel: getCoreRowModel(),
  });

  return <Table table={table} />;
};
```

### Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Defining data/columns inline | Causes infinite re-renders | Use useState, useMemo, or define outside component |
| Using `cell.render('Cell')` (v7 syntax) | Deprecated in v8 | Use `flexRender(cell.column.columnDef.cell, cell.getContext())` |
| Using `value` in cell renderer | Deprecated | Use `getValue()` method |
| Importing all row models | Bundle bloat | Import only needed models (`getCoreRowModel`, `getSortedRowModel`, etc.) |

### When to Use TanStack Table

**Use when:**
- You need complete control over table styling
- Bundle size is a concern (core is ~15KB)
- You have < 50,000 rows (with virtualization)
- You need framework flexibility (React, Vue, Solid, Svelte)

**Do NOT use when:**
- You need enterprise features out-of-box (pivot tables, Excel export)
- You have 100K+ rows with complex aggregations
- You need minimal development time with full features

---

## 2. AG Grid Patterns

AG Grid is a "batteries-included" enterprise data grid with built-in features. It has a free Community edition and a paid Enterprise edition.

### Core Patterns

#### Pattern 2.1: Basic AG Grid Setup

```typescript
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GridReadyEvent, ICellRendererParams } from "ag-grid-community";

interface User {
  id: string;
  name: string;
  email: string;
}

const columnDefs: ColDef<User>[] = [
  { field: "id", width: 80, sortable: true },
  { field: "name", filter: true, editable: true },
  {
    field: "email",
    cellRenderer: (params: ICellRendererParams<User>) => (
      <a href={`mailto:${params.value}`}>{params.value}</a>
    ),
  },
];

const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
};

const DataGrid = () => {
  const [rowData, setRowData] = useState<User[]>([]);

  const onGridReady = (params: GridReadyEvent) => {
    // Access grid API
    params.api.sizeColumnsToFit();
  };

  return (
    <div className="ag-theme-alpine" style={{ height: 500, width: "100%" }}>
      <AgGridReact<User>
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        rowSelection="multiple"
        animateRows={true}
      />
    </div>
  );
};
```

### When to Use AG Grid vs TanStack Table

| Criterion | TanStack Table | AG Grid |
|-----------|----------------|---------|
| Bundle size | ~15-30KB | ~200KB+ (Enterprise) |
| Styling control | Full (headless) | Limited (theme-based) |
| Row count | < 50K (virtualized) | 100K+ natively |
| Pivot tables | Manual implementation | Built-in (Enterprise) |
| Excel export | Third-party libraries | Built-in (Enterprise) |
| License cost | Free (MIT) | Free (Community) / $999+/dev/year (Enterprise) |
| Learning curve | Moderate (headless) | Lower (configured) |

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Not using `defaultColDef` | Repetitive column config | Define common props in `defaultColDef` |
| Mutating `rowData` directly | Grid doesn't detect changes | Use immutable updates with `setRowData` |
| Ignoring `getRowId` | Performance issues with updates | Provide stable row IDs |

---

## 3. Virtual Scrolling Patterns

Virtual scrolling renders only visible rows, critical for large datasets. TanStack Virtual is the recommended library for TanStack Table.

### Core Patterns

#### Pattern 3.1: Basic Virtualized Table

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useRef } from "react";

const ROW_HEIGHT_PX = 35;
const OVERSCAN_COUNT = 5;

const VirtualizedTable = ({ data, columns }: VirtualizedTableProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: OVERSCAN_COUNT,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      style={{ height: "500px", overflow: "auto" }}
    >
      <table style={{ height: `${totalSize}px`, position: "relative" }}>
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
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

#### Pattern 3.2: Infinite Scroll with Virtualization

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";

const PAGE_SIZE = 50;
const FETCH_THRESHOLD = 10; // Rows from end to trigger fetch

const InfiniteVirtualTable = () => {
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["users-infinite"],
    queryFn: ({ pageParam = 0 }) => fetchUsers({ page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length : undefined,
    initialPageParam: 0,
  });

  const allRows = data?.pages.flatMap((page) => page.data) ?? [];

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Fetch more when approaching end
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= allRows.length - FETCH_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, allRows.length, fetchNextPage]);

  return (
    <div ref={parentRef} style={{ height: "500px", overflow: "auto" }}>
      {/* Render virtual items */}
    </div>
  );
};
```

### When to Use Virtual Scrolling

**Use when:**
- Rendering > 50-100 rows without pagination
- Users need to scroll through large datasets
- Maintaining 60 FPS is critical

**Do NOT use when:**
- Table has < 50 rows (overhead not worth it)
- Using server-side pagination (already limiting rows)
- Table has complex row heights that are hard to estimate

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Missing `position` and `transform` CSS | Virtualization breaks | Use absolute positioning with translateY |
| Not setting `overflow: auto` on container | Scroll events don't fire | Ensure scrollable container |
| Very low `overscan` value | Flickering during fast scroll | Use 5-10 for smooth experience |
| Variable row heights without measurement | Layout thrashing | Use `measureElement` or fixed heights |

---

## 4. Sorting and Filtering Patterns

### Core Patterns

#### Pattern 4.1: Client-Side Sorting and Filtering

```typescript
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

const SortableFilterableTable = ({ data, columns }: TableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search all columns..."
      />
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  aria-sort={
                    header.column.getIsSorted()
                      ? header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" && " ↑"}
                  {header.column.getIsSorted() === "desc" && " ↓"}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {/* tbody */}
      </table>
    </>
  );
};
```

#### Pattern 4.2: Server-Side Sorting, Filtering, and Pagination

```typescript
import { useQuery } from "@tanstack/react-query";
import type { SortingState, ColumnFiltersState, PaginationState } from "@tanstack/react-table";

interface ServerTableParams {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  pagination: PaginationState;
}

const DEFAULT_PAGE_SIZE = 20;

const ServerSideTable = () => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Fetch data when state changes
  const { data, isLoading } = useQuery({
    queryKey: ["users", sorting, columnFilters, pagination],
    queryFn: () =>
      fetchUsersFromServer({
        sortBy: sorting[0]?.id,
        sortOrder: sorting[0]?.desc ? "desc" : "asc",
        filters: columnFilters,
        page: pagination.pageIndex,
        pageSize: pagination.pageSize,
      }),
  });

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    pageCount: data?.pageCount ?? -1,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    // CRITICAL: Manual modes for server-side operations
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });

  return (
    <>
      <table>{/* ... */}</table>
      <div>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </>
  );
};
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Mixing client-side sort with server-side pagination | Only sorts visible page | Be consistent: all client or all server |
| Not debouncing filter input | Excessive API calls | Debounce filter changes (300-500ms) |
| Missing `manualPagination` with server data | TanStack paginates locally | Set `manualPagination: true` |
| Not providing `pageCount` or `rowCount` | Pagination controls break | Always provide total count from server |

---

## 5. Column Resizing and Reordering

### Core Patterns

#### Pattern 5.1: Column Resizing

```typescript
import { useReactTable, getCoreRowModel, type ColumnResizeMode } from "@tanstack/react-table";

const DEFAULT_COLUMN_SIZE = 150;
const MIN_COLUMN_SIZE = 50;
const MAX_COLUMN_SIZE = 500;

const ResizableTable = ({ data, columns }: TableProps) => {
  // "onChange" for real-time feedback, "onEnd" for better performance
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      size: DEFAULT_COLUMN_SIZE,
      minSize: MIN_COLUMN_SIZE,
      maxSize: MAX_COLUMN_SIZE,
    },
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table style={{ width: table.getCenterTotalSize() }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                style={{ width: header.getSize(), position: "relative" }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}

                {/* Resize handle */}
                {header.column.getCanResize() && (
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`resize-handle ${
                      header.column.getIsResizing() ? "resizing" : ""
                    }`}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      height: "100%",
                      width: "5px",
                      cursor: "col-resize",
                      userSelect: "none",
                      touchAction: "none",
                    }}
                  />
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {/* tbody with matching column widths */}
    </table>
  );
};
```

#### Pattern 5.2: Column Reordering with Drag and Drop

```typescript
import { useReactTable, getCoreRowModel, type ColumnOrderState } from "@tanstack/react-table";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";

const ReorderableTable = ({ data, columns }: TableProps) => {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    columns.map((col) => col.id as string)
  );

  const table = useReactTable({
    data,
    columns,
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnOrder((current) => {
        const oldIndex = current.indexOf(active.id as string);
        const newIndex = current.indexOf(over.id as string);
        const newOrder = [...current];
        newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, active.id as string);
        return newOrder;
      });
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <table>
        <thead>
          <SortableContext
            items={columnOrder}
            strategy={horizontalListSortingStrategy}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DraggableHeader key={header.id} header={header} />
                ))}
              </tr>
            ))}
          </SortableContext>
        </thead>
        {/* tbody */}
      </table>
    </DndContext>
  );
};

const DraggableHeader = ({ header }: { header: Header<unknown, unknown> }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.id,
  });

  const style = {
    transform: transform ? `translateX(${transform.x}px)` : undefined,
    transition,
  };

  return (
    <th ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {flexRender(header.column.columnDef.header, header.getContext())}
    </th>
  );
};
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Using `columnResizeMode: "onChange"` with complex tables | 60 FPS difficult to maintain | Use `"onEnd"` for large/complex tables |
| No `minSize` defined | Columns can be resized to 0px | Always set reasonable `minSize` |
| Combining resize + reorder handlers on same element | Conflicts between interactions | Use separate drag handles |
| Not persisting column sizes/order | User preferences lost on refresh | Store in localStorage or backend |

---

## 6. Cell Editing Patterns

### Core Patterns

#### Pattern 6.1: Inline Editable Cells

```typescript
import { useReactTable, getCoreRowModel, type TableMeta } from "@tanstack/react-table";
import { useState, useEffect, useCallback } from "react";

// Extend TableMeta for type safety
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

// Editable cell component
const EditableCell = ({
  getValue,
  row,
  column,
  table,
}: CellContext<User, unknown>) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  // Sync with external changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
    if (e.key === "Escape") {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <div onDoubleClick={() => setIsEditing(true)} style={{ cursor: "pointer" }}>
      {value as string}
    </div>
  );
};

// Table setup
const EditableTable = () => {
  const [data, setData] = useState<User[]>(initialData);

  const updateData = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      setData((old) =>
        old.map((row, index) => {
          if (index === rowIndex) {
            return { ...row, [columnId]: value };
          }
          return row;
        })
      );
    },
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData,
    },
    defaultColumn: {
      cell: EditableCell, // Use editable cell by default
    },
  });

  return <table>{/* ... */}</table>;
};
```

#### Pattern 6.2: Optimized Editing with Row-Level Updates

```typescript
// Prevent full table re-render on single cell edit
const OptimizedEditableTable = () => {
  const [data, setData] = useState<User[]>(initialData);

  // Memoize updateData to prevent re-renders
  const updateData = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      setData((old) => {
        const newData = [...old];
        newData[rowIndex] = {
          ...newData[rowIndex],
          [columnId]: value,
        };
        return newData;
      });
    },
    []
  );

  // Memoize columns
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: EditableCell,
        meta: { type: "text" },
      }),
      columnHelper.accessor("age", {
        header: "Age",
        cell: EditableCell,
        meta: { type: "number" },
      }),
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { updateData },
  });

  // Memoize row rendering for performance
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <MemoizedRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  );
};

const MemoizedRow = memo(({ row }: { row: Row<User> }) => (
  <tr>
    {row.getVisibleCells().map((cell) => (
      <td key={cell.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    ))}
  </tr>
));
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Not using local state in editable cells | Every keystroke updates entire table | Maintain local state, sync on blur |
| Missing `key` on input elements | Focus issues during re-render | Always provide stable keys |
| No escape key handling | Users can't cancel edits | Listen for Escape to reset value |
| Not memoizing `updateData` | Causes unnecessary re-renders | Wrap in `useCallback` |

---

## 7. Row Selection Patterns

### Core Patterns

#### Pattern 7.1: Checkbox Selection

```typescript
import {
  useReactTable,
  getCoreRowModel,
  type RowSelectionState,
} from "@tanstack/react-table";

const SelectableTable = ({ data }: { data: User[] }) => {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            ref={(input) => {
              if (input) {
                input.indeterminate = table.getIsSomeRowsSelected();
              }
            }}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select row ${row.index + 1}`}
          />
        ),
      },
      // ... other columns
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    // Use database IDs instead of row index
    getRowId: (row) => row.id,
  });

  // Access selected rows
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIds = Object.keys(rowSelection);

  return (
    <>
      <div>
        {selectedRows.length} of {data.length} row(s) selected
      </div>
      <table>{/* ... */}</table>
      <button
        onClick={() => handleBulkAction(selectedIds)}
        disabled={selectedRows.length === 0}
      >
        Delete Selected
      </button>
    </>
  );
};
```

#### Pattern 7.2: Row Click Selection with Shift-Click Range

```typescript
import { useRef, useCallback } from "react";

const ShiftClickSelectTable = ({ data }: { data: User[] }) => {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const lastSelectedIdRef = useRef<string | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const handleRowClick = useCallback(
    (e: React.MouseEvent, row: Row<User>) => {
      if (e.shiftKey && lastSelectedIdRef.current) {
        // Shift-click: select range
        const rows = table.getRowModel().rows;
        const lastIndex = rows.findIndex((r) => r.id === lastSelectedIdRef.current);
        const currentIndex = rows.findIndex((r) => r.id === row.id);
        const [start, end] = [lastIndex, currentIndex].sort((a, b) => a - b);

        const newSelection: RowSelectionState = { ...rowSelection };
        for (let i = start; i <= end; i++) {
          newSelection[rows[i].id] = true;
        }
        setRowSelection(newSelection);
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd-click: toggle single
        row.toggleSelected();
      } else {
        // Regular click: select only this row
        setRowSelection({ [row.id]: true });
      }
      lastSelectedIdRef.current = row.id;
    },
    [rowSelection, table]
  );

  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={(e) => handleRowClick(e, row)}
            data-selected={row.getIsSelected()}
            style={{
              cursor: "pointer",
              backgroundColor: row.getIsSelected() ? "#e3f2fd" : undefined,
            }}
          >
            {/* cells */}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Using row index as selection key | Selection breaks after sort/filter | Use `getRowId` with stable IDs |
| Not handling indeterminate checkbox state | UX unclear when some rows selected | Set `indeterminate` via ref |
| Missing `aria-label` on checkboxes | Inaccessible to screen readers | Add descriptive labels |
| Forgetting to disable selection on non-selectable rows | Users can select disabled items | Use `enableRowSelection: (row) => boolean` |

---

## 8. Export Functionality

TanStack Table does not include built-in export. Common solutions use third-party libraries.

### Core Patterns

#### Pattern 8.1: CSV Export

```typescript
import { unparse } from "papaparse";

const exportTableToCSV = <T extends Record<string, unknown>>(
  table: Table<T>,
  filename: string
) => {
  // Get visible columns (excluding select column, etc.)
  const columns = table
    .getAllColumns()
    .filter((col) => col.getIsVisible() && col.id !== "select");

  // Get headers
  const headers = columns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === "string" ? header : col.id;
  });

  // Get row data
  const rows = table.getFilteredRowModel().rows.map((row) =>
    columns.map((col) => {
      const cellValue = row.getValue(col.id);
      // Handle different value types
      if (cellValue === null || cellValue === undefined) return "";
      if (typeof cellValue === "object") return JSON.stringify(cellValue);
      return String(cellValue);
    })
  );

  const csvContent = unparse({
    fields: headers,
    data: rows,
  });

  // Download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Usage
<button onClick={() => exportTableToCSV(table, "users-export")}>
  Export CSV
</button>
```

#### Pattern 8.2: Excel Export with XLSX

```typescript
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const exportTableToExcel = <T extends Record<string, unknown>>(
  table: Table<T>,
  filename: string
) => {
  const columns = table
    .getAllColumns()
    .filter((col) => col.getIsVisible() && col.id !== "select");

  const headers = columns.map((col) => {
    const header = col.columnDef.header;
    return typeof header === "string" ? header : col.id;
  });

  const rows = table.getFilteredRowModel().rows.map((row) =>
    columns.reduce(
      (acc, col) => {
        const header = typeof col.columnDef.header === "string"
          ? col.columnDef.header
          : col.id;
        acc[header] = row.getValue(col.id);
        return acc;
      },
      {} as Record<string, unknown>
    )
  );

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  // Auto-size columns
  const colWidths = headers.map((header) => ({
    wch: Math.max(
      header.length,
      ...rows.map((row) => String(row[header] ?? "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
};
```

#### Pattern 8.3: Export Selected Rows Only

```typescript
const exportSelectedRows = <T extends Record<string, unknown>>(
  table: Table<T>,
  filename: string
) => {
  const selectedRows = table.getSelectedRowModel().rows;

  if (selectedRows.length === 0) {
    alert("Please select rows to export");
    return;
  }

  const columns = table
    .getAllColumns()
    .filter((col) => col.getIsVisible() && col.id !== "select");

  const headers = columns.map((col) =>
    typeof col.columnDef.header === "string" ? col.columnDef.header : col.id
  );

  const data = selectedRows.map((row) =>
    columns.map((col) => String(row.getValue(col.id) ?? ""))
  );

  // Export using preferred method (CSV, Excel, etc.)
};
```

### When to Use Each Export Format

| Format | Use Case | Library |
|--------|----------|---------|
| CSV | Simple data, universal compatibility | `papaparse` |
| XLSX | Formatted data, enterprise users | `xlsx` + `file-saver` |
| PDF | Print-ready reports | `jspdf` + `jspdf-autotable` |
| JSON | API integrations, data backup | Native `JSON.stringify` |

---

## 9. Responsive Table Patterns

### Core Patterns

#### Pattern 9.1: Horizontal Scroll Container

```typescript
// Simplest responsive approach - horizontal scroll
const ResponsiveTable = ({ table }: { table: Table<User> }) => {
  return (
    <div
      className="table-container"
      style={{
        overflowX: "auto",
        maxWidth: "100%",
      }}
    >
      <table style={{ minWidth: "800px" }}>
        {/* Standard table markup */}
      </table>
    </div>
  );
};

// CSS
// .table-container { -webkit-overflow-scrolling: touch; }
```

#### Pattern 9.2: Stacked Cards on Mobile

```typescript
const MOBILE_BREAKPOINT_PX = 768;

const StackedTable = ({ table }: { table: Table<User> }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="card-list">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id} className="card">
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} className="card-row">
                <span className="card-label">
                  {typeof cell.column.columnDef.header === "string"
                    ? cell.column.columnDef.header
                    : cell.column.id}
                  :
                </span>
                <span className="card-value">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <table>
      {/* Standard table markup */}
    </table>
  );
};
```

#### Pattern 9.3: Column Visibility Toggle

```typescript
const ColumnVisibilityTable = ({ table }: { table: Table<User> }) => {
  const { columnVisibility, setColumnVisibility } = table.getState();

  // Priority columns always visible
  const PRIORITY_COLUMNS = ["name", "status"];

  // Auto-hide low-priority columns on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        table.getAllColumns().forEach((column) => {
          if (!PRIORITY_COLUMNS.includes(column.id)) {
            column.toggleVisibility(false);
          }
        });
      } else {
        table.getAllColumns().forEach((column) => {
          column.toggleVisibility(true);
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [table]);

  return (
    <>
      <div className="column-toggle">
        {table.getAllColumns().map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {column.id}
          </label>
        ))}
      </div>
      <table>{/* ... */}</table>
    </>
  );
};
```

### Responsive Strategy Decision Tree

```
Is table width > screen width?
├─ NO → Standard table layout
└─ YES → How many columns?
    ├─ ≤ 5 columns → Horizontal scroll (simplest)
    └─ > 5 columns → What's the use case?
        ├─ Data comparison → Horizontal scroll + sticky first column
        ├─ Individual record view → Card/stacked layout
        └─ Quick scanning → Column visibility toggle
```

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Fixed table width on mobile | Content overflows | Use `max-width: 100%` with `overflow-x: auto` |
| Pinning too many columns | Leaves no room for content | Limit pinned columns to 1-2 on mobile |
| Using `display: none` on columns | Data inaccessible | Use column visibility API or provide alternative view |
| No scroll indicator | Users don't know they can scroll | Add visual hint (shadow, arrow, or scroll bar) |

---

## 10. Accessibility in Tables

### Core Patterns

#### Pattern 10.1: Semantic Table Structure

```tsx
const AccessibleTable = ({ table }: { table: Table<User> }) => {
  return (
    <table
      role="grid"
      aria-label="User data table"
      aria-rowcount={table.getRowModel().rows.length}
      aria-colcount={table.getAllColumns().length}
    >
      <caption className="sr-only">
        User data with {table.getRowModel().rows.length} rows
      </caption>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} role="row">
            {headerGroup.headers.map((header, index) => (
              <th
                key={header.id}
                role="columnheader"
                scope="col"
                aria-colindex={index + 1}
                aria-sort={
                  header.column.getIsSorted()
                    ? header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                tabIndex={header.column.getCanSort() ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    header.column.getToggleSortingHandler()?.(e);
                  }
                }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getCanSort() && (
                  <span aria-hidden="true">
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row, rowIndex) => (
          <tr key={row.id} role="row" aria-rowindex={rowIndex + 1}>
            {row.getVisibleCells().map((cell, cellIndex) => (
              <td
                key={cell.id}
                role="gridcell"
                aria-colindex={cellIndex + 1}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

#### Pattern 10.2: Keyboard Navigation

```typescript
const KEYBOARD_NAVIGATION = {
  ARROW_RIGHT: "ArrowRight",
  ARROW_LEFT: "ArrowLeft",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  HOME: "Home",
  END: "End",
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
} as const;

const useGridKeyboardNavigation = (
  tableRef: RefObject<HTMLTableElement>,
  table: Table<unknown>
) => {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number }>({
    row: 0,
    col: 0,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const rows = table.getRowModel().rows.length;
      const cols = table.getAllColumns().length;

      let newRow = focusedCell.row;
      let newCol = focusedCell.col;

      switch (e.key) {
        case KEYBOARD_NAVIGATION.ARROW_RIGHT:
          newCol = Math.min(focusedCell.col + 1, cols - 1);
          break;
        case KEYBOARD_NAVIGATION.ARROW_LEFT:
          newCol = Math.max(focusedCell.col - 1, 0);
          break;
        case KEYBOARD_NAVIGATION.ARROW_DOWN:
          newRow = Math.min(focusedCell.row + 1, rows - 1);
          break;
        case KEYBOARD_NAVIGATION.ARROW_UP:
          newRow = Math.max(focusedCell.row - 1, 0);
          break;
        case KEYBOARD_NAVIGATION.HOME:
          newCol = 0;
          if (e.ctrlKey) newRow = 0;
          break;
        case KEYBOARD_NAVIGATION.END:
          newCol = cols - 1;
          if (e.ctrlKey) newRow = rows - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      setFocusedCell({ row: newRow, col: newCol });

      // Focus the cell
      const cell = tableRef.current?.querySelector(
        `[data-row="${newRow}"][data-col="${newCol}"]`
      ) as HTMLElement;
      cell?.focus();
    },
    [focusedCell, table, tableRef]
  );

  useEffect(() => {
    const table = tableRef.current;
    table?.addEventListener("keydown", handleKeyDown);
    return () => table?.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, tableRef]);

  return { focusedCell, setFocusedCell };
};
```

#### Pattern 10.3: Live Region for Updates

```tsx
const TableWithLiveRegion = ({ table }: { table: Table<User> }) => {
  const [announcement, setAnnouncement] = useState("");

  // Announce sorting changes
  useEffect(() => {
    const sortingState = table.getState().sorting;
    if (sortingState.length > 0) {
      const { id, desc } = sortingState[0];
      setAnnouncement(
        `Table sorted by ${id} in ${desc ? "descending" : "ascending"} order`
      );
    }
  }, [table.getState().sorting]);

  // Announce filter results
  useEffect(() => {
    const rowCount = table.getFilteredRowModel().rows.length;
    const totalCount = table.getCoreRowModel().rows.length;
    if (rowCount !== totalCount) {
      setAnnouncement(`Showing ${rowCount} of ${totalCount} rows`);
    }
  }, [table.getFilteredRowModel().rows.length]);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <table>{/* ... */}</table>
    </>
  );
};
```

### Required ARIA Attributes for Data Grids

| Element | Required Attributes | Purpose |
|---------|---------------------|---------|
| `<table>` | `role="grid"`, `aria-label` or `aria-labelledby` | Identify as interactive grid |
| `<tr>` (header) | `role="row"` | Identify header row |
| `<th>` | `role="columnheader"`, `scope="col"`, `aria-sort` | Sortable column header |
| `<tr>` (body) | `role="row"`, `aria-rowindex` | Data row with position |
| `<td>` | `role="gridcell"`, `aria-colindex` | Data cell with position |
| Selected row | `aria-selected="true"` | Selection state |
| Editable cell | `aria-readonly="false"` | Editability state |

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Missing `role="grid"` on interactive tables | Screen readers treat as static table | Add `role="grid"` |
| No `aria-sort` on sortable columns | Sort state not announced | Add `aria-sort="none/ascending/descending"` |
| Checkboxes without labels | "checkbox" announced with no context | Add `aria-label` |
| Focus not visible | Keyboard users can't navigate | Ensure `:focus-visible` styles |
| No skip link | Users must tab through all cells | Add link to skip table |

---

## Summary: Decision Matrix

### Choosing a Table Library

| Requirement | TanStack Table | AG Grid Community | AG Grid Enterprise |
|-------------|----------------|-------------------|-------------------|
| Full styling control | Yes | Limited | Limited |
| Bundle size priority | Yes | No | No |
| < 10K rows | Yes | Yes | Yes |
| 10K-100K rows | With virtualization | Yes | Yes |
| > 100K rows | Limited | Yes | Yes |
| Pivot tables | Manual | No | Yes |
| Built-in Excel export | No | No | Yes |
| Tree data | Manual | Limited | Yes |
| License cost | Free | Free | $999+/dev/year |

### Feature Implementation Priority

When building a data table skill, implement in this order:

1. **Core rendering** - Column definitions, row model
2. **Sorting** - Single and multi-column
3. **Filtering** - Global and column filters
4. **Pagination** - Client or server-side
5. **Row selection** - Single and multi-select
6. **Virtual scrolling** - If > 100 rows
7. **Column resizing** - User preference
8. **Export** - CSV minimum, Excel optional
9. **Accessibility** - ARIA roles, keyboard nav
10. **Responsive** - Mobile-friendly layout

---

## Sources

### TanStack Table
- [TanStack Table Documentation](https://tanstack.com/table/latest)
- [TanStack Table Migrating to V8 Guide](https://tanstack.com/table/latest/docs/guide/migrating)
- [LogRocket TanStack Table Guide](https://blog.logrocket.com/tanstack-table-formerly-react-table/)
- [Column Sizing Guide](https://tanstack.com/table/v8/docs/guide/column-sizing)
- [Row Selection Guide](https://tanstack.com/table/latest/docs/guide/row-selection)
- [Editable Data Example](https://tanstack.com/table/latest/docs/framework/react/examples/editable-data)

### Virtual Scrolling
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [Material React Table Virtualization Guide](https://www.material-react-table.com/docs/guides/virtualization)
- [LogRocket TanStack Virtual Guide](https://blog.logrocket.com/speed-up-long-lists-tanstack-virtual/)

### AG Grid
- [TanStack Table vs AG Grid Comparison](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison)
- [AG Grid Enterprise Partners](https://tanstack.com/table/v8/docs/enterprise/ag-grid)
- [AG Grid Accessibility](https://www.ag-grid.com/javascript-data-grid/accessibility/)

### Accessibility
- [W3C Grid Pattern (APG)](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [MDN ARIA Table Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/table_role)
- [Simple Table Accessibility Guide](https://www.simple-table.com/blog/mit-licensed-react-tables-accessibility-keyboard-navigation)

### Responsive Patterns
- [React Responsive Table Guide](https://muhimasri.com/blogs/react-responsive-table/)
- [Simple Table Mobile Compatibility](https://www.simple-table.com/blog/mobile-compatibility-react-tables)

### Server-Side Operations
- [Server-side Pagination with TanStack](https://medium.com/@aylo.srd/server-side-pagination-and-sorting-with-tanstack-table-and-react-bd493170125e)
- [Advanced Shadcn Table](https://next.jqueryscript.net/shadcn-ui/advanced-shadcn-table/)

### Export
- [AG Grid Excel Export](https://www.ag-grid.com/react-data-grid/excel-export/)
- [Material React Table CSV Export Example](https://www.material-react-table.com/docs/examples/export-csv)
