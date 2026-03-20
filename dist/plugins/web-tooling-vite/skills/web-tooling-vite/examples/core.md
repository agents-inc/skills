# Vite - Core Examples

> Full code examples for Vite build configuration. See [SKILL.md](../SKILL.md) for pattern summaries and decision frameworks. See [reference.md](../reference.md) for lookup tables and migration checklist.

---

## Path Aliases

### Vite 7 (Manual resolve.alias)

```typescript
// ✅ Good Example - vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});
```

```json
// tsconfig.json - MUST stay in sync with vite.config.ts resolve.alias
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@features/*": ["./src/features/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

**Why good:** Clean imports eliminate relative path hell, aliases in both Vite and tsconfig ensures IDE and build resolution match

```typescript
// ❌ Bad Example - Deep relative imports
import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/utils/format-date";
```

**Why bad:** Deep relative imports break when files move, hard to read, no IDE auto-import support

---

### Vite 8 (Built-in tsconfigPaths)

```typescript
// ✅ Good Example - vite.config.ts (Vite 8)
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Reads paths from tsconfig.json automatically - no manual sync needed
    tsconfigPaths: true,
  },
});
```

**Why good:** Single source of truth (tsconfig.json), no manual sync, eliminates the `vite-tsconfig-paths` plugin

**Note:** `resolve.tsconfigPaths` is disabled by default due to performance cost. Enable only when using tsconfig paths.

---

## Vendor Chunk Splitting

### Vite 7 (manualChunks)

```typescript
// ✅ Good Example - vite.config.ts (Vite 7)
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks change rarely → browsers cache long-term
          "framework-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
          ],
        },
      },
    },
  },
});
```

**Why good:** Vendor chunks cached long-term, reduces main bundle size, parallel chunk loading

### Vite 8 (codeSplitting)

```typescript
// ✅ Good Example - vite.config.ts (Vite 8)
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "framework-vendor",
              test: /[\\/]node_modules[\\/]react(-dom|-router-dom)?[\\/]/,
            },
            {
              name: "query-vendor",
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: "ui-vendor",
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            },
          ],
        },
      },
    },
  },
});
```

**Why good:** `codeSplitting.groups` uses regex-based matching, more predictable than function-form, Rolldown's native chunking API

**Note:** Rolldown generates a `runtime.js` chunk alongside code-split groups.

```typescript
// ❌ Bad Example - Vite 7 APIs in Vite 8
export default defineConfig({
  build: {
    rollupOptions: {
      // DEPRECATED: use rolldownOptions in Vite 8
      output: {
        manualChunks: {
          // REMOVED: object-form manualChunks in Vite 8
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
```

**Why bad:** `build.rollupOptions` is a deprecated alias in Vite 8, object-form `manualChunks` is removed, function-form is deprecated

```typescript
// ❌ Bad Example - Deprecated function-form manualChunks in Vite 8
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (/\/react(?:-dom)?/.test(id)) return "vendor";
        },
      },
    },
  },
});
```

**Why bad:** Function-form `manualChunks` is deprecated in Rolldown/Vite 8, use `codeSplitting.groups` instead

---

## Environment-Specific Builds

```typescript
// ✅ Good Example - vite.config.ts
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    build: {
      sourcemap: mode === "development",
      minify: mode === "production",

      // Vite 7 example — use rolldownOptions + codeSplitting for Vite 8
      rollupOptions: {
        output: {
          manualChunks:
            mode === "production"
              ? { "framework-vendor": ["react", "react-dom"] }
              : undefined,
        },
      },
    },
  };
});
```

```json
// package.json
{
  "scripts": {
    "dev": "vite --mode development",
    "build:staging": "vite build --mode staging",
    "build:prod": "vite build --mode production"
  }
}
```

**Why good:** Conditional optimizations per environment, build-time constants enable dead code elimination, `loadEnv()` with `""` third arg loads all env vars (not just `VITE_`-prefixed)

```typescript
// ❌ Bad Example - Same config for all environments
export default defineConfig({
  build: { minify: true, sourcemap: true },
  define: { API_URL: JSON.stringify("https://api.production.com") },
});
```

**Why bad:** Always minifying slows dev builds, sourcemaps in production expose code, hardcoded URLs prevent testing against staging

---

## Module Preload Configuration

```typescript
// ✅ Good Example - vite.config.ts (Vite 6+)
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false, // disable for modern-only targets
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        return deps.filter((dep) => !dep.includes("large-vendor"));
      },
    },
  },
});
```

**Why good:** `build.modulePreload.polyfill` is the current API, `resolveDependencies` gives fine-grained control over preloaded chunks

```typescript
// ❌ DEPRECATED: build.polyfillModulePreload
export default defineConfig({
  build: {
    polyfillModulePreload: false, // Use modulePreload.polyfill instead
  },
});
```

**Why bad:** `polyfillModulePreload` is deprecated, no control over which dependencies get preloaded

---

## Environment API (Vite 6+ Experimental)

> Primarily for framework authors. Remains in RC phase as of Vite 8. Most apps do not need this.

```typescript
// ✅ Good Example - Multi-environment configuration
import { defineConfig } from "vite";

export default defineConfig({
  build: { sourcemap: false }, // applies to all environments
  environments: {
    client: {
      build: { outDir: "dist/client" },
    },
    ssr: {
      build: { outDir: "dist/server", ssr: true },
    },
    edge: {
      resolve: { noExternal: true }, // bundle all deps for edge
      build: { outDir: "dist/edge" },
    },
  },
});
```

**Why good:** One config file for all environments, environments inherit top-level options, each maps to a production runtime

**When to use:** Framework authors, edge runtime deployments, apps with multiple build targets

**When NOT to use:** Simple SPAs (single client environment works automatically)

---

## Sass Configuration (Vite 6+)

```typescript
// ✅ Good Example - Sass Modern API (default in Vite 6+)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Modern API is the default — no need to specify
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Why good:** Modern Sass API is faster and the default, `@use` replaces deprecated `@import`

**Migration:** Replace `@import` with `@use`/`@forward`, use namespaced access (`variables.$color-primary`), test before removing `api: 'legacy'`.

---

## Dev Server Proxy

```typescript
// ✅ Good Example - vite.config.ts
import { defineConfig } from "vite";

const DEV_SERVER_PORT = 3000;
const API_PROXY_TARGET = "http://localhost:8000";

export default defineConfig({
  server: {
    port: DEV_SERVER_PORT,
    proxy: {
      "/api": { target: API_PROXY_TARGET, changeOrigin: true },
    },
  },
});
```

**Why good:** API proxy avoids CORS issues in development, named constants for configuration values

---

See [reference.md](../reference.md) for quick-lookup tables, migration checklist, and external links.
