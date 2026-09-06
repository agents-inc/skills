# Performance — Code Splitting and Bundle Size

> Lazy routes, dynamic imports, tree shaking and budget enforcement. See [core.md](core.md) for runtime patterns.

---

## Pattern 3: Route-level lazy loading

```typescript
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Analytics = lazy(() => import("./pages/analytics"));
const Reports = lazy(() => import("./pages/reports"));

const PAGES = { dashboard: Dashboard, analytics: Analytics, reports: Reports } as const;

export function App({ page }: { page: keyof typeof PAGES }) {
  const Page = PAGES[page];

  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  );
}
```

**Why good:** each `import()` is a chunk boundary the bundler creates on its own, so a user who only
ever opens the dashboard never downloads analytics or reports. Whatever the router, the shape is the
same: `lazy` around the import, one `Suspense` above the component that renders.

```typescript
// Bad — every page in the first download
import { Dashboard } from "./pages/dashboard";
import { Analytics } from "./pages/analytics";
import { Reports } from "./pages/reports";
```

**Why bad:** the initial bundle is the sum of every route, and the slowest page sets the cost of the
fastest one.

**Split:** routes, heavy feature modules, dialogs, below-fold sections, admin areas.
**Do not split:** above-fold components, error boundaries, loading states — anything needed for the
first paint or for rendering a failure.

---

## Pattern 4: Deferring a heavy dependency

Throughout this section `"chart-library"` stands for whichever heavy dependency the path actually
needs — the shape is what transfers, not the package.

```typescript
// The charting library is a few hundred kilobytes and one screen uses it
async function renderChart(container: HTMLElement, data: ChartData) {
  const { createChart } = await import("chart-library");
  return createChart(container, data);
}
```

**Why good:** the weight is paid by the users who open the chart, at a moment they are already
waiting.

```typescript
// Bad — top-level import of a library one screen needs
import { createChart } from "chart-library";
```

**Why bad:** it is in the initial bundle whether or not the chart is ever shown, and it competes
with the code that renders the first screen.

Wrap the deferred call in a loading state. A dynamic import is a network request, so the interaction
that triggers it has a gap the user will otherwise read as a broken button.

---

## Tree shaking

```typescript
// Tree-shakeable: a named import from an ES module
import { debounce } from "utility-library";

// Not tree-shakeable: the namespace object forces the whole package in
import _ from "utility-library";
_.debounce(fn, 300);

// Not tree-shakeable: CommonJS is resolved at runtime, not statically
const { debounce } = require("utility-library");
```

**What it needs:**

- ES modules on both sides — a dependency that ships only CommonJS cannot be shaken
- Named exports, imported by name
- Side-effect-free modules, or a `sideEffects` field naming the ones that are not

```json
{ "sideEffects": ["*.css"] }
```

**Why good:** `"sideEffects": false` tells the bundler that dropping an unused module changes
nothing, which is what makes the elimination safe. Style imports are the usual exception — they
exist entirely for their side effect, so they are listed.

**Where it silently fails:** a barrel file re-exporting a whole directory pulls the directory in
whenever anything imports through it; a module that registers something at import time cannot be
dropped; and a package whose ESM build still requires a CommonJS dependency shakes only as far as
that boundary.

---

## Pattern 1: Enforcing the budgets

Budgets live beside the build and fail CI, so an oversized chunk is a red pull request rather than a
production discovery.

Bundle-size checkers read a manifest of the shape below, each under its own key — take the key name
from whichever checker is installed rather than from this example, which uses a neutral one.

```json
{
  "budgets": [
    { "name": "Main bundle", "path": "dist/index.js", "limit": "200 KB" },
    { "name": "Vendor bundle", "path": "dist/vendor.js", "limit": "150 KB" },
    {
      "name": "Dashboard route",
      "path": "dist/dashboard.js",
      "limit": "100 KB"
    }
  ]
}
```

**Why good:** per-artifact limits localise the failure — "the bundle grew" names nothing, where "the
dashboard route grew 40 KB" names the change that did it. The decisions worth carrying between
projects are which artifacts get their own line, what compression the limit is measured under, and
whether exceeding it warns or blocks.

Run the check on pull requests rather than only on the main branch. A budget discovered after merge
is a report; discovered before, it is a choice about the dependency that caused it.
