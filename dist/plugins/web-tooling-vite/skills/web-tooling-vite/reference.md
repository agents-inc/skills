# Vite Reference

> Decision frameworks, red flags, and anti-patterns for Vite build tool configuration.

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

**Current recommendation:** Vite 8 for new projects (Rolldown is now the default, stable bundler). Vite 7 for existing projects that do not need build speed improvements.

---

### Vite vs Rolldown-Vite (Vite 7 Only)

> **Note:** This decision is only relevant for Vite 7 projects. In Vite 8, Rolldown is the default bundler.

```
Choosing bundler for Vite 7 project?
├─ Production stability required?
│   └─ YES → Standard Vite 7 (Rollup-based) ✓
├─ Build performance is critical bottleneck?
│   ├─ Build time > 30 seconds?
│   │   └─ YES → Consider rolldown-vite (16x faster)
│   └─ NO → Standard Vite 7 is fine
├─ Ready to migrate to Vite 8?
│   └─ YES → Skip rolldown-vite, go directly to Vite 8 ✓
└─ Framework author / early adopter?
    └─ YES → Test rolldown-vite for future readiness
```

**Current recommendation:** For Vite 7, use standard Vite for stability. If build speed matters, migrate to Vite 8 instead of using rolldown-vite.

---

### Vite Build Target Selection

```
Choosing build.target?
├─ Supporting legacy browsers (< Safari 16)?
│   └─ YES → Use @vitejs/plugin-legacy
├─ Modern browsers only?
│   ├─ Need smallest possible bundle?
│   │   └─ YES → 'esnext'
│   └─ NO → 'baseline-widely-available' (Vite 7+/8 default) ✓
└─ Specific browser requirements?
    └─ YES → Use explicit array: ['chrome111', 'safari16.4']
```

---

### Chunk Splitting Strategy

```
How to split vendor chunks?
├─ Vite 8 (Rolldown is default)?
│   ├─ Simple vendor separation?
│   │   └─ codeSplitting.groups with regex patterns ✓
│   └─ Complex splitting (size limits, shared modules)?
│       └─ codeSplitting with maxSize/minSize/minShareCount
├─ Vite 7 with standard Rollup?
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

## RED FLAGS

**High Priority Issues:**

- ❌ Using `build.rollupOptions` in Vite 8 (renamed to `build.rolldownOptions`)
- ❌ Using object-form `manualChunks` in Vite 8 (removed; use `codeSplitting.groups`)
- ❌ Using deprecated `build.polyfillModulePreload` (use `build.modulePreload.polyfill`)
- ❌ Using deprecated `splitVendorChunkPlugin` (removed in Vite 7+)
- ❌ Using `target: 'modules'` (deprecated in Vite 7; use `'baseline-widely-available'`)
- ❌ Using Sass legacy API `api: 'legacy'` (removed in Vite 7+)
- ❌ Path aliases in `vite.config.ts` not matching `tsconfig.json` (import resolution failures)

**Medium Priority Issues:**

- ⚠️ No vendor chunk splitting in production builds (large initial bundles)
- ⚠️ Same build config for all environments (slow dev, exposed prod source maps)
- ⚠️ Hardcoded API URLs instead of environment variables
- ⚠️ Using Environment API in production apps (still RC phase)
- ⚠️ Function-form `manualChunks` in Vite 8 (deprecated, migrate to `codeSplitting`)

**Common Mistakes:**

- Forgetting to sync tsconfig paths with Vite resolve.alias (build works, IDE resolution fails or vice versa)
- Using `build.rollupOptions` in Vite 8 instead of `build.rolldownOptions`
- Committing `.env` files with secrets (use `.env.local`, add to `.gitignore`)
- Setting `minify: true` in development mode (slows rebuilds)
- Always generating sourcemaps in production (exposes source code)

---

## Anti-Patterns to Avoid

### Deprecated polyfillModulePreload

```javascript
// ❌ ANTI-PATTERN: Deprecated polyfillModulePreload
export default defineConfig({
  build: {
    polyfillModulePreload: false, // DEPRECATED
  },
});
```

**Why it's wrong:** `build.polyfillModulePreload` is deprecated; use the new structured API.

**What to do instead:** Use `build.modulePreload.polyfill`:

```javascript
// ✅ Vite 6+ module preload configuration
export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        return deps.filter((dep) => !dep.includes("heavy-vendor"));
      },
    },
  },
});
```

---

### Deprecated splitVendorChunkPlugin

```javascript
// ❌ ANTI-PATTERN: Deprecated in Vite 7, removed
import { splitVendorChunkPlugin } from "vite";

export default defineConfig({
  plugins: [splitVendorChunkPlugin()], // REMOVED in Vite 7
});
```

**Why it's wrong:** `splitVendorChunkPlugin` is deprecated and removed in Vite 7.

**What to do instead:** Use `manualChunks` (Vite 7) or `codeSplitting` (Vite 8):

```javascript
// ✅ Vite 7: Direct manualChunks configuration
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
});

// ✅ Vite 8: codeSplitting configuration
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /[\\/]node_modules[\\/]react(-dom)?[\\/]/ },
            { name: "query-vendor", test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
});
```

---

### Deprecated build.target: 'modules'

```javascript
// ❌ ANTI-PATTERN: Deprecated target value
export default defineConfig({
  build: {
    target: "modules", // REMOVED in Vite 7
  },
});
```

**Why it's wrong:** The `'modules'` target value is deprecated and no longer available in Vite 7+.

**What to do instead:** Use the new default or explicit browser targets:

```javascript
// ✅ Vite 7+ compatible targets
export default defineConfig({
  build: {
    // Option 1: New default (omit for default behavior)
    target: "baseline-widely-available",
    // Option 2: Explicit browser list
    target: ["chrome111", "edge111", "firefox104", "safari16.4"],
    // Option 3: Latest browsers only
    target: "esnext",
  },
});
```

---

### Sass Legacy API Without Migration Plan

```javascript
// ❌ ANTI-PATTERN: Legacy Sass API
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "legacy", // Works in Vite 6, REMOVED in Vite 7+
      },
    },
  },
});
```

**Why it's wrong:** Sass legacy API is deprecated in Vite 6 and completely removed in Vite 7+.

**What to do instead:** Migrate to modern Sass API (default in Vite 6+):

```javascript
// ✅ Modern Sass API (default, no need to specify)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // api: 'modern', // This is the default - no need to specify
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Migration notes:**

- Replace `@import` with `@use` and `@forward`
- Use namespaced access for variables/mixins: `variables.$color-primary`
- Test thoroughly before removing `api: 'legacy'`

---

### Object-form manualChunks in Vite 8

```javascript
// ❌ ANTI-PATTERN: Removed in Vite 8
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"], // Object form REMOVED
        },
      },
    },
  },
});
```

**Why it's wrong:** Object-form `manualChunks` is removed in Vite 8 / Rolldown. Function-form is deprecated.

**What to do instead:** Use `codeSplitting.groups`:

```javascript
// ✅ Vite 8 codeSplitting
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor", test: /[\\/]node_modules[\\/]react(-dom)?[\\/]/ },
          ],
        },
      },
    },
  },
});
```

---

### Using build.rollupOptions in Vite 8

```javascript
// ❌ ANTI-PATTERN: Renamed in Vite 8
export default defineConfig({
  build: {
    rollupOptions: {
      // RENAMED to rolldownOptions in Vite 8
      output: {
        /* ... */
      },
    },
  },
});
```

**Why it's wrong:** `build.rollupOptions` is renamed to `build.rolldownOptions` in Vite 8. The old name may silently fail or show a warning.

**What to do instead:** Use `build.rolldownOptions`:

```javascript
// ✅ Vite 8 correct option name
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        /* ... */
      },
    },
  },
});
```

---

## Gotchas & Edge Cases

- **Vite 8**: `build.rollupOptions` is renamed to `build.rolldownOptions` - old name may silently fail
- **Vite 8**: Object-form `manualChunks` is removed entirely, function-form is deprecated
- **Vite 8**: Rolldown generates a `runtime.js` chunk when using `codeSplitting.groups` to ensure runtime code executes before other chunks
- **Vite 8**: Default browser targets updated to Chrome 111+, Edge 111+, Firefox 104+, Safari 16.4+
- **Vite 8**: `resolve.tsconfigPaths` disabled by default due to performance considerations
- **Vite 8**: Install size increased ~15MB (10MB lightningcss, 5MB Rolldown)
- **Vite 8**: `build.commonjsOptions` is now a no-op (Rolldown handles CJS natively)
- **Vite 8**: CSS minification uses Lightning CSS by default (was esbuild)
- **Vite 8**: JS minification uses Oxc minifier (was esbuild)
- **Vite 7**: Node.js 18 dropped - requires Node.js 20.19+ or 22.12+
- **Vite 7**: Sass legacy API completely removed - migrate to modern API before upgrading
- **Vite 7**: `splitVendorChunkPlugin` removed - migrate to `manualChunks` before upgrading
- **Vite 7**: Default target changed from `'modules'` to `'baseline-widely-available'`
- **Vite 6**: Environment API is experimental - do not use `environments` config in production apps
- **Vite 6**: `options.ssr` in plugin hooks will be deprecated - use `this.environment` instead
- **Rolldown**: `advancedChunks` was renamed to `codeSplitting` in Rolldown/Vite 8
- **Rolldown**: `codeSplitting.maxSize` acts as a target, not a strict limit - chunks may exceed it
- **Rolldown**: `includeDependenciesRecursively` defaults to true - may pull in more than expected
- **Rolldown**: Breaking changes may occur within patch versions of `rolldown-vite` (Vite 7 experimental package)
- TypeScript path aliases must be configured in BOTH tsconfig and build tool (Vite 7) or use `resolve.tsconfigPaths` (Vite 8)
- `.env` files are loaded based on `--mode` flag, not `NODE_ENV`
- `loadEnv()` third argument (`''`) loads all env vars, not just `VITE_`-prefixed ones
