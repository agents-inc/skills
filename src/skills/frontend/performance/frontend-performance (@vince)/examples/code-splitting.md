# Code Splitting Strategies

> Lazy loading, tree shaking, and bundle budgets. See [core.md](core.md) for React runtime patterns.

---

## Bundle Analysis

```bash
# Next.js bundle analysis
ANALYZE=true bun run build

# Vite bundle analysis
bun run build -- --mode analyze
```

**What to look for:**

- Largest dependencies (consider lighter alternatives)
- Duplicate packages (fix with syncpack)
- Unused code (improve tree shaking)
- Large vendor chunks (split into smaller chunks)

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
const DEBOUNCE_DELAY_MS = 500;

async function loadLodash() {
  const { default: _ } = await import("lodash");
  return _;
}

// Use when needed
const handleHeavyOperation = async () => {
  const _ = await loadLodash();
  _.debounce(() => {}, DEBOUNCE_DELAY_MS);
};
```

**Why good:** Library only loaded when needed, smaller initial bundle, user doesn't pay for unused code

### Bad Example - Import Large Library Upfront

```typescript
import _ from "lodash";

const DEBOUNCE_DELAY_MS = 500;

const handleHeavyOperation = () => {
  _.debounce(() => {}, DEBOUNCE_DELAY_MS);
};
```

**Why bad:** Entire lodash (~70KB) loaded upfront even if never used, increases initial bundle size, slower Time to Interactive

---

## Tree Shaking Configuration

### Good Example - Mark Packages as Side-Effect-Free

```json
// package.json
{
  "sideEffects": false
}

// Or specify files with side effects
{
  "sideEffects": ["*.css", "*.scss", "*.global.js"]
}
```

**Why good:** Enables bundler to remove unused exports, reduces bundle size by 20-40%, only includes imported code

**Requirements for tree shaking:**

- ES modules (not CommonJS)
- Named exports (not default exports)
- Side-effect-free code

**Common tree shaking issues:**

- CommonJS imports (`require()`) - not tree-shakeable
- Barrel exports (`index.ts` re-exporting everything) - imports everything
- Side effects in module scope - prevents tree shaking

---

## Bundle Budget Enforcement

### Good Example - Size Limits in package.json

```json
// package.json
{
  "scripts": {
    "build": "vite build",
    "build:check": "vite build && bun run check:size"
  },
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

---

## CI Workflow for Bundle Size

```yaml
# .github/workflows/size.yml
name: Bundle Size Check

on:
  pull_request:
    branches: [main]

jobs:
  size:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build

      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Why good:** Catches bundle size regressions in PR reviews, prevents shipping bloated code, enforces budgets automatically
