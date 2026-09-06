# Accessibility — Data Tables

> Headers, captions and sortable columns. See [SKILL.md](../SKILL.md) for the decisions.

---

## A sortable table

```typescript
import { useState, type ReactNode } from "react";

interface Column<T> {
  key: keyof T;
  header: string;
  isSortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption: string;
  rowKey: keyof T;
}

type SortDirection = "ascending" | "descending";

function compareBy<T>(column: keyof T, direction: SortDirection) {
  return (a: T, b: T) => {
    if (a[column] === b[column]) return 0;
    const ascending = a[column] < b[column] ? -1 : 1;
    return direction === "ascending" ? ascending : -ascending;
  };
}

export function DataTable<T>({ data, columns, caption, rowKey }: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");

  const handleSort = (column: keyof T) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("ascending");
      return;
    }
    setSortDirection(sortDirection === "ascending" ? "descending" : "ascending");
  };

  const sortedData = sortColumn ? [...data].sort(compareBy(sortColumn, sortDirection)) : data;

  return (
    <table>
      <caption>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={String(column.key)}
              scope="col"
              aria-sort={sortColumn === column.key ? sortDirection : "none"}
            >
              {column.isSortable ? (
                <button onClick={() => handleSort(column.key)}>
                  {column.header}
                  {sortColumn === column.key && (
                    <span aria-hidden="true">{sortDirection === "ascending" ? " ↑" : " ↓"}</span>
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
                {column.render ? column.render(row[column.key], row) : String(row[column.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Why good:** `scope="col"` tells a screen reader which header belongs to each cell, so a cell read
in isolation announces its column — which is how table navigation works. `aria-sort` lives on the
`<th>` rather than on the button inside it, because the column is what is sorted; it takes
`ascending`, `descending`, `other` or `none`, and only one column carries a value other than `none`
at a time. The arrow is decorative, since `aria-sort` already announces the direction.

The `<caption>` is the table's accessible name and appears in the list of tables a screen reader
offers, so it is worth more than a heading above the table.

---

## Row headers

Where the first cell in each row identifies it, mark it up as a header too.

```html
<tr>
  <th scope="row">Northern region</th>
  <td>1,204</td>
  <td>891</td>
</tr>
```

**Why good:** a cell is then announced with both its column and its row header — "Northern region,
Q2, 891" — which is the difference between a navigable table and a grid of unattributed numbers.

---

## What tables owe

- One `<caption>`, describing what the table contains
- `scope` on every header cell
- Real `<table>` markup for tabular data — a CSS grid of `<div>`s has no table semantics at all, and no amount of `role` attributes reproduces the navigation
- No layout tables; where the content is not tabular, use CSS

**Sorting announcement:** changing the sort re-renders the rows silently. Where the table is long,
put a `role="status"` region beside it saying what just happened — "Sorted by name, ascending" —
because `aria-sort` is discovered only by a reader who navigates back to the header.
