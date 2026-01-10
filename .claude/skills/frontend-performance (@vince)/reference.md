# Performance Reference

> Decision frameworks, anti-patterns, red flags, and integration guides for performance optimization.

---

## Decision Framework

### Should I optimize this?

```
Have you measured the performance issue?
├─ NO → Profile first with Chrome DevTools or React Profiler
└─ YES → Is it actually slow (user-perceivable)?
    ├─ NO → Don't optimize (premature optimization)
    └─ YES → Is it build performance or runtime?
        ├─ Build → Check Turborepo cache hit rate
        │   ├─ < 80% → Fix cache configuration
        │   └─ > 80% → Optimize TypeScript config
        └─ Runtime → Which Core Web Vital is failing?
            ├─ LCP (> 2.5s) → Optimize images, preload critical assets
            ├─ FID/INP (> 100ms/200ms) → Code split, use web workers
            └─ CLS (> 0.1) → Set image dimensions, reserve space
```

### Should I memoize this?

```
Is the component/calculation expensive?
├─ NO (< 5ms) → Don't memoize (overhead > benefit)
└─ YES (> 5ms) → Does it re-render frequently?
    ├─ NO → Don't memoize (rarely helps)
    └─ YES → Which memoization?
        ├─ Component → React.memo
        ├─ Calculation → useMemo
        └─ Function → useCallback (if passed to memoized child)
```

### Should I use virtual scrolling?

```
How many items are you rendering?
├─ < 100 → Regular rendering (virtual scrolling unnecessary)
└─ > 100 → Are items consistent height?
    ├─ YES → react-window (FixedSizeList)
    └─ NO → react-virtuoso (dynamic heights)
```

### Should I lazy load this?

```
Is this component critical for initial render?
├─ YES (above-fold, error boundaries) → Don't lazy load
└─ NO → Is it used conditionally?
    ├─ Route component → lazy() with Suspense
    ├─ Heavy library → Dynamic import
    ├─ Below-fold image → loading="lazy"
    └─ Modal/Dialog → lazy() with Suspense
```

---

## Integration Guide

Performance optimization integrates across the entire stack.

**Works with:**

- **Turborepo** - Build caching reduces build times by 80%+
- **Next.js** - Automatic code splitting, Image component, SSR/SSG for Core Web Vitals
- **Vite** - Fast HMR (< 5s rebuilds), built-in bundle analysis
- **React Query** - Request deduplication, caching reduces API calls
- **TypeScript** - Incremental compilation speeds up type checking
- **SCSS Modules** - CSS code splitting per component
- **Vitest** - Parallel test execution, coverage caching

**Performance monitoring:**

- **web-vitals library** - Track Core Web Vitals in production
- **Google Analytics** - Real User Monitoring (RUM)
- **Sentry Performance** - Error tracking + performance traces
- **Vercel Analytics** - Automatic for Vercel deployments

**CI/CD integration:**

- **GitHub Actions** - Bundle size checks, Lighthouse CI
- **size-limit** - Enforce bundle budgets, fail builds on regressions
- **Lighthouse CI** - Automated performance testing on PRs

---

## RED FLAGS

**High Priority Issues:**

- ❌ **No performance budgets defined** - Bundle sizes grow unnoticed, Core Web Vitals degrade over time
- ❌ **Memoizing everything without profiling** - Adds overhead, increases complexity, premature optimization
- ❌ **Not lazy loading routes** - Massive initial bundles, slow Time to Interactive
- ❌ **Importing entire libraries** (`import _ from 'lodash'`) - Bundles unused code, prevents tree shaking
- ❌ **Not optimizing images** - Images are 50%+ of page weight, WebP/AVIF reduce size by 30-50%
- ❌ **Blocking main thread with heavy computation** - Causes high FID/INP, use web workers

**Medium Priority Issues:**

- ⚠️ **Not monitoring Core Web Vitals in production** - Lab metrics differ from real users
- ⚠️ **Premature optimization before measuring** - Adds complexity without benefit
- ⚠️ **Rendering 100+ items without virtualization** - DOM bloat, slow scrolling
- ⚠️ **No bundle size enforcement in CI** - Regressions slip through code review
- ⚠️ **Not using Turborepo caching** - Slow builds in monorepos (10x slower)

**Common Mistakes:**

- Lazy loading above-fold images (delays LCP)
- Not setting image dimensions (causes CLS)
- Memoizing cheap components (overhead > benefit)
- Using CommonJS imports (prevents tree shaking)
- Not declaring environment variables in `turbo.json` (cache misses)

**Gotchas & Edge Cases:**

- React.memo uses shallow comparison - deep object props always trigger re-render
- useMemo/useCallback have overhead - only use for expensive operations (> 5ms)
- Lighthouse scores differ from real users - always monitor RUM with web-vitals
- Code splitting can increase total bundle size (webpack runtime overhead)
- Virtual scrolling breaks browser find-in-page (Cmd+F)
- Lazy loading doesn't work in SSR - components load on mount
- AVIF support is 93% (2024) - always provide WebP/JPEG fallbacks
- Bundle size budgets should account for gzip/brotli compression
- Turborepo cache invalidated by any env var change - declare all vars explicitly
- Next.js Image requires width/height or fill prop - prevents CLS

---

## Anti-Patterns

### Premature Optimization

Optimizing before measuring leads to complexity without benefit. Always profile first with Chrome DevTools, React Profiler, or Lighthouse.

```typescript
// ❌ WRONG - Memoizing without measuring
const MemoizedComponent = React.memo(SimpleComponent);
const value = useMemo(() => a + b, [a, b]); // Simple math doesn't need memo

// ✅ CORRECT - Profile first, optimize measured bottlenecks
// React Profiler shows Component takes 50ms to render
const MemoizedComponent = React.memo(ExpensiveComponent);
```

### Memoizing Everything

Wrapping every component in `React.memo` and every callback in `useCallback` adds overhead and complexity.

```typescript
// ❌ WRONG - Memo overhead exceeds render cost
const handleClick = useCallback(() => setCount(c => c + 1), []);
const label = useMemo(() => `Count: ${count}`, [count]);

// ✅ CORRECT - Only memoize when passing to memoized children
const MemoizedChild = React.memo(ExpensiveChild);
const handleClick = useCallback(() => setCount(c => c + 1), []);
<MemoizedChild onClick={handleClick} />
```

### Importing Full Libraries

Using full library imports bundles everything, even unused code.

```typescript
// ❌ WRONG - Imports entire lodash (~70KB)
import _ from 'lodash';
_.debounce(fn, 300);

// ✅ CORRECT - Modular import (~2KB)
import { debounce } from 'lodash-es';
debounce(fn, 300);
```

### Lazy Loading Above-Fold Content

Using `loading="lazy"` on hero images delays LCP. Critical content should load eagerly.

```tsx
// ❌ WRONG - Hero image lazy loaded
<img src="/hero.jpg" loading="lazy" />

// ✅ CORRECT - Hero loads eagerly, below-fold lazy
<img src="/hero.jpg" loading="eager" fetchpriority="high" />
<img src="/below-fold.jpg" loading="lazy" />
```

### Ignoring Real User Monitoring

Lab metrics (Lighthouse) differ from real-world performance. Always track production metrics.

```typescript
// ❌ WRONG - Only checking Lighthouse scores
// "Lighthouse says 95, ship it!"

// ✅ CORRECT - Track real user metrics
import { onLCP, onFID, onCLS } from 'web-vitals';
onLCP(sendToAnalytics);
onFID(sendToAnalytics);
onCLS(sendToAnalytics);
```
