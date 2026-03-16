# Vite Reference

> Decision frameworks and version-specific gotchas for Vite build tool configuration. See [examples/core.md](examples/core.md) for full code examples.

---

## Decision Frameworks

### Vite Version Selection

```
Which Vite version?
├─ New project (March 2026+)?
│   └─ Vite 8 (Rolldown bundler, fastest builds) ✓
├─ Existing Vite 7 project?
│   ├─ Build performance is a bottleneck (> 30 seconds)?
│   │   └─ YES → Migrate to Vite 8 (10-30x faster)
│   └─ NO → Stay on Vite 7 (stable, no migration needed)
└─ Existing Vite 6 project?
    └─ Plan upgrade to Vite 7 first, then Vite 8
```

**Current recommendation:** Vite 8 for new projects (Rolldown is default, stable). Vite 7 for existing projects without build performance issues.

---

### Chunk Splitting Strategy

```
How to split vendor chunks?
├─ Vite 8 (Rolldown is default)?
│   ├─ Simple vendor separation?
│   │   └─ codeSplitting.groups with regex patterns ✓
│   └─ Complex splitting (size limits, shared modules)?
│       └─ codeSplitting with maxSize/minSize/minShareCount
├─ Vite 7 (standard Rollup)?
│   ├─ Simple vendor separation?
│   │   └─ manualChunks object form ✓
│   └─ Complex splitting logic?
│       └─ manualChunks function form
└─ Vite 7 with rolldown-vite (experimental)?
    └─ advancedChunks.groups (renamed to codeSplitting in Vite 8)
```

---

### Path Alias Strategy

```
How to configure path aliases?
├─ Vite 8?
│   ├─ All aliases match tsconfig paths?
│   │   └─ Use resolve.tsconfigPaths: true ✓
│   └─ Need aliases beyond tsconfig paths?
│       └─ Use resolve.alias (manual configuration)
├─ Vite 7?
│   └─ Use resolve.alias + sync with tsconfig.json manually ✓
└─ Any version?
    └─ ALWAYS keep tsconfig paths in sync with Vite aliases
```

---

### Build Target Selection

```
Choosing build.target?
├─ Supporting legacy browsers (< Safari 16)?
│   └─ Use @vitejs/plugin-legacy
├─ Modern browsers only?
│   ├─ Smallest possible bundle?
│   │   └─ 'esnext'
│   └─ Otherwise → 'baseline-widely-available' (default) ✓
└─ Specific browser requirements?
    └─ Use explicit array: ['chrome111', 'safari16.4']
```

---

## Gotchas & Edge Cases

**Vite 8 (Rolldown):**

- `build.rollupOptions` is a deprecated alias for `build.rolldownOptions` - works but will warn
- Object-form `manualChunks` is removed entirely, function-form is deprecated
- Rolldown generates a `runtime.js` chunk when using `codeSplitting.groups`
- Default browser targets: Chrome 111+, Edge 111+, Firefox 114+, Safari 16.4+
- `resolve.tsconfigPaths` disabled by default (performance cost)
- Install size ~15MB larger (10MB lightningcss, 5MB Rolldown)
- `build.commonjsOptions` is a no-op (Rolldown handles CJS natively)
- CSS minification uses Lightning CSS (was esbuild), JS minification uses Oxc (was esbuild)
- `esbuild` config option auto-converts to `oxc`

**Vite 7:**

- Node.js 18 dropped - requires Node.js 20.19+ or 22.12+
- Sass legacy API completely removed
- `splitVendorChunkPlugin` removed
- Default target changed from `'modules'` to `'baseline-widely-available'`

**Vite 6:**

- Environment API is experimental - do not use `environments` config in production apps
- `options.ssr` in plugin hooks deprecated - use `this.environment` instead

**Rolldown-specific:**

- `advancedChunks` renamed to `codeSplitting` in Vite 8
- `codeSplitting.maxSize` is a target, not a strict limit - chunks may exceed it
- `includeDependenciesRecursively` defaults to true - may pull in more than expected

**General:**

- `.env` files are loaded based on `--mode` flag, not `NODE_ENV`
- `loadEnv()` third argument (`""`) loads all env vars, not just `VITE_`-prefixed ones
- TypeScript path aliases must be configured in BOTH tsconfig and build tool (Vite 7) or use `resolve.tsconfigPaths` (Vite 8)
