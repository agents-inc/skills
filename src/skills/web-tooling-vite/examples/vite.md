# Vite Configuration Examples

> Vite build tool patterns for frontend apps including path aliases, vendor chunk splitting, environment-specific builds, and Rolldown migration. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

---

## Vite Version Notes

> **Vite 8** (Current Stable, March 2026): Rolldown replaces esbuild+Rollup as the default bundler. `build.rollupOptions` renamed to `build.rolldownOptions`. Object-form `manualChunks` removed, replaced by `codeSplitting.groups`. Built-in `resolve.tsconfigPaths`. 10-30x faster builds.
> **Vite 7** (June 2025): Requires Node.js 20.19+ or 22.12+. Removes Sass legacy API. Removes `splitVendorChunkPlugin`. Default target changed to `'baseline-widely-available'`. Experimental Rolldown via `rolldown-vite`.
> **Vite 6**: Introduces experimental Environment API, Sass modern API by default, Node.js 18/20/22+ support.

---

## Path Aliases

### Vite 7 (Manual resolve.alias)

```typescript
// ✅ Good Example - vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - change rarely, cached long-term
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
          ],
        },
      },
    },
  },

  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
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
      "@lib/*": ["./src/lib/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

**Why good:** Clean imports eliminate relative path hell, vendor chunk splitting reduces main bundle size, API proxy enables local development without CORS issues, tsconfig paths in sync with Vite aliases for consistent IDE and build resolution

```typescript
// ❌ Bad Example - No path aliases
import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/utils/format-date";

export default defineConfig({
  // No vendor chunk splitting - large main bundle
  build: {},
});
```

**Why bad:** Deep relative imports break when files move, no chunk splitting creates large initial bundles slowing page load, missing API proxy forces CORS workarounds

---

### Vite 8 (Built-in tsconfigPaths)

```typescript
// ✅ Good Example - vite.config.ts (Vite 8)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Reads paths from tsconfig.json automatically - no manual sync needed
    tsconfigPaths: true,
  },

  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
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

**Why good:** `resolve.tsconfigPaths` eliminates manual alias sync, `codeSplitting.groups` is Rolldown's native chunking API, `build.rolldownOptions` is the correct Vite 8 option name

**Note:** `resolve.tsconfigPaths` is disabled by default due to performance considerations. Enable only if using tsconfig paths.

```typescript
// ❌ Bad Example - Using Vite 7 APIs in Vite 8
export default defineConfig({
  build: {
    rollupOptions: {
      // WRONG: renamed to rolldownOptions in Vite 8
      output: {
        manualChunks: {
          // WRONG: object-form removed in Vite 8
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
```

**Why bad:** `build.rollupOptions` is renamed to `build.rolldownOptions` in Vite 8, object-form `manualChunks` is removed in Vite 8 (use `codeSplitting.groups`)

---

## Rolldown codeSplitting (Vite 8)

> In Vite 8, Rolldown is the default bundler. The `advancedChunks` option from earlier Rolldown versions was renamed to `codeSplitting`. The object-form `manualChunks` is removed; the function-form is deprecated.

```typescript
// ✅ Good Example - Vite 8 with codeSplitting
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /[\\/]node_modules[\\/]react(-dom)?[\\/]/,
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

**Why good:** `codeSplitting.groups` provides array-based matching like webpack's splitChunk, more predictable than function-based `manualChunks`, Rolldown's recommended approach for manual code splitting

```typescript
// ❌ Bad Example - Deprecated function-form manualChunks in Vite 8
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // DEPRECATED in Vite 8 / Rolldown
        manualChunks(id) {
          if (/\/react(?:-dom)?/.test(id)) {
            return "vendor";
          }
        },
      },
    },
  },
});
```

**Why bad:** Function-form `manualChunks` is deprecated in Rolldown/Vite 8, less fine-grained control than `codeSplitting.groups`, object-form is completely removed

---

## Rolldown advancedChunks (Vite 7 rolldown-vite)

> When using `rolldown-vite` with Vite 7, `manualChunks` is deprecated in favor of `advancedChunks` which provides more fine-grained control. Note: `advancedChunks` was renamed to `codeSplitting` in Vite 8.

```typescript
// ✅ Good Example - Vite 7 with rolldown-vite
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // advancedChunks replaces manualChunks in rolldown-vite
        advancedChunks: {
          groups: [
            {
              name: "react-vendor",
              test: /[\\/]node_modules[\\/]react(-dom)?[\\/]/,
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

**Why good:** `advancedChunks.groups` provides array-based matching like webpack's splitChunk, more predictable than function-based `manualChunks`, better support for complex splitting strategies

```typescript
// ❌ DEPRECATED in rolldown-vite: manualChunks function
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (/\/react(?:-dom)?/.test(id)) {
          return "vendor";
        }
      },
    },
  },
}
```

**Why bad:** `manualChunks` is deprecated in rolldown-vite (still works in standard Vite 7/Rollup), less fine-grained control than `advancedChunks.groups`

---

## Environment-Specific Builds

```typescript
// ✅ Good Example - vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    build: {
      sourcemap: mode === "development",
      minify: mode === "production",

      // Vite 7 example - use rolldownOptions + codeSplitting for Vite 8
      rollupOptions: {
        output: {
          manualChunks:
            mode === "production"
              ? {
                  "react-vendor": ["react", "react-dom"],
                }
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

```
# .env files
.env.development    # Development settings
.env.staging        # Staging settings
.env.production     # Production settings
```

**Why good:** Conditional optimizations improve production builds without slowing development, environment-specific API endpoints enable testing against staging/production, build-time constants enable dead code elimination

```typescript
// ❌ Bad Example - Same config for all environments
export default defineConfig({
  // Always minify and source map - slow dev builds
  build: {
    minify: true,
    sourcemap: true,
  },
  // Hardcoded API endpoint
  define: {
    API_URL: JSON.stringify("https://api.production.com"),
  },
});
```

**Why bad:** Always minifying slows development builds, always generating source maps in production exposes code, hardcoded API URLs prevent testing against different environments

---

## Module Preload Configuration

```typescript
// ✅ Good Example - vite.config.ts (Vite 6+)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      // Disable polyfill for modern-only targets
      polyfill: false,
      // Fine-grained control over preloaded dependencies
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        // Filter out large dependencies from preload
        return deps.filter((dep) => !dep.includes("large-vendor"));
      },
    },
  },
});
```

**Why good:** `build.modulePreload.polyfill` is the current API (replaces deprecated `build.polyfillModulePreload`), `resolveDependencies` enables fine-grained control over which chunks get preloaded

```typescript
// ❌ DEPRECATED: build.polyfillModulePreload (Vite 5 and earlier)
export default defineConfig({
  build: {
    polyfillModulePreload: false, // Use modulePreload.polyfill instead
  },
});
```

**Why bad:** `polyfillModulePreload` is deprecated in favor of `modulePreload.polyfill`, no control over which dependencies get preloaded

---

## Environment API (Vite 6+ Experimental)

> The Environment API allows configuring multiple build/dev environments (client, ssr, edge, etc.) in a single Vite config. This is primarily for framework authors and remains in RC phase as of Vite 8.

```typescript
// ✅ Good Example - vite.config.ts - Multi-environment configuration
import { defineConfig } from "vite";

export default defineConfig({
  // Top-level options apply to all environments
  build: {
    sourcemap: false,
  },
  // Per-environment configuration
  environments: {
    // Client environment (default for SPAs)
    client: {
      build: {
        outDir: "dist/client",
      },
    },
    // SSR environment
    ssr: {
      build: {
        outDir: "dist/server",
        ssr: true,
      },
    },
    // Edge runtime environment (e.g., Cloudflare Workers)
    edge: {
      resolve: {
        noExternal: true, // Bundle all dependencies for edge
      },
      build: {
        outDir: "dist/edge",
      },
    },
  },
});
```

**Why good:** Multiple environments can be configured in one file, environments inherit top-level options, each environment maps to production runtime behavior, enables framework authors to build closer-to-production dev experiences

**When to use:** Framework authors building SSR/SSG frameworks, edge runtime deployments (Cloudflare Workers, Vercel Edge), applications with multiple build targets

**When NOT to use:** Simple SPAs (single client environment works automatically), unless you are a framework author - most users will not need this directly

---

## Key Configuration Points

| Setting                  | Development | Production                    | Notes                                               |
| ------------------------ | ----------- | ----------------------------- | --------------------------------------------------- |
| `sourcemap`              | `true`      | `false`                       | Use `'hidden'` for production with error tracking   |
| `minify`                 | `false`     | `true` (Oxc in Vite 8)        | Oxc minifier in Vite 8, esbuild in Vite 7           |
| Chunk splitting          | `undefined` | Vendor splitting              | `manualChunks` (Vite 7) or `codeSplitting` (Vite 8) |
| `modulePreload.polyfill` | `true`      | `true`                        | Disable for modern-only targets                     |
| `target`                 | N/A         | `'baseline-widely-available'` | Vite 7+ default                                     |

---

## Build Target Defaults

| Target                        | Browser Support                                    | Notes                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------- |
| `'baseline-widely-available'` | Chrome 107+, Edge 107+, Firefox 104+, Safari 16+   | Vite 7 default                        |
| (Vite 8 default)              | Chrome 111+, Edge 111+, Firefox 104+, Safari 16.4+ | Updated in Vite 8                     |
| `'modules'`                   | **DEPRECATED**                                     | Was Vite 5 default; removed in Vite 7 |
| `'esnext'`                    | Latest browsers only                               | Minimal transpilation                 |
| `['chrome111', 'safari16.4']` | Custom browser list                                | Explicit control                      |

---

## Sass Configuration (Vite 6+)

```typescript
// ✅ Good Example - Sass Modern API (default in Vite 6+)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Modern API is now the default - no need to specify
        // api: 'modern', // This is the default in Vite 6+

        // Legacy API - deprecated, removed in Vite 7+
        // api: 'legacy', // Only if you MUST use legacy temporarily

        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Why good:** Modern Sass API is faster and recommended, Vite 6+ uses it by default

**Migration note:** If using legacy Sass features, temporarily set `api: 'legacy'` but plan to migrate before Vite 7. Replace `@import` with `@use`/`@forward`.

---

## Vite 8 Migration Checklist

When migrating from Vite 7 to Vite 8:

1. **Rename `build.rollupOptions`** to `build.rolldownOptions`
2. **Replace `manualChunks`** with `codeSplitting.groups` (object-form removed, function-form deprecated)
3. **Update browser targets** if pinned (defaults updated: Chrome 107 to 111, Safari 16.0 to 16.4)
4. **Remove `build.commonjsOptions`** (now a no-op)
5. **Remove `resolve.alias[].customResolver`** (removed)
6. **Consider `resolve.tsconfigPaths: true`** to replace manual alias configuration
7. **Check esbuild config** - now auto-converted to Oxc (`esbuild` option converts to `oxc` option)
8. **Note install size increase** - ~15MB larger (lightningcss + Rolldown)

---

## See Also

- [reference.md](../reference.md) for decision frameworks and anti-patterns
- [Vite 8 Announcement](https://vite.dev/blog/announcing-vite8) - Official release notes
- [Vite 7 Announcement](https://vite.dev/blog/announcing-vite7) - Vite 7 release notes
- [Vite Migration Guide](https://vite.dev/guide/migration) - Breaking changes and migration paths
- [Rolldown Manual Code Splitting](https://rolldown.rs/in-depth/manual-code-splitting) - codeSplitting documentation
