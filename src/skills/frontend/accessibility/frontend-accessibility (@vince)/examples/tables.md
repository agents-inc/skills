# Data Table Accessibility Patterns

> Sortable data tables with proper semantics and ARIA.

---

## Sortable Data Tables

### Example: Accessible Sortable Data Table

```typescript
// components/data-table.tsx
import { useState, type ReactNode } from 'react';

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption: string;
  rowKey: keyof T;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  caption,
  rowKey,
  className,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <table className={className}>
      <caption>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={String(column.key)}
              scope="col"
            >
              {column.sortable ? (
                <button
                  onClick={() => handleSort(column.key)}
                  aria-sort={
                    sortColumn === column.key
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {column.header}
                  {sortColumn === column.key && (
                    <span aria-hidden="true">
                      {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </button>
              ) : (
                column.header
              )}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {sortedData.map((row) => (
          <tr key={String(row[rowKey])}>
            {columns.map((column) => (
              <td key={String(column.key)}>
                {column.render
                  ? column.render(row[column.key], row)
                  : String(row[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Why good:** Semantic HTML. Proper scope attributes. Sortable columns announced. Screen reader navigation.

**Edge Cases:**

- Add row selection with checkboxes
- Support keyboard navigation between cells
- Provide row/column headers for complex tables
