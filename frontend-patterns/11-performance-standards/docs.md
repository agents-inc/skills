# 11. Performance Standards

> **Quick Guide:** Build performance? See §11.1. Bundle budgets? See §11.2. Core Web Vitals? See §11.3.

## 11.1 Build Performance

- Target build times:
  - Full build: < 2 minutes
  - Incremental build: < 30 seconds
- Cache hit ratios (> 80%)
- Parallel execution effectiveness

## 11.2 Bundle Size Budgets

- Per-package limits
- Total bundle targets (e.g., main bundle < 200kb)
- Monitoring and alerts
- Code splitting strategies

## 11.3 Runtime Performance

- Core Web Vitals targets:
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
  - FCP (First Contentful Paint): < 1.8s
  - TTI (Time to Interactive): < 3.8s
- Performance monitoring
- Performance budgets in CI
