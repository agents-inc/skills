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

@include(./docs.md)

---

@include(./examples.md)
