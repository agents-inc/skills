# Code Splitting Strategies

> Lazy loading, tree shaking, and bundle budgets. See [core.md](core.md) for React runtime patterns.

---

## Route-Based Lazy Loading

### Good Example - Lazy Routes

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/dashboard'));
const Analytics = lazy(() => import('./pages/analytics'));
const Reports = lazy(() => import('./pages/reports'));

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

**Why good:** Splits bundle by route, loads components on demand, faster initial load because user only downloads what they navigate to

### Bad Example - Importing Everything Upfront

```typescript
import { Dashboard } from './pages/dashboard';
import { Analytics } from './pages/analytics';
import { Reports } from './pages/reports';

export function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/reports" element={<Reports />} />
    </Routes>
  );
}
```

**Why bad:** All route code loaded upfront, massive initial bundle, slow Time to Interactive, user pays bandwidth cost for routes they never visit

**When to use:** All route components, heavy feature modules, admin panels

**When not to use:** Critical above-fold components, error boundaries, loading states

---

## Dynamic Import for Heavy Libraries

### Good Example - Load on Demand

```typescript
// Heavy charting library loaded only when user opens analytics
async function renderChart(container: HTMLElement, data: ChartData) {
  const { Chart } = await import("chart.js");
  const chart = new Chart(container, { type: "bar", data });
  return chart;
}
```

**Why good:** Library only loaded when needed, smaller initial bundle, user doesn't pay for unused code

### Bad Example - Import Large Library Upfront

```typescript
import { Chart } from "chart.js"; // ~200KB loaded even if charts never viewed

export function AnalyticsPage() {
  // Chart.js code in initial bundle regardless of usage
}
```

**Why bad:** Entire library loaded upfront even if never used, increases initial bundle size, slower Time to Interactive

---

## Tree Shaking

### Good Example - ESM with Named Exports

```typescript
// ✅ Tree-shakeable - bundler removes unused exports
import { debounce } from "lodash-es";

// ✅ Mark package as side-effect-free in package.json
// { "sideEffects": false }
// Or specify files with side effects:
// { "sideEffects": ["*.css", "*.scss"] }
```

**Why good:** Bundler removes unused exports, reduces bundle size by 20-40%

### Bad Example - CommonJS or Full Library Import

```typescript
// ❌ Not tree-shakeable - bundles entire lodash (~70KB)
import _ from "lodash";
_.debounce(fn, 300);

// ❌ CommonJS - not tree-shakeable
const { debounce } = require("lodash");
```

**Why bad:** CommonJS and default imports bundle everything, prevents dead code elimination

**Requirements for tree shaking:**

- ES modules (not CommonJS)
- Named exports (not default exports)
- Side-effect-free code (or declared in `sideEffects` field)

**Common tree shaking issues:**

- Barrel exports (`index.ts` re-exporting everything) -- imports entire barrel
- Side effects in module scope -- prevents tree shaking
- Dependencies using CommonJS internally -- not tree-shakeable

---

## Bundle Budget Enforcement

### Good Example - size-limit in package.json

```json
{
  "size-limit": [
    {
      "name": "Main bundle",
      "path": "dist/index.js",
      "limit": "200 KB"
    },
    {
      "name": "Vendor bundle",
      "path": "dist/vendor.js",
      "limit": "150 KB"
    },
    {
      "name": "Dashboard route",
      "path": "dist/dashboard.js",
      "limit": "100 KB"
    }
  ]
}
```

**Why good:** Automated bundle size checking, fails CI if budgets exceeded, prevents bundle bloat before merging

**Integrate with CI:** Use size-limit with your CI provider to check bundle size on every PR. The `size-limit-action` GitHub Action provides inline PR comments showing bundle size changes.
