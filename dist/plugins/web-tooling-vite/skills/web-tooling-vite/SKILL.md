---
name: web-tooling-vite
description: Vite config, path aliases, vendor chunk splitting, environment-specific builds, Rolldown codeSplitting, Sass modern API, build targets, module preload
---

# Vite Patterns

> **Quick Guide:** Vite serves unbundled ES modules in development and bundles for production, so most configuration decisions apply to only one of those halves. The version decides the API: Vite 8 bundles with Rolldown (`build.rolldownOptions`, `codeSplitting.groups`, `resolve.tsconfigPaths`), Vite 7 with Rollup (`build.rollupOptions`, `manualChunks`, aliases mirrored into `tsconfig.json` by hand). Sass runs on the modern API from Vite 6 onwards, and the legacy API is gone from Vite 7.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — full configs for aliases, chunk splitting, environment-specific builds, module preload, Sass, the Environment API and the dev proxy
- [reference.md](reference.md) — dev/production settings, build-target table, per-version notes and the Vite 8 migration checklist

---

## Which path applies

Read the `vite` version in `package.json` before writing config; the two branches share names and not behaviour.

- **Vite 8 (Rolldown)** — `build.rolldownOptions`, `codeSplitting.groups` for chunking, `resolve.tsconfigPaths` instead of hand-mirrored aliases. `build.rollupOptions` still resolves as a deprecated alias, which is why a wrong-version config looks like it works.
- **Vite 7 (Rollup)** — `build.rollupOptions` with `manualChunks`, and aliases declared in both `vite.config.ts` and `tsconfig.json`.

---

<critical_requirements>

## Before writing Vite config

**Declare path aliases in one place per version** — `resolve.tsconfigPaths` on Vite 8, or the same set in both `vite.config.ts` and `tsconfig.json` on Vite 7. A pair that has drifted resolves in one tool and not the other, so the build and the editor disagree about the same import.

**Match the bundler options to the version.** On Vite 8 that is `build.rolldownOptions` with `codeSplitting.groups`; object-form `manualChunks` is removed there and silently produces no grouping.

**Split config by mode rather than shipping one build.** `defineConfig(({ mode }) => …)` with `loadEnv` keeps minification and sourcemaps out of development and out of the production bundle respectively.

**Reach for `build.modulePreload.polyfill`**, the current spelling — `build.polyfillModulePreload` is deprecated and offers no control over which dependencies are preloaded.

</critical_requirements>

---

**Auto-detection:** Vite, vite.config.ts, vite.config.js, defineConfig, loadEnv, manualChunks, advancedChunks, codeSplitting.groups, rolldownOptions, rollupOptions, modulePreload, resolve.alias, resolve.tsconfigPaths, build.target, baseline-widely-available, VITE\_

**Applies to:**

- Configuring a Vite build for a frontend application
- Path aliases, and keeping them resolvable by both the bundler and the type checker
- Vendor chunk splitting for cacheable production output
- Per-mode builds (development, staging, production) with `loadEnv` and `define`
- Migrating a config from Vite 7 to Vite 8
- Module preload, build targets and Sass preprocessing

**Handled elsewhere:**

- Compiler options and type-checking behaviour, beyond the `paths` entry an alias needs
- Lint and format configuration
- Application code that runs in the browser — this is build-time configuration only
- Build orchestration by an SSR meta-framework, which owns its own config file
- Pipeline and deployment concerns around the build command

---

<philosophy>

Development and production run different machinery. The dev server transforms modules on demand and ships them unbundled, so nothing there is tree-shaken, minified or chunked; the production build is a bundler run with all three. Every defect that survives to release lives in that gap — a stylesheet dropped by tree-shaking, a chunk that only exists in production, an env var that was present locally.

So the useful question about any option is which half it governs, and whether the other half will ever exercise it.

</philosophy>

---

<decision_framework>

## Chunk splitting

```
Vite 8 (Rolldown)?
├─ Separating vendors by package → codeSplitting.groups with a test regex ✓
└─ Constraining by size or share count → codeSplitting maxSize / minSize / minShareCount

Vite 7 (Rollup)?
├─ Separating vendors by package → manualChunks, object form ✓
└─ Logic per module id → manualChunks, function form
```

`advancedChunks` is the same feature under its rolldown-vite name; it became `codeSplitting` in Vite 8.

## Build target

```
Are there browsers below the default floor to support?
├─ YES → @vitejs/plugin-legacy alongside the modern build
└─ NO  → Smallest possible output?
    ├─ YES → 'esnext'
    └─ NO  → 'baseline-widely-available' (the default) ✓, or an explicit list
              such as ['chrome111', 'safari16.4'] when a contract names versions
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Path Aliases

One alias set, resolvable by the bundler and the type checker alike.

```typescript
// Vite 8 — read straight from tsconfig.json
resolve: { tsconfigPaths: true },

// Vite 7 — declared here and mirrored in tsconfig.json "paths"
resolve: {
  alias: { "@": path.resolve(__dirname, "./src") },
},
```

`resolve.tsconfigPaths` is off by default because resolving through tsconfig costs startup time; turn it on only where the project uses `paths`. It covers only what `tsconfig.json` declares, so an alias with no `paths` entry — a package outside the project, a stub swapped in for a build — still needs `resolve.alias` beside it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Vendor Chunk Splitting

Dependencies change on a slower cadence than application code, so a separate chunk stays in the browser cache across deploys.

```typescript
// Vite 8
build: {
  rolldownOptions: {
    output: {
      codeSplitting: {
        groups: [{ name: "vendor", test: /[\\/]node_modules[\\/]/ }],
      },
    },
  },
},
```

Narrow the `test` per group where different dependencies move at different rates; one chunk holding everything is invalidated by any upgrade.

Full code, including the Vite 7 form: [examples/core.md](examples/core.md)

---

### Pattern 3: Per-Mode Builds

`defineConfig` takes a function, so the config can differ per `--mode`.

```typescript
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: mode !== "production",
    minify: mode === "production",
  },
}));
```

`.env` file selection follows `--mode`, not `NODE_ENV`. `loadEnv(mode, cwd, "")` returns every variable, including ones with no client prefix, so treat its result as server-side values rather than something to feed into `define`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Module Preload

```typescript
build: {
  modulePreload: {
    polyfill: false,
    resolveDependencies: (filename, deps) =>
      deps.filter((dep) => !dep.includes("rarely-used-vendor")),
  },
},
```

Dropping the polyfill is safe only where the target floor supports module preload natively; `resolveDependencies` is how a large chunk is kept out of the initial preload list.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Sass

```typescript
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "./src/styles/variables" as *;`,
    },
  },
},
```

The modern API is the default from Vite 6 and the only one from Vite 7, so a config still passing `api: "legacy"` fails rather than falling back. Migrating means `@import` becoming `@use`/`@forward` with namespaced access.

---

### Pattern 6: Dev Server Proxy

```typescript
server: {
  proxy: {
    "/api": { target: "http://localhost:8000", changeOrigin: true },
  },
},
```

Proxying keeps development same-origin, so no CORS configuration is needed for a backend that will be same-origin in production anyway.

---

### Pattern 7: Environment API

For framework authors and multi-runtime builds; still RC as of Vite 8, and an ordinary single-client app needs none of it.

```typescript
environments: {
  client: { build: { outDir: "dist/client" } },
  ssr: { build: { outDir: "dist/server", ssr: true } },
},
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Object-form `manualChunks` on Vite 8 — removed, so the grouping silently does not happen and the vendor chunk you expected is not in `dist`
- `splitVendorChunkPlugin`, removed in Vite 7 — the import throws before the build starts
- `target: 'modules'`, removed in Vite 7 — replaced by `'baseline-widely-available'`
- Sass `api: "legacy"` on Vite 7 or later — the legacy API is gone rather than deprecated
- An alias present in `vite.config.ts` and missing from `tsconfig.json`, or the reverse — the build succeeds and the type check fails, or the editor resolves an import the bundler cannot

**Surprising behaviour:**

- `build.rollupOptions` still resolves on Vite 8 as a deprecated alias, so a Vite 7 config appears to work until a Rolldown-only option is needed
- `resolve.tsconfigPaths` is off by default; enabling it is a deliberate step, not a fallback
- Rolldown emits an extra `runtime.js` chunk beside the code-split groups
- `loadEnv(mode, cwd, "")` loads every variable in the file, prefix or not — inlining one of those through `define` publishes it in the bundle
- `build.commonjsOptions` is a no-op on Vite 8, since Rolldown handles CommonJS natively
- The `esbuild` option auto-converts to `oxc` on Vite 8, quietly dropping the options Oxc has no equivalent for
- Sourcemaps left on in production ship readable source; `'hidden'` keeps them for error reporting without linking them from the bundle

</red_flags>
