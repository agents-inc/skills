---
name: web-tooling-vite
description: Vite config, path aliases, vendor chunk splitting (manualChunks), environment-specific builds, Rolldown advancedChunks, Environment API, Sass modern API, build targets, module preload
---

# Vite Build Tool Patterns

> **Quick Guide:** Vite is the build tool for frontend apps. Configure path aliases in both `vite.config.ts` and `tsconfig.json`. Use vendor chunk splitting (`manualChunks` in Vite 7, `codeSplitting` in Vite 8). Use `loadEnv()` for environment-specific builds. Vite 8 uses Rolldown (Rust bundler) by default with `build.rolldownOptions`.
>
> **Current versions:** Vite 8 (stable, March 2026) with Rolldown bundler. Vite 7 (June 2025) still widely deployed.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST keep path aliases in sync between `vite.config.ts` (or `resolve.tsconfigPaths`) and `tsconfig.json` - mismatches cause import resolution failures)**

**(You MUST use `build.rolldownOptions` in Vite 8+ - `build.rollupOptions` is renamed)**

**(You MUST use `codeSplitting.groups` for chunk splitting in Vite 8 - object-form `manualChunks` is removed, function-form deprecated)**

**(You MUST use `build.modulePreload.polyfill` instead of deprecated `build.polyfillModulePreload`)**

**(You MUST use Sass modern API (default in Vite 6+) - legacy API is removed in Vite 7+)**

</critical_requirements>

---

**Auto-detection:** Vite, vite.config.ts, vite.config.js, @vitejs/plugin-react, manualChunks, advancedChunks, codeSplitting, loadEnv, rolldownOptions, rollupOptions, modulePreload, resolve.alias, resolve.tsconfigPaths, build.target, baseline-widely-available

**When to use:**

- Configuring Vite build tool for frontend applications
- Setting up path aliases with tsconfig sync
- Vendor chunk splitting for production builds
- Environment-specific build configuration (dev/staging/prod)
- Migrating from Vite 7 (Rollup) to Vite 8 (Rolldown)
- Configuring module preload, build targets, or Sass preprocessing

**When NOT to use:**

- Server-side build processes (e.g., Docker builds, CI/CD pipelines)
- ESLint or Prettier configuration (see `shared-tooling-eslint-prettier`)
- TypeScript compiler options (see `shared-tooling-typescript-config`)
- Git hooks or commit linting (see `shared-tooling-git-hooks`)

**Key patterns covered:**

- Path aliases with tsconfig sync (and Vite 8 `resolve.tsconfigPaths`)
- Vendor chunk splitting (`manualChunks` for Vite 7, `codeSplitting` for Vite 8)
- Environment-specific builds with `loadEnv`
- Build-time constants with `define` option
- Module preload configuration
- Sass modern API configuration
- Rolldown migration (Vite 7 experimental, Vite 8 default)
- Environment API (experimental, primarily for framework authors)
- Build target selection (`baseline-widely-available`)

**Detailed resources:**

- For code examples, see [examples/vite.md](examples/vite.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Related skills:**

- For TypeScript compiler configuration and path aliases in tsconfig, see `shared-tooling-typescript-config`
- For daily coding conventions (naming, imports, constants), see CLAUDE.md

---

<philosophy>

## Philosophy

Vite should be **fast, zero-config by default, and environment-aware**. The build tool stays out of your way during development (instant HMR) and optimizes aggressively for production (chunk splitting, minification, tree-shaking).

**When to use this skill:**

- Setting up new frontend apps with Vite
- Optimizing production builds (chunk splitting, code splitting)
- Configuring environment-specific settings (dev/staging/prod)
- Setting up path aliases for clean imports
- Migrating between Vite major versions (7 to 8)
- Configuring Sass, build targets, or module preload

**When NOT to use:**

- Runtime application code (this is build-time configuration only)
- Server-side rendering framework config (use meta-framework skills: Next.js, Remix, etc.)
- CI/CD pipeline configuration
- ESLint, Prettier, or TypeScript compiler settings (separate skills)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Path Aliases

Configure path aliases in both `vite.config.ts` and `tsconfig.json` to eliminate deep relative imports. In Vite 8, you can use the built-in `resolve.tsconfigPaths` option instead of manual `resolve.alias`.

#### Vite 7 (Manual Aliases)

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
});
```

```json
// tsconfig.json - MUST stay in sync with vite.config.ts
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

**Why good:** Clean imports eliminate relative path hell, aliases defined in both Vite and tsconfig ensures IDE resolution and build resolution match

#### Vite 8 (Built-in tsconfig Paths)

```typescript
// vite.config.ts - Vite 8 only
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  resolve: {
    // Reads paths from tsconfig.json automatically
    tsconfigPaths: true,
  },
});
```

**Why good:** Single source of truth for path aliases (tsconfig.json), no manual sync needed, eliminates the `vite-tsconfig-paths` plugin dependency

**When to use:** Vite 8+ projects where tsconfig paths are the only alias source

**When not to use:** Vite 7 projects (option does not exist), or when you need aliases that differ from tsconfig paths

```typescript
// ❌ Bad Example - No path aliases
import { Button } from "../../../components/ui/button";
import { formatDate } from "../../../lib/utils/format-date";
```

**Why bad:** Deep relative imports break when files move, hard to read, no IDE auto-import support

---

### Pattern 2: Vendor Chunk Splitting

Split vendor dependencies into separate chunks for better caching. The API differs between Vite 7 (Rollup-based) and Vite 8 (Rolldown-based).

#### Vite 7 (manualChunks)

```typescript
// vite.config.ts - Vite 7
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
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
});
```

**Why good:** Vendor chunks change rarely so browsers cache them long-term, reduces main bundle size, parallel loading of chunks

#### Vite 8 (codeSplitting)

```typescript
// vite.config.ts - Vite 8
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

**Why good:** `codeSplitting.groups` provides regex-based matching like webpack's splitChunk, more predictable than function-based `manualChunks`, Rolldown's native chunking strategy

**Note:** Rolldown generates a `runtime.js` chunk when using `codeSplitting.groups` to ensure runtime code executes before other chunks.

```typescript
// ❌ Bad Example - No chunk splitting
export default defineConfig({
  build: {},
});
```

**Why bad:** All vendor code bundled into main chunk, no caching benefit on deploys, large initial bundle slows page load

```typescript
// ❌ Bad Example - Object-form manualChunks in Vite 8 (REMOVED)
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        manualChunks: {
          // Object form is removed in Vite 8 / Rolldown
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
```

**Why bad:** Object-form `manualChunks` is removed in Vite 8, function-form is deprecated, use `codeSplitting.groups` instead

---

### Pattern 3: Environment-Specific Builds

Use `loadEnv()` for environment-aware configuration and the `define` option for build-time constants.

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
  build: {
    minify: true,
    sourcemap: true,
  },
  define: {
    API_URL: JSON.stringify("https://api.production.com"),
  },
});
```

**Why bad:** Always minifying slows development builds, always generating source maps in production exposes code, hardcoded API URLs prevent testing against different environments

---

### Pattern 4: Module Preload Configuration

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

### Pattern 5: Sass Configuration (Vite 6+)

```typescript
// vite.config.ts - Sass Modern API (default in Vite 6+)
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Modern API is the default in Vite 6+ - no need to specify
        // api: 'modern', // This is the default

        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
  },
});
```

**Why good:** Modern Sass API is faster and recommended, Vite 6+ uses it by default, `@use` replaces deprecated `@import`

```typescript
// ❌ ANTI-PATTERN: Legacy Sass API (removed in Vite 7+)
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

**Why bad:** Sass legacy API is deprecated in Vite 6 and completely removed in Vite 7+, migration required before upgrading

**Migration notes:**

- Replace `@import` with `@use` and `@forward`
- Use namespaced access for variables/mixins: `variables.$color-primary`
- Test thoroughly before removing `api: 'legacy'`

---

### Pattern 6: Environment API (Vite 6+ Experimental)

> The Environment API allows configuring multiple build/dev environments (client, ssr, edge, etc.) in a single Vite config. This is **primarily for framework authors** and remains in RC phase.

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

**Why good:** Multiple environments can be configured in one file, environments inherit top-level options, each environment maps to production runtime behavior, enables framework authors to build closer-to-production dev experiences

**When to use:** Framework authors building SSR/SSG frameworks, edge runtime deployments (Cloudflare Workers, Vercel Edge), applications with multiple build targets

**When NOT to use:** Simple SPAs (single client environment works automatically), unless you are a framework author - most users do not need this directly. The API is still in RC phase and breaking changes are possible.

---

### Pattern 7: Dev Server Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_SERVER_PORT = 3000;
const API_PROXY_TARGET = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],

  server: {
    port: DEV_SERVER_PORT,
    proxy: {
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
```

**Why good:** API proxy enables local development without CORS issues, named constants for port and target

</patterns>

---

<decision_framework>

## Decision Framework

### Vite Version Selection

```
Which Vite version?
├─ New project (March 2026+)?
│   └─ Vite 8 (Rolldown bundler, fastest builds) ✓
├─ Existing Vite 7 project?
│   ├─ Build performance is a bottleneck?
│   │   └─ YES → Migrate to Vite 8 (10-30x faster)
│   └─ NO → Stay on Vite 7 (stable, no migration needed)
└─ Existing Vite 6 project?
    └─ Plan upgrade to Vite 7 first, then Vite 8
```

### Chunk Splitting Strategy

```
How to split chunks?
├─ Vite 8 (Rolldown)?
│   └─ Use codeSplitting.groups with regex patterns ✓
├─ Vite 7 (Rollup)?
│   └─ Use manualChunks object form ✓
└─ Vite 7 with rolldown-vite (experimental)?
    └─ Use advancedChunks.groups (renamed to codeSplitting in Vite 8)
```

### Path Alias Strategy

```
How to configure path aliases?
├─ Vite 8?
│   ├─ Simple tsconfig paths only?
│   │   └─ Use resolve.tsconfigPaths: true ✓
│   └─ Need aliases different from tsconfig?
│       └─ Use resolve.alias (manual configuration)
└─ Vite 7 or earlier?
    └─ Use resolve.alias + sync with tsconfig.json ✓
```

See [reference.md](reference.md) for additional decision frameworks (Vite vs Rolldown-Vite, Build Target Selection).

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Using `build.rollupOptions` in Vite 8 (renamed to `build.rolldownOptions`)
- ❌ Using object-form `manualChunks` in Vite 8 (removed; use `codeSplitting.groups`)
- ❌ Using deprecated `build.polyfillModulePreload` (use `build.modulePreload.polyfill`)
- ❌ Using deprecated `splitVendorChunkPlugin` (removed in Vite 7+; use `manualChunks` or `codeSplitting`)
- ❌ Using `target: 'modules'` (deprecated in Vite 7; use `'baseline-widely-available'`)
- ❌ Using Sass legacy API `api: 'legacy'` (removed in Vite 7+)
- ❌ Path aliases in `vite.config.ts` but not `tsconfig.json` (or vice versa) - causes import resolution failures

**Medium Priority Issues:**

- ⚠️ No vendor chunk splitting in production builds (large initial bundles)
- ⚠️ Same build config for all environments (slow dev builds, exposed source maps in prod)
- ⚠️ Hardcoded API URLs instead of environment variables
- ⚠️ Using `Environment API` in production apps (still RC phase, breaking changes possible)
- ⚠️ Function-form `manualChunks` in Vite 8 (deprecated, works but migrate to `codeSplitting`)

**Common Mistakes:**

- Forgetting to sync tsconfig paths with Vite resolve.alias (causes import resolution failures at build time but not in IDE)
- Using `build.rollupOptions` in Vite 8 instead of `build.rolldownOptions` (silent no-op or warning)
- Committing `.env` files with secrets (use `.env.local` for secrets, add to `.gitignore`)
- Setting `minify: true` in development mode (slows rebuilds significantly)
- Always generating sourcemaps in production (exposes source code)

**Gotchas & Edge Cases:**

- **Vite 8**: `build.rollupOptions` is renamed to `build.rolldownOptions` - old name may silently fail
- **Vite 8**: Object-form `manualChunks` is removed entirely, function-form is deprecated
- **Vite 8**: Rolldown generates a `runtime.js` chunk when using `codeSplitting.groups`
- **Vite 8**: Default browser targets updated to Chrome 111+, Edge 111+, Firefox 104+, Safari 16.4+
- **Vite 8**: `resolve.tsconfigPaths` disabled by default due to performance considerations
- **Vite 8**: Install size increased ~15MB (10MB lightningcss, 5MB Rolldown)
- **Vite 7**: Node.js 18 dropped - requires Node.js 20.19+ or 22.12+
- **Vite 7**: Sass legacy API completely removed - migrate to modern API before upgrading
- **Vite 7**: `splitVendorChunkPlugin` removed - migrate to `manualChunks` before upgrading
- **Vite 7**: Default target changed from `'modules'` to `'baseline-widely-available'`
- **Vite 6**: Environment API is experimental - do not use `environments` config in production apps yet
- **Vite 6**: `options.ssr` in plugin hooks will be deprecated - use `this.environment` instead
- **Rolldown**: `advancedChunks` was renamed to `codeSplitting` in Rolldown/Vite 8
- **Rolldown**: `codeSplitting.maxSize` acts as a target, not a strict limit
- **Rolldown**: `includeDependenciesRecursively` defaults to true - may pull in more than expected
- TypeScript path aliases must be configured in BOTH tsconfig and build tool (Vite 7) or use `resolve.tsconfigPaths` (Vite 8)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST keep path aliases in sync between `vite.config.ts` (or `resolve.tsconfigPaths`) and `tsconfig.json` - mismatches cause import resolution failures)**

**(You MUST use `build.rolldownOptions` in Vite 8+ - `build.rollupOptions` is renamed)**

**(You MUST use `codeSplitting.groups` for chunk splitting in Vite 8 - object-form `manualChunks` is removed, function-form deprecated)**

**(You MUST use `build.modulePreload.polyfill` instead of deprecated `build.polyfillModulePreload`)**

**(You MUST use Sass modern API (default in Vite 6+) - legacy API is removed in Vite 7+)**

**Failure to follow these rules will cause build failures, broken imports, or deprecated API warnings.**

</critical_reminders>
