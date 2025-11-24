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
