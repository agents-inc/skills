# Performance Optimization

**Auto-detection:** Core Web Vitals, bundle size optimization, LCP, FID, CLS, lazy loading, memoization, performance monitoring, web-vitals library

**When to use:**

- Optimizing Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Setting and enforcing bundle size budgets (< 200KB main bundle)
- Implementing React performance patterns (strategic memo, lazy loading, virtualization)
- Monitoring performance with web-vitals library in production

**Key patterns covered:**

- Core Web Vitals targets (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Bundle size budgets (< 200KB main, < 500KB total initial load)
- Strategic React optimization (memo/useMemo when needed, not everywhere - profile first)
- Image optimization (WebP/AVIF, lazy loading, Next.js Image component)

---

# Performance Standards

> **Quick Guide:** Build performance? Turborepo caching with >80% hit rate. Bundle budgets? < 200KB main bundle. Core Web Vitals? LCP < 2.5s, FID < 100ms, CLS < 0.1. React patterns? Strategic memo/useMemo, lazy loading, virtualization for 100+ items. Monitoring? Real User Monitoring with web-vitals library.

**CURRENT STATE: NO EXPLICIT PERFORMANCE BUDGETS DEFINED**

This document outlines **recommended best practices** for performance standards in modern web applications.

---

## Build Performance

**ACTUAL IMPLEMENTATION: Turborepo caching (see Build & Tooling - Turborepo Configuration)**

### Build Time Targets

**Targets:**

- **Full build** (cold cache): < 2 min
- **Incremental build** (warm cache): < 30s
- **Development rebuild** (HMR): < 5s
- **Production build**: < 5 min

### Cache Hit Ratios

**Target: > 80% cache hit rate**

**Improve cache hits:**

- Don't modify generated files manually
- Use deterministic builds (no timestamps in output)
- Declare all environment variables in `turbo.json`
- Use granular tasks (separate lint/test/build)

**Monitoring cache performance:**

```bash
# View Turborepo cache stats
turbo run build --summarize

# Check cache hit rate in CI logs
# Look for: "cache hit, replaying output"
```

### Parallel Execution

**ACTUAL: Turborepo executes tasks in parallel**

Builds multiple packages simultaneously, respects dependency graph.

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"] // Wait for dependencies
    }
  }
}
```

### TypeScript Build Performance

**Optimization strategies:**

1. **Incremental compilation**

   ```json
   {
     "compilerOptions": {
       "incremental": true,
       "tsBuildInfoFile": ".tsbuildinfo"
     }
   }
   ```

2. **Project references** (for monorepos)

   - Compile only changed projects
   - Faster type checking
   - Better IDE performance

3. **Skip lib check**
   ```json
   {
     "compilerOptions": {
       "skipLibCheck": true // Don't type-check node_modules
     }
   }
   ```

---

## Bundle Size Budgets

**RECOMMENDED: Set and enforce bundle size limits**

**CURRENT STATE: No bundle size budgets defined**

### Recommended Budgets

**JavaScript bundles:**

- **Main bundle**: < 200 KB (gzipped)
- **Vendor bundle**: < 150 KB (gzipped)
- **Route bundles**: < 100 KB each (gzipped)
- **Total initial load**: < 500 KB (gzipped)

**Why these limits:**

- 200 KB ≈ 1 second download on 3G
- Faster Time to Interactive (TTI)
- Better mobile performance

**CSS bundles:**

- **Main CSS**: < 50 KB (gzipped)
- **Critical CSS**: < 14 KB (inlined, fits in first TCP packet)

**Images:**

- **Hero images**: < 200 KB (use WebP/AVIF)
- **Thumbnails**: < 50 KB
- **Icons**: Use SVG or icon fonts

### Bundle Analysis

**Tools:**

**Next.js:**

```bash
# Install bundle analyzer
bun add -D @next/bundle-analyzer

# Analyze bundle
ANALYZE=true bun run build
```

**Vite:**

```bash
# Built-in bundle analysis
bun run build -- --mode analyze

# Or use rollup-plugin-visualizer
bun add -D rollup-plugin-visualizer
```

**What to look for:**

- Largest dependencies (consider alternatives)
- Duplicate packages (fix with syncpack)
- Unused code (improve tree shaking)
- Large vendor chunks (split into smaller chunks)

### Code Splitting Strategies

**1. Route-based splitting** (automatic in Next.js)

```typescript
// Automatic code splitting per page
pages/
├── index.tsx      → index.js
├── about.tsx      → about.js
└── dashboard.tsx  → dashboard.js
```

**2. Component lazy loading**

```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Spinner />}>
  <HeavyComponent />
</Suspense>
```

**3. Dynamic imports for large libraries**

```typescript
// ❌ BAD: Import large library upfront
import _ from "lodash";

// ✅ GOOD: Dynamic import when needed
const loadLodash = async () => {
  const _ = await import("lodash");
  return _;
};
```

**4. Vendor chunk splitting**

```javascript
// next.config.js or vite.config.js
optimization: {
  splitChunks: {
    cacheGroups: {
      vendor: {
        test: /node_modules/,
        chunks: 'all',
        name: 'vendor',
      },
    },
  },
}
```

### Tree Shaking

**Requirements:**

- ES modules (not CommonJS)
- Named exports (not default exports)
- Side-effect-free code

**Mark packages as side-effect-free:**

```json
{
  "sideEffects": false
}
```

**Or specify files with side effects:**

```json
{
  "sideEffects": ["*.css", "*.scss", "*.global.js"]
}
```

**Common tree shaking issues:**

- CommonJS imports (`require()`) - not tree-shakeable
- Barrel exports (`index.ts` re-exporting everything) - imports everything
- Side effects in module scope - prevents tree shaking

### Bundle Budget Enforcement

**MANDATORY: Set up basic bundle size checking**

**Simplest approach - Add to package.json:**

```json
{
  "scripts": {
    "build": "vite build",
    "build:check": "vite build && bun run check:size"
  },
  "bundlesize": [
    {
      "path": "./dist/**/*.js",
      "maxSize": "200 KB",
      "compression": "gzip"
    }
  ]
}
```

**Install bundlesize:**

```bash
bun add -D bundlesize
```

**Add to CI (GitHub Actions):**

```yaml
# .github/workflows/ci.yml
- name: Build
  run: bun run build

- name: Check bundle size
  run: bunx bundlesize
```

**For more advanced tracking, use size-limit:**

```bash
bun add -D @size-limit/preset-app
```

```json
{
  "size-limit": [
    {
      "path": "dist/index.js",
      "limit": "200 KB"
    }
  ]
}
```

---

## Runtime Performance (Core Web Vitals)

**TARGET: Pass all Core Web Vitals thresholds**

### Core Web Vitals Targets

**Google's recommended thresholds:**

1. **LCP (Largest Contentful Paint): < 2.5s**

   - Measures loading performance
   - When largest element becomes visible
   - **How to improve:**
     - Optimize images (WebP, lazy loading)
     - Minimize render-blocking resources
     - Use CDN for static assets
     - Server-side rendering (SSR) or Static Site Generation (SSG)

2. **FID (First Input Delay): < 100ms** → **INP (Interaction to Next Paint): < 200ms** (new metric)

   - Measures interactivity
   - Time from user interaction to browser response
   - **How to improve:**
     - Minimize JavaScript execution time
     - Code splitting (load less JS upfront)
     - Use web workers for heavy computation
     - Debounce expensive operations

3. **CLS (Cumulative Layout Shift): < 0.1**
   - Measures visual stability
   - Prevents unexpected layout shifts
   - **How to improve:**
     - Set image/video dimensions
     - Reserve space for dynamic content
     - Avoid injecting content above existing content
     - Use `font-display: swap` with size-adjust

### Additional Performance Metrics

**4. FCP (First Contentful Paint): < 1.8s**

- When first content appears
- Improves perceived performance

**5. TTI (Time to Interactive): < 3.8s**

- When page becomes fully interactive
- Critical for mobile users

**6. TBT (Total Blocking Time): < 300ms**

- Sum of blocking time between FCP and TTI
- Indicates main thread blocking

### Performance Monitoring

**Tools:**

**Development:**

- Chrome DevTools Lighthouse
- Chrome DevTools Performance tab
- React DevTools Profiler

**Production:**

- **Web Vitals library** (measure Core Web Vitals)
- **Google Analytics** (send Web Vitals data)
- **Sentry Performance Monitoring**
- **Vercel Analytics** (automatic for Vercel deployments)

**Implementation:**

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from "web-vitals";

function sendToAnalytics(metric: Metric) {
  // Send to your analytics endpoint
  fetch("/analytics", {
    method: "POST",
    body: JSON.stringify(metric),
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Performance Budgets

**Set performance budgets in CI:**

```yaml
# .github/workflows/lighthouse-ci.yml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: |
      https://example.com
    budgetPath: ./budget.json
    uploadArtifacts: true
```

**budget.json:**

```json
[
  {
    "path": "/*",
    "timings": [
      {
        "metric": "first-contentful-paint",
        "budget": 1800
      },
      {
        "metric": "largest-contentful-paint",
        "budget": 2500
      },
      {
        "metric": "cumulative-layout-shift",
        "budget": 0.1
      }
    ],
    "resourceSizes": [
      {
        "resourceType": "script",
        "budget": 200
      },
      {
        "resourceType": "stylesheet",
        "budget": 50
      }
    ]
  }
]
```

---

## React Performance Patterns

**RECOMMENDED: Use performance optimizations strategically**

### When to Use React.memo

**Use React.memo when:**

- Component renders frequently with same props
- Component is expensive to render
- Component is deep in the tree

**Don't use React.memo when:**

- Props change frequently
- Component is cheap to render
- Premature optimization (profile first!)

**Example:**

```typescript
// ✅ GOOD: Memoize expensive component
export const ExpensiveChart = React.memo(({ data }: Props) => {
  // Complex charting logic
  return <Chart data={data} />;
});

// ❌ BAD: Memoizing cheap component
export const SimpleButton = React.memo(({ label }: Props) => {
  return <button>{label}</button>;  // Too simple to benefit
});
```

### When to Use useMemo

**Use useMemo for:**

- Expensive calculations (filtering, sorting large arrays)
- Creating objects/arrays passed as props to memoized components
- Preventing referential equality issues

**Don't use useMemo for:**

- Simple calculations (addition, string concatenation)
- Values used only in JSX (not passed as props)
- Premature optimization

**Example:**

```typescript
// ✅ GOOD: Memoize expensive calculation
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);

// ❌ BAD: Memoizing simple calculation
const doubled = useMemo(() => value * 2, [value]); // Overhead > benefit
```

### When to Use useCallback

**Use useCallback for:**

- Functions passed to memoized child components
- Functions used in dependency arrays
- Event handlers in optimized components

**Don't use useCallback for:**

- Functions not passed to children
- Functions that change on every render anyway
- Inline event handlers in non-optimized components

**Example:**

```typescript
// ✅ GOOD: Callback passed to memoized child
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

return <MemoizedButton onClick={handleClick} />;

// ❌ BAD: Callback not passed to children
const handleChange = useCallback((e) => {
  setValue(e.target.value);
}, []);  // Unnecessary, not passed to memoized component

return <input onChange={handleChange} />;
```

### Virtual Scrolling

**Use virtual scrolling when:**

- Rendering > 100 items
- Items have consistent height
- List is scrollable

**Libraries:**

- **react-window** - Lightweight, simple
- **react-virtuoso** - Feature-rich, dynamic heights
- **TanStack Virtual** - Headless, flexible

**Benefits:**

- Constant DOM size (only renders visible items)
- Smooth scrolling with 100K+ items
- Dramatically reduced memory usage

### Lazy Loading Components

**Pattern: Load components on demand**

```typescript
import { lazy, Suspense } from 'react';

// ✅ Route-based lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// ✅ Conditional lazy loading
const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

**Benefits:**

- Smaller initial bundle
- Faster Time to Interactive
- Load code when needed

### Debouncing and Throttling

**Debouncing: Wait until user stops**

- Search inputs
- Form validation
- Auto-save

**Throttling: Limit execution rate**

- Scroll handlers
- Resize handlers
- Mouse move tracking

**Libraries:**

- `use-debounce` (React hooks)
- `lodash.debounce`
- `lodash.throttle`

---

## Performance Monitoring

**RECOMMENDED: Monitor performance in production**

### Real User Monitoring (RUM)

**What to monitor:**

- Core Web Vitals (LCP, FID/INP, CLS)
- Page load times
- API response times
- JavaScript errors
- Render times

**Tools:**

- **Google Analytics 4** - Free, basic RUM
- **Sentry Performance** - Error tracking + performance
- **Vercel Analytics** - Automatic for Vercel
- **New Relic** - Comprehensive APM
- **Datadog RUM** - Real User Monitoring

### Performance Budgets in CI

**Fail builds that regress performance:**

```yaml
# .github/workflows/performance.yml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: https://staging.example.com
    budgetPath: ./budget.json
    uploadArtifacts: true
```

**Benefits:**

- Catch performance regressions early
- Prevent shipping slow code
- Enforce standards

### Metrics to Track

**Build metrics:**

- Build duration
- Bundle sizes
- Cache hit rate

**Runtime metrics:**

- Core Web Vitals (LCP, FID/INP, CLS)
- Time to First Byte (TTFB)
- API response times
- JavaScript error rate
- Memory usage

**User experience metrics:**

- Page views
- Bounce rate
- Session duration
- Conversion rate (impacted by performance)

---

## Image Optimization

**CRITICAL: Images are often the largest assets**

### Modern Image Formats

**Format selection:**

1. **AVIF** - Best compression (30-50% smaller than JPEG)

   - Limited browser support (93% as of 2024)
   - Use with fallbacks

2. **WebP** - Good compression (25-35% smaller than JPEG)

   - Excellent browser support (97%)
   - Recommended default

3. **JPEG** - Universal fallback
   - Supported everywhere
   - Use for compatibility

**Implementation:**

```html
<picture>
  <source srcset="/image.avif" type="image/avif" />
  <source srcset="/image.webp" type="image/webp" />
  <img src="/image.jpg" alt="Description" loading="lazy" />
</picture>
```

### Lazy Loading

**Native lazy loading:**

```html
<img src="/image.jpg" alt="Description" loading="lazy" />
```

**When to use:**

- Below-the-fold images
- Images in long pages
- Carousels and galleries

**When NOT to use:**

- Above-the-fold images (use `loading="eager"` or omit)
- Images needed for initial render

### Responsive Images

**Use srcset for different screen sizes:**

```html
<img
  src="/image-800.jpg"
  srcset="/image-400.jpg 400w, /image-800.jpg 800w, /image-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="Responsive image"
/>
```

### Next.js Image Component

**Automatic optimization:**

```typescript
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority  // For above-fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

**Benefits:**

- Automatic format selection (AVIF/WebP)
- Lazy loading by default
- Prevents layout shift (width/height required)
- Blur placeholder for better UX

---

## Common Anti-Patterns

**❌ NEVER do these:**

- Not setting performance budgets (bundle sizes grow unnoticed)
- Memoizing everything (premature optimization, overhead)
- Not lazy loading routes (large initial bundles)
- Importing entire libraries (`import _ from 'lodash'`)
- Not optimizing images (WebP, lazy loading, responsive)
- Blocking main thread with heavy computation
- Not measuring performance (you can't improve what you don't measure)
- Ignoring Core Web Vitals
- Not using code splitting
- Loading all data upfront (paginate, infinite scroll)

---

## Performance Checklist

**Build performance:**

- [ ] Turborepo caching enabled (> 80% hit rate)
- [ ] TypeScript incremental compilation
- [ ] Bundle size budgets defined and enforced
- [ ] Bundle analyzer run regularly
- [ ] Tree shaking configured correctly

**Runtime performance:**

- [ ] Core Web Vitals monitored (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Images optimized (WebP/AVIF, lazy loading, responsive)
- [ ] Code splitting implemented (route-based + dynamic imports)
- [ ] Critical CSS inlined (< 14 KB)
- [ ] JavaScript execution optimized (debouncing, web workers)

**React performance:**

- [ ] Virtual scrolling for long lists (> 100 items)
- [ ] Lazy loading for route components
- [ ] Memoization used strategically (not everywhere)
- [ ] Profiling done before optimization

**Monitoring:**

- [ ] Real User Monitoring (RUM) in production
- [ ] Performance budgets in CI
- [ ] Lighthouse CI running on PRs
- [ ] Error tracking with performance context

---

## Resources

**Official documentation:**

- Core Web Vitals: https://web.dev/vitals/
- Lighthouse: https://developers.google.com/web/tools/lighthouse
- React Performance: https://react.dev/learn/render-and-commit

**Tools:**

- web-vitals library: https://github.com/GoogleChrome/web-vitals
- Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci
- Bundle Analyzer: https://www.npmjs.com/package/@next/bundle-analyzer

**Performance guides:**

- Web.dev: https://web.dev/fast/
- Patterns.dev: https://www.patterns.dev/posts/performance-patterns/


---

# Performance Standards - Examples

---

## Build Performance

### Example: Turborepo Cache Configuration

**ACTUAL from turbo.json:**

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["DATABASE_URL", "NODE_ENV"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "src/**/*.tsx", "src/**/*.ts"]
    }
  }
}
```

**Why:** Proper outputs ensure cache hits. Environment variables in `env` array invalidate cache when changed.

---

### Example: TypeScript Incremental Compilation

**ACTUAL from packages/typescript-config/base.json:**

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,
    "composite": true
  }
}
```

**Why:** Incremental compilation speeds up rebuilds. Skip lib check avoids type-checking node_modules.

---

### Example: Monitoring Build Performance

```bash
# View Turborepo summary
turbo run build --summarize

# Output shows:
# - Tasks run
# - Cache hits vs misses
# - Execution time per task
# - Total time saved by cache
```

**Why:** Track cache hit rate. Identify slow tasks. Monitor build performance trends.

---

## Bundle Size Budgets

### Example: Code Splitting with React.lazy

```typescript
// ❌ BAD: Importing everything upfront
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';

// ✅ GOOD: Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));

function App() {
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

**Why:** Splits bundle. Loads on demand. Faster initial load. User only downloads what they need.

**Edge Cases:**

- Preload critical routes: `<link rel="prefetch" href="/analytics.js" />`
- Handle loading errors with ErrorBoundary
- Show meaningful fallback UI during load

---

## Runtime Performance

### Example: Lighthouse CI Configuration

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
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

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

**lighthouse-budget.json:**

```json
[
  {
    "path": "/*",
    "timings": [
      {
        "metric": "first-contentful-paint",
        "budget": 1800
      },
      {
        "metric": "largest-contentful-paint",
        "budget": 2500
      },
      {
        "metric": "cumulative-layout-shift",
        "budget": 0.1
      },
      {
        "metric": "total-blocking-time",
        "budget": 300
      }
    ],
    "resourceSizes": [
      {
        "resourceType": "script",
        "budget": 200
      },
      {
        "resourceType": "stylesheet",
        "budget": 50
      },
      {
        "resourceType": "image",
        "budget": 200
      }
    ]
  }
]
```

**Why:** Automated performance testing. Catch regressions in CI. Enforce budgets.

---

### Example: Preventing Layout Shift (CLS)

```typescript
// ❌ BAD: No dimensions, causes layout shift
<img src="/hero.jpg" alt="Hero" />

// ✅ GOOD: Set dimensions, reserves space
<img
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  style={{ maxWidth: '100%', height: 'auto' }}
/>

// ✅ BETTER: Next.js Image with automatic sizing
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
/>
```

**Why:** Prevents content jumping. Better user experience. Improves CLS score.

---

## React Performance Patterns

### Example: Memoization for Expensive Calculations

```typescript
// ❌ BAD: Recalculates on every render
function DataTable({ rows, filters }: Props) {
  const filteredRows = rows.filter(row =>
    filters.every(f => f.predicate(row))
  );
  const sortedRows = filteredRows.sort((a, b) =>
    compareValues(a[sortColumn], b[sortColumn])
  );

  return <Table data={sortedRows} />;
}

// ✅ GOOD: Memoize expensive operations
function DataTable({ rows, filters }: Props) {
  const filteredRows = useMemo(
    () => rows.filter(row => filters.every(f => f.predicate(row))),
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

**Why:** Prevents unnecessary recalculation. Only recomputes when dependencies change. Dramatically faster for large datasets.

**Edge Cases:**

- Don't memoize everything - has overhead
- Profile first - optimize actual bottlenecks
- Consider virtualizing large lists instead

---

### Example: Virtual Scrolling for Long Lists

```typescript
// ❌ BAD: Rendering 10,000 DOM nodes
function ProductList({ products }: { products: Product[] }) {
  return (
    <div className="product-list">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// ✅ GOOD: Virtual scrolling with react-window
import { FixedSizeList } from 'react-window';

function ProductList({ products }: { products: Product[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={products.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

**Why:** Only renders visible items. Constant DOM size. Smooth scrolling even with 100K+ items.

**Edge Cases:**

- Use `VariableSizeList` for dynamic heights
- Handle item height changes with `resetAfterIndex`
- Consider `react-virtuoso` for complex layouts

---

### Example: Debouncing User Input

```typescript
// ❌ BAD: Triggering search on every keystroke
function SearchInput() {
  const [query, setQuery] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    performSearch(e.target.value); // Fires every keystroke!
  };

  return <input value={query} onChange={handleChange} />;
}

// ✅ GOOD: Debounced search
import { useDebouncedCallback } from 'use-debounce';

function SearchInput() {
  const [query, setQuery] = useState('');

  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      performSearch(value);
    },
    500 // Wait 500ms after user stops typing
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return <input value={query} onChange={handleChange} />;
}
```

**Why:** Reduces API calls. Better UX. Prevents race conditions. Saves server resources.

**Edge Cases:**

- Cancel debounced calls on unmount
- Show loading state during debounce
- Consider immediate + trailing for better UX

---

## Performance Monitoring

### Example: Real User Monitoring with web-vitals

```typescript
// lib/analytics.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

interface AnalyticsEvent {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function sendToAnalytics(metric: Metric) {
  const event: AnalyticsEvent = {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    rating: metric.rating,
  };

  // Send to Google Analytics
  if (typeof gtag === 'function') {
    gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
    });
  }

  // Send to custom analytics endpoint
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(console.error);
}

// Initialize Web Vitals tracking
export function initWebVitals() {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}
```

**Why:** Track real user performance. Identify slow pages. Monitor trends over time.

---

### Example: Bundle Size Monitoring in CI

```json
// package.json
{
  "scripts": {
    "size": "size-limit",
    "size:why": "size-limit --why"
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

**Why:** Prevent bundle bloat. Catch size regressions. Enforce budgets automatically.

---

### Example: Performance Profiling in React DevTools

```typescript
// Enable profiling in production builds
// next.config.js or vite.config.js
export default {
  reactStrictMode: true,
  productionBrowserSourceMaps: true, // Enable source maps for profiling
  
  webpack: (config, { dev }) => {
    // Enable React Profiler in production
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom
: 'react-dom/profiling',
        'scheduler/tracing': 'scheduler/tracing-profiling',
      };
    }
    return config;
  },
};
```

**Usage:**
1. Open React DevTools
2. Go to Profiler tab
3. Click Record
4. Interact with app
5. Stop recording
6. Analyze flame graph

**What to look for:**
- Long render times (> 16ms)
- Unnecessary re-renders
- Expensive components
- Render cascades

**Why:** Identify performance bottlenecks. Optimize render performance.

---

## Image Optimization

### Example: Modern Image Formats with Fallbacks

```html
<!-- Progressive enhancement with modern formats -->
<picture>
  <!-- AVIF: Best compression (30-50% smaller) -->
  <source
    srcset="/images/hero-400.avif 400w,
            /images/hero-800.avif 800w,
            /images/hero-1200.avif 1200w"
    type="image/avif"
  />
  
  <!-- WebP: Good compression (25-35% smaller) -->
  <source
    srcset="/images/hero-400.webp 400w,
            /images/hero-800.webp 800w,
            /images/hero-1200.webp 1200w"
    type="image/webp"
  />
  
  <!-- JPEG: Universal fallback -->
  <img
    src="/images/hero-800.jpg"
    srcset="/images/hero-400.jpg 400w,
            /images/hero-800.jpg 800w,
            /images/hero-1200.jpg 1200w"
    sizes="(max-width: 600px) 400px,
           (max-width: 1200px) 800px,
           1200px"
    alt="Hero image"
    loading="lazy"
    decoding="async"
    width="1200"
    height="600"
  />
</picture>
```

**Why:** Smaller file sizes. Browser chooses best format. Fallback for old browsers.

---

### Example: Next.js Image Component (Recommended)

```typescript
import Image from 'next/image';

// Above-the-fold image (priority)
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority  // Load immediately, no lazy loading
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>

// Below-the-fold image (lazy loaded)
<Image
  src="/feature.jpg"
  alt="Feature image"
  width={800}
  height={400}
  loading="lazy"  // Default behavior
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>

// Responsive image with fill
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image
    src="/background.jpg"
    alt="Background"
    fill
    style={{ objectFit: 'cover' }}
    sizes="100vw"
    priority={false}
  />
</div>
```

**Benefits:**
- Automatic format selection (AVIF/WebP)
- Responsive images (srcset generated automatically)
- Lazy loading by default
- Blur placeholder for better UX
- Prevents layout shift (width/height required)

---

### Example: Image Optimization Script

```bash
#!/bin/bash
# scripts/optimize-images.sh

# Convert images to WebP and AVIF
for img in public/images/*.{jpg,png}; do
  filename="${img%.*}"
  
  # Convert to WebP
  cwebp -q 80 "$img" -o "${filename}.webp"
  
  # Convert to AVIF
  avif -q 80 "$img" -o "${filename}.avif"
  
  echo "Optimized: $img"
done
```

```json
// package.json
{
  "scripts": {
    "optimize:images": "bash scripts/optimize-images.sh"
  }
}
```

**Why:** Automated image optimization. Consistent quality. Smaller file sizes.

