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
        'react-dom$': 'react-dom/profiling',
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
