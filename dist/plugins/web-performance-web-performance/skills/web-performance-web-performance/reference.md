# Performance Reference

> Decision frameworks, anti-patterns, and red flags for performance optimization.

---

## Decision Framework

### Should I optimize this?

```
Have you measured the performance issue?
├─ NO → Profile first with browser DevTools or framework profiler
└─ YES → Is it actually slow (user-perceivable)?
    ├─ NO → Don't optimize (premature optimization)
    └─ YES → Is it runtime or bundle size?
        ├─ Bundle → Check bundle budgets, analyze with bundler tools
        │   ├─ Over budget → Code split, tree shake, find lighter alternatives
        │   └─ Under budget → Focus elsewhere
        └─ Runtime → Which Core Web Vital is failing?
            ├─ LCP (> 2.5s) → Optimize images, preload critical assets
            ├─ INP (> 200ms) → Code split, use web workers, break up long tasks
            └─ CLS (> 0.1) → Set image dimensions, reserve space
```

### Should I memoize this?

```
Are you using React Compiler (React 19+)?
├─ YES → Let the compiler handle it (automatic memoization)
│   └─ Only add manual memo for: third-party interop, non-pure computations
└─ NO → Is the component/calculation expensive?
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
    ├─ YES → FixedSizeList (react-window or TanStack Virtual)
    └─ NO → Dynamic height virtualizer (react-virtuoso or TanStack Virtual)
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

## Anti-Patterns

### Premature Optimization

Optimizing before measuring leads to complexity without benefit. Always profile first.

```typescript
// ❌ WRONG - Memoizing without measuring
const MemoizedComponent = React.memo(SimpleComponent);
const value = useMemo(() => a + b, [a, b]); // Simple math doesn't need memo

// ✅ CORRECT - Profile first, optimize measured bottlenecks
// Profiler shows Component takes 50ms to render
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
import _ from "lodash";
_.debounce(fn, 300);

// ✅ CORRECT - Tree-shakeable ESM import (~2KB)
import { debounce } from "lodash-es";
debounce(fn, 300);
```

### Lazy Loading Above-Fold Content

Using `loading="lazy"` on hero images delays LCP. Critical content should load eagerly.

```html
<!-- ❌ WRONG - Hero image lazy loaded -->
<img src="/hero.jpg" loading="lazy" />

<!-- ✅ CORRECT - Hero loads eagerly, below-fold lazy -->
<img src="/hero.jpg" loading="eager" fetchpriority="high" />
<img src="/below-fold.jpg" loading="lazy" />
```

### Ignoring Real User Monitoring

Lab metrics (Lighthouse) differ from real-world performance. Always track production metrics.

```typescript
// ❌ WRONG - Only checking Lighthouse scores
// "Lighthouse says 95, ship it!"

// ✅ CORRECT - Track real user metrics
import { onLCP, onINP, onCLS } from "web-vitals";
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```
