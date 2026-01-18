# CI Tooling and Profiling

> Lighthouse CI, React DevTools Profiler, and performance monitoring. See [core.md](core.md) for React runtime patterns.

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

### Usage

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
