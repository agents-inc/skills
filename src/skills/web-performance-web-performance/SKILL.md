---
name: web-performance-web-performance
description: Bundle optimization, render performance, Core Web Vitals
---

# Web Performance Patterns

> **Quick Guide:** Bundle budgets: < 200KB main bundle gzipped. Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1. Profile before optimizing -- measure actual bottlenecks, don't guess. Lazy load routes and heavy libraries. Use React Compiler (React 19+) for automatic memoization; manual memo only when profiling proves a bottleneck. Monitor real users with web-vitals library, not just Lighthouse.

---

<critical_requirements>

## CRITICAL: Before Optimizing Performance

**(You MUST profile BEFORE optimizing - measure actual bottlenecks with browser DevTools, framework profiler, or Lighthouse)**

**(You MUST set performance budgets BEFORE building features - bundle size limits and Core Web Vitals targets)**

**(You MUST use named constants for ALL performance thresholds - no magic numbers like `200` or `2.5`)**

**(You MUST monitor Core Web Vitals in production - track LCP, INP, CLS for real users, not just lab metrics)**

**(You MUST lazy load route components and heavy libraries - code splitting prevents large initial bundles)**

</critical_requirements>

---

**Auto-detection:** Core Web Vitals, bundle size optimization, LCP, INP, CLS, lazy loading, code splitting, memoization, React Compiler, performance monitoring, web-vitals library, bundle budget, virtualization, react-window, TanStack Virtual

**When to use:**

- Optimizing Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- Setting and enforcing bundle size budgets (< 200KB main bundle)
- Implementing runtime performance patterns (strategic memo, lazy loading, virtualization)
- Monitoring performance with web-vitals library in production
- Code splitting and tree shaking to reduce initial bundle

**When NOT to use:**

- Before measuring (premature optimization adds complexity without benefit)
- For simple components (memoizing cheap renders adds overhead)
- Internal admin tools with < 10 users (ROI too low)
- Prototypes and MVPs (optimize after validating product-market fit)

**Key patterns covered:**

- Core Web Vitals targets and improvement strategies (LCP, INP, CLS)
- Bundle size budgets (< 200KB main, < 500KB total initial load)
- Strategic memoization (profile first; React Compiler handles most cases)
- Code splitting (route-based lazy loading, dynamic imports, tree shaking)
- Image optimization (modern formats, lazy loading, responsive images)

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - React memoization, virtual scrolling, debouncing
- [examples/code-splitting.md](examples/code-splitting.md) - Lazy loading, tree shaking, bundle budgets
- [examples/web-vitals.md](examples/web-vitals.md) - LCP, INP, CLS patterns and monitoring
- [examples/image-optimization.md](examples/image-optimization.md) - Image formats, lazy loading, responsive images
- [reference.md](reference.md) - Decision frameworks and anti-patterns

---

<philosophy>

## Philosophy

Performance is a feature, not an afterthought. Fast applications improve user experience, conversion rates, and SEO rankings. Performance optimization requires measurement before action, budgets before building, and monitoring in production.

**Core principles:**

- **Measure first, optimize second** - Profile actual bottlenecks, don't guess
- **Set budgets early** - Define bundle size limits and Core Web Vitals targets before building
- **Monitor real users** - Lab metrics (Lighthouse) differ from real-world performance (RUM)
- **Optimize strategically** - Memoize expensive operations, not everything
- **Lazy load by default** - Load code when needed, not upfront

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Bundle Size Budgets

Set and enforce bundle size limits to prevent bloat. Main bundle should be < 200KB gzipped for fast downloads on 3G networks.

```typescript
// constants/bundle-budgets.ts
export const BUNDLE_SIZE_BUDGETS_KB = {
  MAIN_BUNDLE_GZIPPED: 200,
  VENDOR_BUNDLE_GZIPPED: 150,
  ROUTE_BUNDLE_GZIPPED: 100,
  TOTAL_INITIAL_LOAD_GZIPPED: 500,
  MAIN_CSS_GZIPPED: 50,
  CRITICAL_CSS_INLINE: 14, // Fits in first TCP packet
} as const;
```

**Why these limits:** 200 KB ≈ 1 second download on 3G, faster Time to Interactive (TTI), better mobile performance

**Recommended budgets:**

- **Main bundle**: < 200 KB gzipped
- **Vendor bundle**: < 150 KB gzipped
- **Route bundles**: < 100 KB each gzipped
- **Total initial load**: < 500 KB gzipped
- **Main CSS**: < 50 KB gzipped
- **Critical CSS**: < 14 KB inlined (fits in first TCP packet)

For enforcement examples, see [examples/code-splitting.md](examples/code-splitting.md).

---

### Pattern 2: Core Web Vitals Optimization

Optimize for Google's Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1. These metrics impact SEO and user experience.

```typescript
// constants/web-vitals.ts
export const CORE_WEB_VITALS_THRESHOLDS = {
  LCP_SECONDS: 2.5, // Largest Contentful Paint
  INP_MS: 200, // Interaction to Next Paint
  CLS_SCORE: 0.1, // Cumulative Layout Shift
  FCP_SECONDS: 1.8, // First Contentful Paint
  TTI_SECONDS: 3.8, // Time to Interactive
  TBT_MS: 300, // Total Blocking Time
  TTFB_MS: 800, // Time to First Byte
} as const;
```

#### LCP (Largest Contentful Paint): < 2.5s

Measures loading performance -- when the largest visible element renders.

**How to improve:** Optimize images (modern formats, preload hero images), minimize render-blocking resources, use CDN for static assets, SSR or SSG for critical content.

#### INP (Interaction to Next Paint): < 200ms

Measures interactivity across ALL user interactions (replaced FID in March 2024). Includes input delay, processing time, and presentation delay.

**How to improve:** Minimize JavaScript execution time, code split to load less JS upfront, use web workers for heavy computation, break up long tasks (> 50ms) with `scheduler.yield()` or `setTimeout`.

#### CLS (Cumulative Layout Shift): < 0.1

Measures visual stability -- prevents unexpected layout shifts.

**How to improve:** Set explicit image/video dimensions, reserve space for dynamic content (ads, embeds), avoid injecting content above existing content, use `font-display: swap` with `size-adjust`.

For detailed examples and monitoring setup, see [examples/web-vitals.md](examples/web-vitals.md).

---

### Pattern 3: Code Splitting and Lazy Loading

Lazy load route components and heavy libraries. Code splitting keeps the initial bundle small by loading code on demand.

```typescript
import { lazy, Suspense } from 'react';

// Route-based splitting - each route is a separate chunk
const Dashboard = lazy(() => import('./pages/dashboard'));
const Reports = lazy(() => import('./pages/reports'));

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Suspense>
  );
}
```

**Why good:** Splits bundle by route, loads components on demand, users only download what they navigate to

**When to lazy load:** Route components, heavy feature modules, modals/dialogs, below-fold content

**When NOT to lazy load:** Above-fold components, error boundaries, loading states

For tree shaking and bundle enforcement, see [examples/code-splitting.md](examples/code-splitting.md).

---

### Pattern 4: Strategic Memoization

Profile before memoizing. React Compiler (v1.0, Oct 2025) auto-memoizes in most cases. Manual memo only when profiling proves a bottleneck.

```typescript
// Only memoize when profiling shows > 5ms render time
const EXPENSIVE_RENDER_MS = 5;

// ✅ Expensive calculation with large dataset
const sortedRows = useMemo(
  () => [...rows].sort((a, b) => compareValues(a[sortColumn], b[sortColumn])),
  [rows, sortColumn],
);

// ❌ Trivial calculation - memo overhead exceeds cost
const doubled = useMemo(() => value * 2, [value]);
```

**React Compiler (React 19+):** Automatically memoizes components, values, and functions at build time. Manual `useMemo`/`useCallback`/`React.memo` rarely needed. Only add manual memo for: third-party interop, non-pure computations, or when profiling shows the compiler missed an optimization.

For complete memoization patterns, see [examples/core.md](examples/core.md).

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- No performance budgets defined -- bundle sizes grow unnoticed, Core Web Vitals degrade
- Memoizing everything without profiling -- adds overhead, increases complexity, premature optimization
- Not lazy loading routes -- massive initial bundles, slow Time to Interactive
- Importing entire libraries (`import _ from 'lodash'`) -- bundles unused code, prevents tree shaking
- Not optimizing images -- images are 50%+ of page weight; modern formats reduce size 30-50%
- Blocking main thread with heavy computation -- causes high INP, use web workers or break up long tasks

**Medium Priority Issues:**

- Not monitoring Core Web Vitals in production -- lab metrics differ from real users
- Rendering 100+ items without virtualization -- DOM bloat, slow scrolling
- No bundle size enforcement in CI -- regressions slip through code review
- Using CommonJS imports (`require()`) -- prevents tree shaking

**Gotchas & Edge Cases:**

- `React.memo` uses shallow comparison -- deep object props always trigger re-render
- `useMemo`/`useCallback` have overhead -- only use for expensive operations (> 5ms)
- React Compiler (v1.0) handles memoization automatically -- manual memo is rarely needed
- Lighthouse scores differ from real users -- always monitor RUM with web-vitals
- Code splitting increases total bundle size slightly (runtime overhead) -- net win for initial load
- Virtual scrolling breaks browser find-in-page (Cmd+F)
- Lazy loading doesn't work in SSR -- components load on client mount
- AVIF support is ~95% (2026) -- always provide WebP fallbacks
- Bundle size budgets should account for gzip/brotli compression

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

**(You MUST profile BEFORE optimizing - measure actual bottlenecks with browser DevTools, framework profiler, or Lighthouse)**

**(You MUST set performance budgets BEFORE building features - bundle size limits and Core Web Vitals targets)**

**(You MUST use named constants for ALL performance thresholds - no magic numbers like `200` or `2.5`)**

**(You MUST monitor Core Web Vitals in production - track LCP, INP, CLS for real users, not just lab metrics)**

**(You MUST lazy load route components and heavy libraries - code splitting prevents large initial bundles)**

**Failure to follow these rules will result in slow applications, poor Core Web Vitals, large bundles, and degraded user experience.**

</critical_reminders>
