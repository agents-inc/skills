---
name: web-performance-web-performance
description: Bundle optimization, render performance, Core Web Vitals
---

# Web Performance Patterns

> **Quick Guide:** Three numbers decide whether a page is fast: LCP under 2.5s, INP under 200ms, CLS under 0.1. Bundle size is the lever that moves the first two, so budget it — around 200 KB gzipped for the main bundle — and split by route. Measure before optimising and measure again in production, because a lab score and a real user's session disagree. With the React Compiler enabled, memoisation is automatic; a hand-written `useMemo` needs a profile behind it.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — memoisation, virtual scrolling, debouncing
- [examples/code-splitting.md](examples/code-splitting.md) — lazy routes, dynamic imports, tree shaking, budget enforcement
- [examples/web-vitals.md](examples/web-vitals.md) — LCP, INP and CLS patterns, and field measurement
- [examples/image-optimization.md](examples/image-optimization.md) — formats, responsive sources, lazy loading
- [reference.md](reference.md) — threshold and budget tables, format comparison

---

## Which path applies

- **The bundle is the problem** — a slow first load, a large main chunk, a heavy dependency; go to
  [examples/code-splitting.md](examples/code-splitting.md).
- **The runtime is the problem** — a janky list, a slow interaction, a re-render storm; go to
  [examples/core.md](examples/core.md).
- **Nothing is measured yet** — instrument first, because the two above have different answers and
  guessing picks the wrong one; go to [examples/web-vitals.md](examples/web-vitals.md).

---

<critical_requirements>

## Before optimising performance

**Profile first, and name the bottleneck before changing anything.** Every optimisation costs readability, and one applied to code that was never slow buys nothing back — a profiler, a bundle analysis, or a field measurement is what turns a guess into a target.

**Write the budgets down before the features.** A bundle limit and Core Web Vitals targets that exist in CI are a decision every future dependency is measured against; added afterwards, they only describe how far past the line you already are.

**Measure real sessions, not just a lab run.** Lab conditions have one device, one network and a cold cache; field data has the distribution of devices your users actually hold, and the two disagree most on exactly the pages that matter.

**Load route code when the route is reached.** Splitting on route boundaries is the single largest reduction available to most applications, because it stops every user paying for the pages they never open.

</critical_requirements>

---

**Auto-detection:** Core Web Vitals, LCP, INP, CLS, TTFB, bundle size, bundle budget, code splitting, lazy loading, tree shaking, memoization, React Compiler, virtualization, virtual scrolling, debounce, throttle, performance budget, field measurement, RUM

**Applies to:**

- Core Web Vitals: what each measures, and what moves it
- Bundle budgets, and enforcing them in CI
- Code splitting, dynamic import and tree shaking
- Render cost: memoisation, virtualisation, debouncing, keeping work off the main thread
- Image weight and format selection

**Handled elsewhere:**

- Bundler configuration — chunking strategy and analysis output belong to whichever bundler is in use; this skill decides what the numbers should be.
- Server response time — TTFB is upstream of everything here, and caching, compression and origin latency are the serving layer's.
- Framework-level rendering — whether a page is server-rendered, streamed or static is a framework decision, and each moves LCP differently.
- Data fetching and caching — a request that repeats needlessly is a fetching-layer concern, though it surfaces here as INP.

---

<philosophy>

## Philosophy

Performance work goes wrong in one of two ways: optimising what was never slow, or shipping features
against no budget until the page is slow everywhere at once. Both are failures of measurement rather
than of technique.

So the order is fixed — budget, then build, then measure, then optimise what the measurement named.

</philosophy>

---

<decision_framework>

## Where to spend the effort

```
Is the problem measured?
├─ NO → Measure it. A profiler for runtime, a bundle report for size,
│        field data for what users actually experience.
└─ YES → Is it load or interaction?
    ├─ Load (LCP, first paint) → How big is the initial download?
    │   ├─ Over budget → Split by route, defer heavy dependencies,
    │   │                 drop or replace the largest one
    │   └─ Within budget → It is the critical path: preload the LCP image,
    │                      remove render-blocking resources, cut TTFB
    └─ Interaction (INP, jank) → What is holding the main thread?
        ├─ A long task → Break it up, or move it to a worker
        ├─ Re-rendering → Profile the tree, then memoise what the profile named
        └─ Too many DOM nodes → Virtualise the list
```

**Memoise or not:** with the React Compiler the answer is usually "the compiler already did".
Without it, memoise a component that re-renders often with unchanged props and costs real time to
render — and nothing else, because the comparison itself is not free.

**Virtualise or not:** past roughly a hundred rows the DOM is the cost and virtualisation wins. Below
that it loses, and it costs you find-in-page and native scroll anchoring either way.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Bundle budgets

Budgets are per artifact and enforced in CI, so a dependency that doubles a chunk fails the pull
request rather than being discovered in production.

```typescript
export const BUNDLE_SIZE_BUDGETS_KB = {
  MAIN_BUNDLE_GZIPPED: 200,
  VENDOR_BUNDLE_GZIPPED: 150,
  ROUTE_BUNDLE_GZIPPED: 100,
  TOTAL_INITIAL_LOAD_GZIPPED: 500,
  CRITICAL_CSS_INLINE: 14, // fits in the first TCP round trip
} as const;
```

The numbers come from download time on a slow connection rather than from taste — the table and its
reasoning are in [reference.md](reference.md), and enforcement is in
[examples/code-splitting.md](examples/code-splitting.md).

### Pattern 2: Core Web Vitals

Each metric has a different cause, so a single "make it faster" task rarely moves more than one.

| Metric | Measures         | Usually caused by                                               |
| ------ | ---------------- | --------------------------------------------------------------- |
| LCP    | Loading          | An unoptimised hero image, render-blocking CSS or JS, slow TTFB |
| INP    | Interactivity    | Long tasks on the main thread, too much JavaScript              |
| CLS    | Visual stability | Images without dimensions, late-injected content, font swap     |

Thresholds and remedies are in [reference.md](reference.md); patterns in
[examples/web-vitals.md](examples/web-vitals.md).

### Pattern 3: Route-level code splitting

Each lazy route becomes its own chunk, fetched when the route is reached.

```typescript
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Reports = lazy(() => import("./pages/reports"));

// Whatever the router hands you, the lazy component renders under one Suspense boundary
<Suspense fallback={<PageLoader />}>
  {currentPage === "dashboard" ? <Dashboard /> : <Reports />}
</Suspense>;
```

Split routes, heavy feature modules, dialogs and below-fold sections. Leave above-fold components,
error boundaries and loading states in the main bundle — lazy-loading those adds a round trip to the
critical path.

Full code: [examples/code-splitting.md](examples/code-splitting.md)

### Pattern 4: Deferring a heavy dependency

A large library that only one interaction needs is imported inside that interaction rather than at
the top of the file.

```typescript
// "chart-library" stands for whichever heavy dependency the path actually needs
async function renderChart(container: HTMLElement, data: ChartData) {
  const { createChart } = await import("chart-library");
  return createChart(container, data);
}
```

The saving is the library's whole weight for every user who never triggers the path.

### Pattern 5: Strategic memoisation

Profile first. Under the React Compiler this is mostly already done for you.

```typescript
// Worth it: sorting thousands of rows on every keystroke elsewhere in the tree
const sortedRows = useMemo(
  () => [...rows].sort((a, b) => compareValues(a[sortColumn], b[sortColumn])),
  [rows, sortColumn],
);

// Not worth it: the comparison costs more than the work
const doubled = useMemo(() => value * 2, [value]);
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Virtualising long lists

Render the visible window rather than the whole collection, so the DOM stays a constant size however
long the list grows.

```typescript
const visible = rows.slice(startIndex, endIndex);

<div style={{ height: rows.length * ROW_HEIGHT_PX }}>
  <div style={{ transform: `translateY(${startIndex * ROW_HEIGHT_PX}px)` }}>
    {visible.map((row) => (
      <Row key={row.id} row={row} />
    ))}
  </div>
</div>;
```

Full code: [examples/core.md](examples/core.md)

### Pattern 7: Debouncing input-driven work

Run the expensive reaction after the typing stops, not on each keystroke. `useDebounced` below is a
dozen lines of `useRef` and `setTimeout`, written out in full in [examples/core.md](examples/core.md).

```typescript
const debouncedSearch = useDebounced(performSearch, SEARCH_DEBOUNCE_MS);

const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
  setQuery(event.target.value);
  debouncedSearch(event.target.value);
};
```

Debounce when only the final value matters — search, autosave, validation. Throttle when the
intermediate values matter but the rate does not — scroll, resize, pointer tracking.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A lazily loaded component with no `Suspense` boundary above it — React throws rather than waiting.
- An unstable dependency array on a memo hook — a fresh object or inline function each render means the memo never hits and you pay the comparison forever.
- Lazy-loading an error boundary or a loading state — the thing meant to render during a failure is itself still downloading.

**Surprising behaviour:**

- `React.memo` compares shallowly, so a prop that is a new object each render defeats it entirely.
- Memoisation costs a comparison and a retained reference; below a few milliseconds of work it is a net loss.
- Splitting adds bytes overall — more chunks and more runtime — and still wins on first load.
- A lab score and field data measure different populations; a green audit with a red INP in the field is the normal case, not a contradiction.
- Virtual scrolling breaks in-page find, anchor links into off-screen rows, and native scroll restoration.
- Lazy-loaded components are absent from server-rendered HTML, so anything above the fold shifts when it arrives.
- A namespace import (`import _ from "…"`) and a `require()` both defeat tree shaking; so does a barrel file that re-exports a whole directory.
- Budgets are meaningless without naming the compression — a 200 KB budget is three different limits raw, gzipped and brotli-compressed.
- AVIF is not universal; a `<picture>` without a WebP or JPEG source will fail to render for some users.

</red_flags>
