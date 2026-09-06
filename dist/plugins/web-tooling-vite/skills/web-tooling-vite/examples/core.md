# Vite - Core Examples

> Full configs for the patterns in [SKILL.md](../SKILL.md). See [reference.md](../reference.md) for lookup tables and the migration checklist.

---

## Path Aliases

### Vite 8 — read from tsconfig

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Resolves the "paths" entries in tsconfig.json — nothing to mirror
    tsconfigPaths: true,
  },
});
```

**Why good:** one declaration serves the bundler, the type checker and the editor, so they cannot drift apart. It is off by default because resolving through tsconfig costs startup time, so enabling it is deliberate.

### Vite 7 — declared twice, deliberately kept in step

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
      "~components": path.resolve(__dirname, "./src/components"),
      "~features": path.resolve(__dirname, "./src/features"),
    },
  },
});
```

```json
// tsconfig.json — the same set, or imports resolve in only one of the two
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "~components/*": ["./src/components/*"],
      "~features/*": ["./src/features/*"]
    }
  }
}
```

**Why good:** the pair is what makes an aliased import both bundle and type-check; which of the two is missing decides whether the build or the editor is the half that breaks.

```typescript
// BAD — the problem aliases exist to remove
import { formatDate } from "../../../lib/format-date";
```

**Why bad:** the path encodes the importer's location, so moving either file rewrites it, and no tooling can tell a wrong depth from a right one.

---

## Vendor Chunk Splitting

Group by release cadence rather than by subject: dependencies that upgrade together belong in one chunk, so a single upgrade invalidates one file instead of the whole vendor bundle.

### Vite 7 — `manualChunks`

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "framework-vendor": ["your-framework", "your-framework-dom"],
          "editor-vendor": ["your-rich-text-editor"],
          "charts-vendor": ["your-charting-library"],
        },
      },
    },
  },
});
```

**Why good:** each group is a cache unit; application code changing every deploy no longer invalidates dependencies that changed months ago.

### Vite 8 — `codeSplitting.groups`

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "framework-vendor",
              test: /[\\/]node_modules[\\/]your-framework(-dom)?[\\/]/,
            },
            {
              name: "editor-vendor",
              test: /[\\/]node_modules[\\/]your-rich-text-editor[\\/]/,
            },
          ],
        },
      },
    },
  },
});
```

**Why good:** the regex matches on resolved module id, so transitive files of a package land in the same group as its entry. Rolldown emits a `runtime.js` chunk beside the groups.

```typescript
// BAD — Vite 7 shapes carried into a Vite 8 config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vendor: ["your-framework"] },
      },
    },
  },
});
```

**Why bad:** `rollupOptions` still resolves as a deprecated alias, so the config loads and the build succeeds — but object-form `manualChunks` is removed, so the grouping never happens and nothing says so. Function-form `manualChunks` is accepted and deprecated, which fails the same way later.

---

## Per-Mode Builds

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // "" as the third argument returns every variable in the .env file,
  // including ones with no client prefix — server-side values, not build inputs
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      sourcemap: mode === "production" ? "hidden" : true,
      minify: mode === "production",
    },
    server: {
      proxy: { "/api": { target: env.API_PROXY_TARGET, changeOrigin: true } },
    },
  };
});
```

```json
// package.json — mode selects the .env file, so it needs to be explicit
{
  "scripts": {
    "dev": "vite --mode development",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production"
  }
}
```

**Why good:** minification stays out of the dev rebuild loop, `'hidden'` keeps production sourcemaps available to error reporting without linking them from the bundle, and `define` inlines only values that are safe to publish.

```typescript
// BAD — one config for every environment
export default defineConfig({
  build: { minify: true, sourcemap: true },
  define: { API_URL: JSON.stringify("https://api.production.com") },
});
```

**Why bad:** dev rebuilds pay for minification, production ships linked sourcemaps, and the inlined URL means staging cannot be tested without editing the config.

---

## Module Preload

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies: (filename, deps, { hostId, hostType }) =>
        deps.filter((dep) => !dep.includes("rarely-used-vendor")),
    },
  },
});
```

**Why good:** `resolveDependencies` decides what the initial document preloads, so a chunk only some routes need stops competing with the critical path. Dropping the polyfill is safe only where every target browser supports module preload natively.

```typescript
// BAD — the deprecated spelling
export default defineConfig({
  build: { polyfillModulePreload: false },
});
```

**Why bad:** `build.polyfillModulePreload` is deprecated in favour of `build.modulePreload.polyfill`, and it offers no way to influence which dependencies are preloaded.

---

## Sass

```typescript
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // The modern API is the default from Vite 6 and the only one from Vite 7
        additionalData: `@use "./src/styles/variables" as *;`,
      },
    },
  },
});
```

**Migration:** `@import` becomes `@use`/`@forward`, and members are reached through the namespace (`variables.$color-primary`) unless the load ends `as *`. A config still passing `api: "legacy"` fails on Vite 7 rather than falling back.

---

## Environment API

> For framework authors and multi-runtime builds. Still RC as of Vite 8; a single-client app needs none of it.

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: { sourcemap: false }, // inherited by every environment below
  environments: {
    client: { build: { outDir: "dist/client" } },
    ssr: { build: { outDir: "dist/server", ssr: true } },
    edge: {
      resolve: { noExternal: true }, // bundle every dependency for the edge runtime
      build: { outDir: "dist/edge" },
    },
  },
});
```

**Why good:** each environment maps to a runtime the output actually has to run in, and top-level options are the shared baseline rather than a fourth copy.

---

## Dev Server Proxy

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
```

**Why good:** requests stay same-origin in development, so no CORS configuration is needed for a backend that will be same-origin in production. `changeOrigin` rewrites the `Host` header, which backends that route on it require.

---

See [reference.md](../reference.md) for the settings tables, the per-version notes and the Vite 8 migration checklist.
