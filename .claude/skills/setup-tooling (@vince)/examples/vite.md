# Tooling - Vite Configuration

> Vite build tool patterns for frontend apps including path aliases, vendor chunk splitting, and environment-specific builds. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

---

## Vite Version Notes

> **Vite 6** (Current Stable): Introduces experimental Environment API, Sass modern API by default, Node.js 18/20/22+ support.
> **Vite 7** (Next Major): Requires Node.js 20.19+ or 22.12+, removes Sass legacy API, changes default target to `'baseline-widely-available'`.
> **Rolldown** (Experimental): Available via `rolldown-vite` package - 16x faster builds, deprecates `manualChunks` in favor of `advancedChunks`.

---

## Path Aliases

```typescript
// vite.config.ts
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
          // Vendor chunks
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
// tsconfig.json
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

**Why good:** Clean imports eliminate relative path hell, vendor chunk splitting reduces main bundle size, API proxy enables local development without CORS issues

```typescript
// BAD: No path aliases
import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/utils/format-date";

export default defineConfig({
  // No vendor chunk splitting - large main bundle
  build: {},
});
```

**Why bad:** Deep relative imports break when files move, no chunk splitting creates large initial bundles slowing page load, missing API proxy forces CORS workarounds

---

## Rolldown advancedChunks (Vite 8+ / rolldown-vite)

> When using Rolldown-powered Vite, `manualChunks` is deprecated in favor of `advancedChunks` which provides more fine-grained control similar to webpack's `splitChunk`.

```typescript
// vite.config.ts with Rolldown
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // advancedChunks replaces manualChunks in Rolldown
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
            { name: "ui-vendor", test: /[\\/]node_modules[\\/]@radix-ui[\\/]/ },
          ],
        },
      },
    },
  },
});
```

**Why good:** `advancedChunks.groups` provides array-based matching like webpack's splitChunk, more predictable than function-based `manualChunks`, better support for complex splitting strategies.

```typescript
// ❌ DEPRECATED in Rolldown: manualChunks function
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

**Why bad:** `manualChunks` is deprecated in Rolldown (still works in standard Vite/Rollup), less fine-grained control than `advancedChunks.groups`.

---

## Environment-Specific Builds

```typescript
// vite.config.ts
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
// BAD: Same config for all environments
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
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Module preload polyfill configuration (Vite 6+)
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

**Why good:** `build.modulePreload.polyfill` is the new API (replaces deprecated `build.polyfillModulePreload`), `resolveDependencies` enables fine-grained control over which chunks get preloaded.

```typescript
// ❌ DEPRECATED: build.polyfillModulePreload (Vite 5 and earlier)
export default defineConfig({
  build: {
    polyfillModulePreload: false, // Use modulePreload.polyfill instead
  },
});
```

**Why bad:** `polyfillModulePreload` is deprecated in favor of `modulePreload.polyfill`, no control over which dependencies get preloaded.

---

## Environment API (Vite 6+ Experimental)

> The Environment API allows configuring multiple build/dev environments (client, ssr, edge, etc.) in a single Vite config. This is primarily for framework authors.

```typescript
// vite.config.ts - Multi-environment configuration
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

**Why good:** Multiple environments can be configured in one file, environments inherit top-level options, each environment maps to production runtime behavior, enables framework authors to build closer-to-production dev experiences.

**When to use:** Framework authors building SSR/SSG frameworks, edge runtime deployments (Cloudflare Workers, Vercel Edge), applications with multiple build targets.

**When NOT to use:** Simple SPAs (single client environment works automatically), unless you're a framework author - most users won't need this directly.

---

## Key Configuration Points

| Setting                  | Development | Production                    | Notes                                             |
| ------------------------ | ----------- | ----------------------------- | ------------------------------------------------- |
| `sourcemap`              | `true`      | `false`                       | Use `'hidden'` for production with error tracking |
| `minify`                 | `false`     | `true` (esbuild)              | esbuild is 20-40x faster than Terser              |
| `manualChunks`           | `undefined` | Vendor splitting              | Deprecated in Rolldown; use `advancedChunks`      |
| `modulePreload.polyfill` | `true`      | `true`                        | Disable for modern-only targets                   |
| `target`                 | N/A         | `'baseline-widely-available'` | Vite 7 default; Chrome 107+, Safari 16+           |

---

## Build Target Defaults (Vite 7+)

| Target                        | Browser Support                                  | Notes                                   |
| ----------------------------- | ------------------------------------------------ | --------------------------------------- |
| `'baseline-widely-available'` | Chrome 107+, Edge 107+, Firefox 104+, Safari 16+ | New Vite 7 default                      |
| `'modules'`                   | **DEPRECATED**                                   | Was Vite 5 default; no longer available |
| `'esnext'`                    | Latest browsers only                             | Minimal transpilation                   |
| `['chrome87', 'safari14']`    | Custom browser list                              | Explicit control                        |

---

## Sass Configuration (Vite 6+)

```typescript
// vite.config.ts - Sass Modern API (default in Vite 6)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Modern API is now the default - no need to specify
        // api: 'modern', // This is the default in Vite 6+

        // Legacy API - deprecated, removed in Vite 7
        // api: 'legacy', // Only if you MUST use legacy

        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Why good:** Modern Sass API is faster and recommended, Vite 6 uses it by default.

**Migration note:** If using legacy Sass features, temporarily set `api: 'legacy'` but plan to migrate before Vite 7.

---

## See Also

- [core.md](core.md) for Prettier configuration
- [eslint.md](eslint.md) for linting integration
- [typescript.md](typescript.md) for path alias sync with tsconfig
- [Vite 6 Announcement](https://vite.dev/blog/announcing-vite6) - Official release notes
- [Vite Migration Guide](https://vite.dev/guide/migration) - Breaking changes and migration paths
- [Rolldown Integration](https://vite.dev/guide/rolldown) - Experimental Rust-powered bundler
