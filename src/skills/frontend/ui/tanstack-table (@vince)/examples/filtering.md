# TanStack Table - Filtering

> Filtering examples. See [core.md](core.md) for basic table setup.

---

## Column and Global Filtering

### Good Example - Multiple filter types per column

```typescript
import { useState, useMemo } from "react";
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnFiltersState, FilterFn } from "@tanstack/react-table";

type Employee = {
  id: string;
  name: string;
  department: string;
  salary: number;
  hireDate: Date;
};

const columnHelper = createColumnHelper<Employee>();

// Custom filter function for salary ranges
const salaryRangeFilter: FilterFn<Employee> = (row, columnId, filterValue) => {
  const salary = row.getValue<number>(columnId);
  const [min, max] = filterValue as [number, number];
  return salary >= min && salary <= max;
};

const MIN_SALARY = 0;
const MAX_SALARY = 500000;

export function FilterableEmployeeTable({ employees }: { employees: Employee[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        enableColumnFilter: true,
      }),
      columnHelper.accessor("department", {
        header: "Department",
        // Select-based filter
        enableColumnFilter: true,
        filterFn: "equals",
      }),
      columnHelper.accessor("salary", {
        header: "Salary",
        cell: (info) => `$${info.getValue().toLocaleString()}`,
        filterFn: salaryRangeFilter,
      }),
      columnHelper.accessor("hireDate", {
        header: "Hire Date",
        cell: (info) => info.getValue().toLocaleDateString(),
        enableColumnFilter: false, // Disable filtering for this column
      }),
    ],
    []
  );

  const table = useReactTable({
    data: employees,
    columns,
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Custom filter functions registry
    filterFns: {
      salaryRange: salaryRangeFilter,
    },
  });

  // Get unique departments for select filter
  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department))],
    [employees]
  );

  return (
    <div>
      {/* Global search */}
      <div>
        <label htmlFor="global-search">Search all columns:</label>
        <input
          id="global-search"
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Type to search..."
        />
      </div>

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
          {/* Filter row */}
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <th key={`filter-${header.id}`}>
                {header.column.getCanFilter() && (
                  header.column.id === "department" ? (
                    <select
                      value={(header.column.getFilterValue() as string) ?? ""}
                      onChange={(e) =>
                        header.column.setFilterValue(e.target.value || undefined)
                      }
                    >
                      <option value="">All</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  ) : header.column.id === "salary" ? (
                    <div>
                      <input
                        type="number"
                        placeholder="Min"
                        onChange={(e) => {
                          const val = e.target.value;
                          header.column.setFilterValue((old: [number, number]) => [
                            val ? Number(val) : MIN_SALARY,
                            old?.[1] ?? MAX_SALARY,
                          ]);
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        onChange={(e) => {
                          const val = e.target.value;
                          header.column.setFilterValue((old: [number, number]) => [
                            old?.[0] ?? MIN_SALARY,
                            val ? Number(val) : MAX_SALARY,
                          ]);
                        }}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={(header.column.getFilterValue() as string) ?? ""}
                      onChange={(e) => header.column.setFilterValue(e.target.value)}
                      placeholder={`Filter ${header.column.id}...`}
                    />
                  )
                )}
              </th>
            ))}
          </tr>
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
      <div>Showing {table.getRowModel().rows.length} of {employees.length} rows</div>
    </div>
  );
}
```

**Why good:** custom filter function for range filtering, different filter UI per column type (text, select, range), global filter for quick search, named constants for filter bounds

---

## Key Filtering Options

```typescript
// Column definition options
columnHelper.accessor("field", {
  enableColumnFilter: true,    // Default: true
  enableGlobalFilter: true,    // Include in global search
  filterFn: "equals",          // Built-in: "includesString", "equals", "arrIncludes"
});

// Table options
const table = useReactTable({
  state: { columnFilters, globalFilter },
  onColumnFiltersChange: setColumnFilters,
  onGlobalFilterChange: setGlobalFilter,
  getFilteredRowModel: getFilteredRowModel(),
  filterFns: { customFilter },  // Register custom filters
});

// Filtering utilities
header.column.getCanFilter();     // Is column filterable?
header.column.getFilterValue();   // Current filter value
header.column.setFilterValue();   // Set filter value
table.getFilteredRowModel();      // Filtered rows
```
