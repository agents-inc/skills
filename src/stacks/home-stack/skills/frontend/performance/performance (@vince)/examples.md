# Performance Examples

> Complete code examples for all performance patterns. Each example includes good/bad comparisons with explanations.

---

## Turborepo Configuration

### Good: Turborepo config with proper outputs and env vars

```json
// turbo.json
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

**Why good:** Proper outputs ensure cache hits when build artifacts haven't changed, env array invalidates cache when environment changes, excluding .next/cache prevents caching the cache itself

### Bad: Missing outputs and env declarations

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]
      // Missing outputs - cache won't work
      // Missing env - env changes won't invalidate cache
    }
  }
}
```

**Why bad:** Cache won't replay outputs without explicit declaration, environment variable changes won't invalidate cache leading to stale builds, missing inputs means cache key doesn't account for file changes

### Monitoring Cache Performance

```bash
#!/bin/bash
# scripts/monitor-cache.sh

# View Turborepo cache stats
turbo run build --summarize

# Output shows:
# - Tasks run
# - Cache hits vs misses
# - Execution time per task
# - Total time saved by cache
```

**Cache hit improvement strategies:**

- Don't modify generated files manually (breaks determinism)
- Use deterministic builds (no timestamps in output)
- Declare all environment variables in `turbo.json` env array
- Use granular tasks (separate lint/test/build for better caching)

### TypeScript Build Performance

```json
// ✅ GOOD: TypeScript config optimized for build performance
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,
    "composite": true
  }
}
```

**Why good:** Incremental compilation caches type information between builds, skipLibCheck avoids type-checking node_modules (80%+ speedup), composite enables project references for monorepo optimization

```json
// ❌ BAD: No incremental compilation or skip lib check
{
  "compilerOptions": {
    "strict": true
    // Missing incremental: true - full type check every time
    // Missing skipLibCheck - wastes time checking node_modules
  }
}
```

**Why bad:** Type-checks all files on every build (slow), checks node_modules types unnecessarily (massive overhead), no caching between builds

---

## Code Splitting Strategies

### Bundle Analysis

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

### Good: Route-based lazy loading

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

### Bad: Importing everything upfront

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

### Good: Dynamic import for heavy library

```typescript
const DEBOUNCE_DELAY_MS = 500;

async function loadLodash() {
  const { default: _ } = await import('lodash');
  return _;
}

// Use when needed
const handleHeavyOperation = async () => {
  const _ = await loadLodash();
  _.debounce(() => {}, DEBOUNCE_DELAY_MS);
};
```

**Why good:** Library only loaded when needed, smaller initial bundle, user doesn't pay for unused code

### Bad: Import large library upfront

```typescript
import _ from 'lodash';

const DEBOUNCE_DELAY_MS = 500;

const handleHeavyOperation = () => {
  _.debounce(() => {}, DEBOUNCE_DELAY_MS);
};
```

**Why bad:** Entire lodash (~70KB) loaded upfront even if never used, increases initial bundle size, slower Time to Interactive

### Tree Shaking Configuration

```json
// ✅ GOOD: Mark packages as side-effect-free for tree shaking
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

### Bundle Budget Enforcement

```json
// ✅ GOOD: Bundle size budgets in package.json
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

### CI Workflow for Bundle Size

```yaml
# ✅ GOOD: CI workflow checking bundle size
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

---

## Core Web Vitals Examples

### LCP: Good - Optimize LCP with Next.js Image priority

```typescript
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
      priority  // Preload for LCP
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Priority flag preloads image for faster LCP, automatic WebP/AVIF format selection reduces file size by 30-50%, blur placeholder improves perceived performance

### LCP: Bad - Large hero image without optimization

```typescript
export function Hero() {
  return (
    <img src="/hero-4k.jpg" alt="Hero" />
    // No optimization, no preload, blocks LCP
  );
}
```

**Why bad:** Large unoptimized image (2-5MB) blocks LCP, no format optimization, no lazy loading, no preload

### FID/INP: Good - Web worker for heavy computation

```typescript
// workers/process-data.ts
import type { ProcessDataMessage } from './types';

self.onmessage = (e: MessageEvent<ProcessDataMessage>) => {
  const { data } = e.data;

  // Heavy computation doesn't block main thread
  const result = processLargeDataset(data);

  self.postMessage({ result });
};

// Component using web worker
import { useEffect, useState } from 'react';

const WORKER_TIMEOUT_MS = 5000;

export function DataProcessor({ data }: Props) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const worker = new Worker(new URL('./workers/process-data.ts', import.meta.url));

    worker.postMessage({ data });

    worker.onmessage = (e) => {
      setResult(e.data.result);
    };

    const timeout = setTimeout(() => worker.terminate(), WORKER_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [data]);

  return <div>{result}</div>;
}
```

**Why good:** Heavy computation runs off main thread, main thread stays responsive to user input, prevents FID/INP issues

### FID/INP: Bad - Heavy computation on main thread

```typescript
export function DataProcessor({ data }: Props) {
  // Blocks main thread for seconds
  const result = processLargeDataset(data);

  return <div>{result}</div>;
}
```

**Why bad:** Blocks main thread during computation, user interactions delayed by processing time, causes high FID/INP scores

### CLS: Good - Image with dimensions to prevent CLS

```typescript
import Image from 'next/image';

export function ProductImage({ src, alt }: Props) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={600}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}
```

**Why good:** Explicit dimensions reserve space before image loads, prevents layout shift when image appears, blur placeholder improves perceived performance

### CLS: Bad - No dimensions, causes layout shift

```html
<!-- ❌ BAD: No dimensions, causes layout shift -->
<img src="/hero.jpg" alt="Hero" />
```

**Why bad:** No space reserved for image, content jumps when image loads, causes CLS score increase

### CLS: Good - Font loading with size-adjust

```css
/* ✅ GOOD: Font loading with size-adjust to prevent CLS */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom-font.woff2') format('woff2');
  font-display: swap;
  size-adjust: 95%; /* Match fallback font metrics */
}

body {
  font-family: 'CustomFont', Arial, sans-serif;
}
```

**Why good:** Size-adjust prevents layout shift when custom font loads, font-display swap shows fallback immediately, prevents invisible text (FOIT)

### CLS: Bad - Font loading without size-adjust

```css
/* ❌ BAD: Font loading without size-adjust */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom-font.woff2') format('woff2');
  /* No font-display - defaults to block */
  /* No size-adjust - causes layout shift */
}
```

**Why bad:** Text invisible while font loads (FOIT), layout shifts when custom font loads with different metrics, poor perceived performance

### Production Monitoring with web-vitals

```typescript
// ✅ GOOD: Production web-vitals monitoring
// lib/analytics.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import type { Metric } from 'web-vitals';

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
    keepalive: true, // Ensures request completes even if page unloads
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

**Why good:** Tracks real user performance (not lab metrics), measures all Core Web Vitals, sends to analytics for trend analysis, keepalive ensures data sent even on page unload

```typescript
// pages/_app.tsx
import { useEffect } from 'react';
import { initWebVitals } from '../lib/analytics';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    initWebVitals();
  }, []);

  return <Component {...pageProps} />;
}
```

**Why good:** Initializes on app mount, tracks metrics throughout session, runs in production to measure real users

---

## React Performance Optimization

### Memoization Constants

```typescript
// constants/performance.ts
export const MEMOIZATION_THRESHOLDS = {
  EXPENSIVE_RENDER_MS: 5,
  VIRTUALIZATION_ITEM_COUNT: 100,
  DEBOUNCE_SEARCH_MS: 500,
  THROTTLE_SCROLL_MS: 100,
} as const;
```

### React.memo: Good - Memoize expensive component

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

### React.memo: Bad - Memoizing cheap component

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

**When not to use:**

- Props change frequently (memoization never helps)
- Component is cheap to render (overhead > benefit)
- Before profiling (premature optimization)

### useMemo: Good - Memoize expensive data operations

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

### useMemo: Bad - Recalculates on every render

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

### useMemo: Bad - Memoizing simple calculation

```typescript
const doubled = useMemo(() => value * 2, [value]);
```

**Why bad:** Memoization overhead exceeds calculation cost, adds complexity for trivial operation

**When to use useMemo:**

- Expensive calculations (filtering, sorting large arrays > 1000 items)
- Creating objects/arrays passed to memoized components
- Preventing referential equality issues

**When not to use:**

- Simple calculations (addition, string concatenation)
- Values used only in JSX (not passed as props)
- Before profiling

### useCallback: Good - Callback passed to memoized child

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

### useCallback: Bad - Callback not passed to memoized component

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

**When not to use:**

- Functions not passed to memoized children
- Functions that change on every render anyway
- Inline event handlers in non-optimized components

### Virtual Scrolling: Good - react-window

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

### Virtual Scrolling: Bad - Rendering 10,000 DOM nodes

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

### Debouncing: Good - Debounced search

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

### Debouncing: Bad - Triggering search on every keystroke

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

---

## Image Optimization

### Image Format Constants

```typescript
// constants/image.ts
export const IMAGE_FORMATS = {
  AVIF_COMPRESSION_PERCENT: 40, // 30-50% smaller than JPEG
  WEBP_COMPRESSION_PERCENT: 30, // 25-35% smaller than JPEG
  BROWSER_SUPPORT_AVIF_PERCENT: 93,
  BROWSER_SUPPORT_WEBP_PERCENT: 97,
} as const;

export const IMAGE_SIZE_BUDGETS_KB = {
  HERO: 200,
  THUMBNAIL: 50,
} as const;
```

**Format priority:**

1. **AVIF** - Best compression (30-50% smaller than JPEG)
   - Browser support: 93% (2024)
   - Use with fallbacks

2. **WebP** - Good compression (25-35% smaller than JPEG)
   - Browser support: 97%
   - Recommended default

3. **JPEG** - Universal fallback
   - Supported everywhere

### Good: Progressive enhancement with multiple formats

```html
<picture>
  <!-- AVIF: Best compression (30-50% smaller) -->
  <source
    srcset="/images/hero-400.avif 400w, /images/hero-800.avif 800w, /images/hero-1200.avif 1200w"
    type="image/avif"
  />

  <!-- WebP: Good compression (25-35% smaller) -->
  <source
    srcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w"
    type="image/webp"
  />

  <!-- JPEG: Universal fallback -->
  <img
    src="/images/hero-800.jpg"
    srcset="/images/hero-400.jpg 400w, /images/hero-800.jpg 800w, /images/hero-1200.jpg 1200w"
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

**Why good:** Browser chooses best supported format (AVIF > WebP > JPEG), serves appropriate size for viewport, smaller file sizes improve LCP, dimensions prevent CLS

### Bad: Single format, no responsive sizes

```html
<img src="/images/hero-4k.jpg" alt="Hero" />
```

**Why bad:** Serves 4K image to mobile (wasted bandwidth), no modern format optimization (30-50% larger files), no lazy loading (blocks LCP), no dimensions (causes CLS)

### Lazy Loading Images

```html
<!-- ✅ GOOD: Lazy load below-fold images -->
<img
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  decoding="async"
  width="800"
  height="400"
/>
```

**Why good:** Defers loading until image near viewport, reduces initial page weight, faster Time to Interactive

```html
<!-- ❌ BAD: Lazy loading above-fold image -->
<img
  src="/hero.jpg"
  alt="Hero"
  loading="lazy"
  width="1200"
  height="600"
/>
```

**Why bad:** Delays LCP element, poor perceived performance, lazy loading adds overhead for critical images

**When to use lazy loading:**

- Below-the-fold images
- Images in long pages
- Carousels and galleries

**When NOT to use:**

- Above-the-fold images (use `loading="eager"` or priority)
- Images needed for initial render

### Next.js Image Component

```typescript
// ✅ GOOD: Next.js Image with priority for above-fold
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero image"
      width={1200}
      height={600}
      priority  // Preload for LCP
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Automatic format selection (AVIF/WebP), prevents layout shift (width/height required), blur placeholder improves perceived performance, priority flag preloads for LCP

```typescript
// ✅ GOOD: Next.js Image with lazy loading for below-fold
import Image from 'next/image';

export function FeatureImage() {
  return (
    <Image
      src="/feature.jpg"
      alt="Feature"
      width={800}
      height={400}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    />
  );
}
```

**Why good:** Lazy loads by default (reduces initial page weight), blur placeholder shows while loading, automatic responsive images

**Benefits:**

- Automatic format selection (AVIF/WebP)
- Lazy loading by default
- Prevents layout shift (width/height required)
- Blur placeholder for better UX

### Image Optimization Automation

```bash
#!/bin/bash
# scripts/optimize-images.sh

# Convert images to WebP and AVIF
for img in public/images/*.{jpg,png}; do
  filename="${img%.*}"

  # Convert to WebP (quality 80)
  cwebp -q 80 "$img" -o "${filename}.webp"

  # Convert to AVIF (quality 80)
  avif -q 80 "$img" -o "${filename}.avif"

  echo "Optimized: $img"
done
```

```json
// package.json
{
  "scripts": {
    "optimize:images": "bash scripts/optimize-images.sh",
    "prebuild": "bun run optimize:images"
  }
}
```

**Why good:** Automated image optimization in build pipeline, consistent quality across all images, no manual optimization needed

---

## Lighthouse CI

### Budget Configuration

```json
// lighthouse-budget.json
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

### GitHub Actions Workflow

```yaml
# ✅ GOOD: Lighthouse CI workflow
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

**Why good:** Automated performance testing on every PR, catches regressions before merging, enforces budgets automatically, provides Lighthouse reports for debugging

**Benefits:**

- Catch performance regressions early
- Prevent shipping slow code
- Enforce standards
- Track performance trends

---

## React DevTools Profiler

### Enable Profiler in Production

```typescript
// ✅ GOOD: Enable React Profiler in production
// next.config.js
export default {
  reactStrictMode: true,
  productionBrowserSourceMaps: true, // Enable source maps for profiling

  webpack: (config, { dev }) => {
    // Enable React Profiler in production
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-dom': 'react-dom/profiling',
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

**Why good:** Identifies actual performance bottlenecks, prevents premature optimization, shows render time breakdown, reveals unnecessary re-renders
