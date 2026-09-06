# Performance — Runtime Examples

> Memoisation, virtualisation and debouncing. See [SKILL.md](../SKILL.md) for the decisions and [reference.md](../reference.md) for the thresholds.

**Extended examples:**

- [code-splitting.md](code-splitting.md) — lazy routes, dynamic imports, tree shaking, budgets
- [web-vitals.md](web-vitals.md) — LCP, INP and CLS patterns, field measurement
- [image-optimization.md](image-optimization.md) — formats, responsive sources, lazy loading

**With the React Compiler enabled**, components, values and callbacks are memoised at build time and
the hooks below are rarely needed by hand. They still apply without it, and in the cases the compiler
leaves alone: interop with code outside React, and computations that are not pure.

```typescript
// constants/performance.ts
export const PERFORMANCE_THRESHOLDS = {
  EXPENSIVE_RENDER_MS: 5,
  VIRTUALIZATION_ITEM_COUNT: 100,
  DEBOUNCE_SEARCH_MS: 500,
  THROTTLE_SCROLL_MS: 100,
} as const;
```

---

## Pattern 5: Memoisation

### `React.memo`

```typescript
import { memo } from "react";

interface ChartProps {
  data: DataPoint[];
}

// Profiled at 40 ms per render, re-rendered on every parent state change
export const ExpensiveChart = memo(({ data }: ChartProps) => <Chart data={data} />);
```

**Why good:** the prop comparison costs microseconds and skips tens of milliseconds of work.

```typescript
// Bad
export const SimpleButton = memo(({ label }: { label: string }) => <button>{label}</button>);
```

**Why bad:** the render was already under a millisecond, so the comparison and the retained previous
props are pure overhead — and the component now looks expensive to whoever reads it next.

`memo` compares props shallowly. A parent passing `style={{ margin: 4 }}` or an inline arrow defeats
it on every render, so a memoised component whose props are objects needs those props stable too.

### `useMemo`

```typescript
import { useMemo } from "react";

export function DataTable({ rows, filters, sortColumn }: Props) {
  const filteredRows = useMemo(
    () => rows.filter((row) => filters.every((filter) => filter.predicate(row))),
    [rows, filters],
  );

  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => compareValues(a[sortColumn], b[sortColumn])),
    [filteredRows, sortColumn],
  );

  return <Table data={sortedRows} />;
}
```

**Why good:** filtering and sorting a large collection is real work, and it repeats on every render
of an ancestor otherwise. Chaining the two means changing the sort column does not redo the filter.

```typescript
// Bad — recomputed on every render
const filteredRows = rows.filter((row) =>
  filters.every((filter) => filter.predicate(row)),
);

// Also bad — memoised, but the work was one multiplication
const doubled = useMemo(() => value * 2, [value]);
```

### `useCallback`

```typescript
import { useCallback, memo } from "react";

const MemoizedButton = memo(({ onClick, label }: ButtonProps) => (
  <button onClick={onClick}>{label}</button>
));

export function Parent({ id }: Props) {
  const handleClick = useCallback(() => doSomething(id), [id]);
  return <MemoizedButton onClick={handleClick} label="Click me" />;
}
```

**Why good:** without the stable reference, `MemoizedButton` receives a new `onClick` every render
and the `memo` around it does nothing at all.

```typescript
// Bad — the child is not memoised, so it re-renders regardless
export function Form() {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  return <input onChange={handleChange} />;
}
```

**Why bad:** `useCallback` only pays off when something downstream compares the reference. A plain
`<input>` does not, so this is cost with no beneficiary.

---

## Pattern 6: Virtualising a long list

Only the rows inside the viewport are in the DOM. A spacer gives the scrollbar the full height, and
the rendered window is offset to sit where those rows would have been.

```typescript
import { useState } from "react";

const ROW_HEIGHT_PX = 120;
const VIEWPORT_HEIGHT_PX = 600;
const OVERSCAN_ROWS = 3;

interface ProductListProps {
  products: Product[];
}

export function ProductList({ products }: ProductListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const firstVisible = Math.floor(scrollTop / ROW_HEIGHT_PX);
  const startIndex = Math.max(0, firstVisible - OVERSCAN_ROWS);
  const endIndex = Math.min(
    products.length,
    firstVisible + Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX) + OVERSCAN_ROWS,
  );

  return (
    <div
      style={{ height: VIEWPORT_HEIGHT_PX, overflowY: "auto" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: products.length * ROW_HEIGHT_PX, position: "relative" }}>
        <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT_PX}px)` }}>
          {products.slice(startIndex, endIndex).map((product) => (
            <div key={product.id} style={{ height: ROW_HEIGHT_PX }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Why good:** the DOM holds a screenful of rows whatever the collection's length, so memory and
scroll cost stay flat. The overscan rows above and below keep blank space from appearing during a
fast scroll.

```typescript
// Bad — ten thousand cards in the document
export function ProductList({ products }: { products: Product[] }) {
  return (
    <div>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

**Why bad:** every card is laid out, styled and painted, and every ancestor re-render walks all of
them.

**What it costs:** rows outside the window do not exist, so in-page find misses them, anchor links
into them fail, and scroll restoration needs handling by hand. Fixed row heights are the simple
case; variable heights need measurement and are where a dedicated virtualisation library earns its
weight.

---

## Pattern 7: Debouncing and throttling

```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

const SEARCH_DEBOUNCE_MS = 500;

function useDebounced<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFn = useRef(fn);
  latestFn.current = fn;

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return useMemo(
    () =>
      (...args: Args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => latestFn.current(...args), delayMs);
      },
    [delayMs],
  );
}

export function SearchInput() {
  const [query, setQuery] = useState("");
  const debouncedSearch = useDebounced(performSearch, SEARCH_DEBOUNCE_MS);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    debouncedSearch(event.target.value);
  };

  return <input value={query} onChange={handleChange} />;
}
```

**Why good:** the input stays controlled and responsive on every keystroke while the expensive
reaction runs once. Clearing the timeout on unmount stops a search firing into a component that is
gone, and holding the latest `fn` in a ref keeps the debounced identity stable across renders.

```typescript
// Bad — one request per keystroke
const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
  setQuery(event.target.value);
  performSearch(event.target.value);
};
```

**Why bad:** eight requests for an eight-character query, arriving out of order, so the results the
user sees are whichever response happened to land last.

**Debounce or throttle:** debounce when only the final value matters — search, autosave, validation.
Throttle when the intermediate values matter but their rate does not — scroll position, resize,
pointer tracking. Debouncing a scroll handler means nothing happens until scrolling stops, which is
almost never what was wanted.
