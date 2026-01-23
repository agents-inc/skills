# Performance Examples

> Core React performance optimization patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**React Compiler (React 19+):** The React Compiler automatically memoizes components, values, and functions. With the compiler enabled, you typically don't need manual `useMemo`, `useCallback`, or `React.memo`. The patterns below are still useful for projects without the compiler or for edge cases (third-party library interop, React Native, non-pure computations).

**For advanced patterns**: See topic-specific files in this folder:

- [turborepo.md](turborepo.md) - Build system caching, TypeScript optimization
- [code-splitting.md](code-splitting.md) - Lazy loading, tree shaking, bundle budgets
- [web-vitals.md](web-vitals.md) - LCP, INP, CLS patterns and monitoring
- [image-optimization.md](image-optimization.md) - Image formats, lazy loading, Next.js Image
- [ci-tooling.md](ci-tooling.md) - Lighthouse CI, React DevTools Profiler

---

## Memoization Constants

```typescript
// constants/performance.ts
export const MEMOIZATION_THRESHOLDS = {
  EXPENSIVE_RENDER_MS: 5,
  VIRTUALIZATION_ITEM_COUNT: 100,
  DEBOUNCE_SEARCH_MS: 500,
  THROTTLE_SCROLL_MS: 100,
} as const;
```

---

## Pattern 1: React.memo

### Good Example - Memoize Expensive Component

```typescript
import { memo } from 'react';

interface ChartProps {
  data: DataPoint[];
}

export const ExpensiveChart = memo(({ data }: ChartProps) => {
  // Complex charting logic (> 5ms render time)
  return <Chart data={data} />;
});

ExpensiveChart.displayName = 'ExpensiveChart';
```

**Why good:** Prevents re-renders when props haven't changed, useful for expensive components (> 5ms render), reduces render cascades in deep trees

### Bad Example - Memoizing Cheap Component

```typescript
import { memo } from 'react';

export const SimpleButton = memo(({ label }: { label: string }) => {
  return <button>{label}</button>;  // < 1ms render
});
```

**Why bad:** Memoization overhead exceeds render cost for simple components, adds complexity without benefit, premature optimization

**When to use React.memo:**

- Component renders frequently with same props
- Component is expensive to render (> 5ms)
- Component is deep in the tree
- **Not using React Compiler** (compiler handles this automatically)

**When not to use:**

- Props change frequently (memoization never helps)
- Component is cheap to render (overhead > benefit)
- Before profiling (premature optimization)
- **Using React Compiler** (React 19+) - compiler auto-memoizes

---

## Pattern 2: useMemo

### Good Example - Memoize Expensive Data Operations

```typescript
import { useMemo } from 'react';

const LARGE_DATASET_THRESHOLD = 1000;

export function DataTable({ rows, filters, sortColumn }: Props) {
  const filteredRows = useMemo(
    () => rows.filter((row) => filters.every((f) => f.predicate(row))),
    [rows, filters]
  );

  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) =>
      compareValues(a[sortColumn], b[sortColumn])
    ),
    [filteredRows, sortColumn]
  );

  return <Table data={sortedRows} />;
}
```

**Why good:** Prevents recalculating filter/sort on every render, only recomputes when dependencies change, dramatically faster for large datasets (> 1000 items)

### Bad Example - Recalculates on Every Render

```typescript
export function DataTable({ rows, filters, sortColumn }: Props) {
  const filteredRows = rows.filter((row) =>
    filters.every((f) => f.predicate(row))
  );
  const sortedRows = filteredRows.sort((a, b) =>
    compareValues(a[sortColumn], b[sortColumn])
  );

  return <Table data={sortedRows} />;
}
```

**Why bad:** Filters and sorts entire dataset on every render, wasted computation when dependencies haven't changed, causes performance issues with large datasets

### Bad Example - Memoizing Simple Calculation

```typescript
const doubled = useMemo(() => value * 2, [value]);
```

**Why bad:** Memoization overhead exceeds calculation cost, adds complexity for trivial operation

**When to use useMemo:**

- Expensive calculations (filtering, sorting large arrays > 1000 items)
- Creating objects/arrays passed to memoized components
- Preventing referential equality issues
- **Not using React Compiler** (compiler handles this automatically)

**When not to use:**

- Simple calculations (addition, string concatenation)
- Values used only in JSX (not passed as props)
- Before profiling
- **Using React Compiler** (React 19+) - compiler auto-memoizes

---

## Pattern 3: useCallback

### Good Example - Callback Passed to Memoized Child

```typescript
import { useCallback, memo } from 'react';

const MemoizedButton = memo(({ onClick, label }: ButtonProps) => {
  return <button onClick={onClick}>{label}</button>;
});

export function Parent({ id }: Props) {
  const handleClick = useCallback(() => {
    doSomething(id);
  }, [id]);

  return <MemoizedButton onClick={handleClick} label="Click me" />;
}
```

**Why good:** Stable function reference prevents MemoizedButton re-renders, only recreates callback when id changes, enables memoization to work

### Bad Example - Callback Not Passed to Memoized Component

```typescript
export function Form() {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  return <input onChange={handleChange} />;
  // input is not memoized - useCallback unnecessary
}
```

**Why bad:** Input re-renders anyway (not memoized), useCallback adds overhead without benefit, premature optimization

**When to use useCallback:**

- Functions passed to memoized child components
- Functions used in dependency arrays
- Event handlers in optimized components
- **Not using React Compiler** (compiler handles this automatically)

**When not to use:**

- Functions not passed to memoized children
- Functions that change on every render anyway
- Inline event handlers in non-optimized components
- **Using React Compiler** (React 19+) - compiler auto-memoizes

---

## Pattern 4: Virtual Scrolling

### Good Example - react-window

```typescript
import { FixedSizeList } from 'react-window';

const ITEM_HEIGHT_PX = 120;
const LIST_HEIGHT_PX = 600;
const VIRTUALIZATION_THRESHOLD = 100;

interface ProductListProps {
  products: Product[];
}

export function ProductList({ products }: ProductListProps) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={LIST_HEIGHT_PX}
      itemCount={products.length}
      itemSize={ITEM_HEIGHT_PX}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

**Why good:** Only renders visible items (constant DOM size), smooth scrolling with 100K+ items, dramatically reduced memory usage

### Bad Example - Rendering 10,000 DOM Nodes

```typescript
export function ProductList({ products }: { products: Product[] }) {
  return (
    <div className="product-list">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

**Why bad:** Renders thousands of DOM nodes, consumes gigabytes of memory, slow scrolling, browser struggles with large DOMs

**When to use virtual scrolling:**

- Rendering > 100 items
- Items have consistent height
- List is scrollable

**Libraries:**

- **react-window** - Lightweight, simple
- **react-virtuoso** - Feature-rich, dynamic heights
- **TanStack Virtual** - Headless, flexible

---

## Pattern 5: Debouncing

### Good Example - Debounced Search

```typescript
import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { ChangeEvent } from 'react';

const SEARCH_DEBOUNCE_MS = 500;

export function SearchInput() {
  const [query, setQuery] = useState('');

  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      performSearch(value);
    },
    SEARCH_DEBOUNCE_MS // Wait 500ms after user stops typing
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setQuery(value);
    debouncedSearch(value);
  };

  return <input value={query} onChange={handleChange} />;
}
```

**Why good:** Reduces API calls (one request instead of one per keystroke), better UX (no flickering results), prevents race conditions, saves server resources

### Bad Example - Triggering Search on Every Keystroke

```typescript
export function SearchInput() {
  const [query, setQuery] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    performSearch(e.target.value); // Fires every keystroke!
  };

  return <input value={query} onChange={handleChange} />;
}
```

**Why bad:** API call for every keystroke, potential race conditions (responses arrive out of order), wastes bandwidth and server resources, poor UX with flickering results

**Debouncing vs Throttling:**

- **Debouncing**: Wait until user stops (search inputs, form validation, auto-save)
- **Throttling**: Limit execution rate (scroll handlers, resize handlers, mouse move tracking)
