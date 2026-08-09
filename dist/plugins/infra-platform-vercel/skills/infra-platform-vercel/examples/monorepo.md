# Vercel -- Monorepo & Advanced Configuration Examples

> Monorepo setup, programmatic config, and advanced patterns for Vercel. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Configuration & Functions](core.md) -- vercel.json, functions, runtime selection
- [Routing & Middleware](routing.md) -- Headers, redirects, rewrites
- [Cron Jobs & Scheduling](cron-jobs.md) -- Scheduled task patterns

---

## Monorepo Setup

### Project Structure

```
my-monorepo/
  apps/
    web/           <-- Vercel project, Root Directory: apps/web
      vercel.json
      package.json
    docs/          <-- Separate Vercel project, Root Directory: apps/docs
      vercel.json
      package.json
  packages/
    ui/
    utils/
  package.json     <-- Root package.json
  turbo.json
```

### Key Configuration

1. **In the Vercel dashboard**, set Root Directory to the app path (e.g., `apps/web`)
2. **Always run `vercel` CLI from the monorepo root**, not from the app directory
3. **Each app is a separate Vercel project** with its own vercel.json

### vercel.json for Monorepo App

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm --filter web build",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./"
}
```

**Why good:** `pnpm --filter` builds only the target app, `ignoreCommand` skips builds when the app directory hasn't changed, saving build minutes

---

## Ignored Build Steps

### Skip Build When Directory Unchanged

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./"
}
```

### Nx Integration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "npx nx-ignore my-app"
}
```

### Custom Ignore Script

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "bash scripts/should-build.sh"
}
```

**How `ignoreCommand` works:**

- Exit code `1` = build continues
- Exit code `0` = build is skipped

---

## Programmatic Configuration with vercel.ts

`vercel.ts` runs at build time and generates configuration dynamically. Use the `@vercel/config` package for type safety.

```typescript
// vercel.ts -- dynamic configuration at build time
import { defineConfig } from "@vercel/config";

export default defineConfig({
  regions: [process.env.DEPLOY_REGION ?? "iad1"],
  functions: {
    "api/**/*.ts": {
      maxDuration: process.env.VERCEL_ENV === "production" ? 60 : 30,
    },
  },
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ],
  crons:
    process.env.VERCEL_ENV === "production"
      ? [{ path: "/api/cron/cleanup", schedule: "0 2 * * *" }]
      : [],
});
```

**Why good:** Type-safe with `defineConfig`, environment-aware (different maxDuration per env), crons only in production (they only run there anyway, but this makes intent explicit), dynamic region selection

**When to use vercel.ts over vercel.json:**

- You need environment-variable-based configuration
- Configuration needs to be generated from an external API at build time
- Shared config logic between multiple apps in a monorepo
- Conditional crons, headers, or rewrites based on deployment environment

---

## .vercelignore

Exclude files from deployment (like `.gitignore` for Vercel). In a monorepo, a `.vercelignore` in the Root Directory takes precedence over one at the repository root.

```
# .vercelignore
docs/
tests/
*.test.ts
*.spec.ts
.env.local
coverage/
```

---

## Image Optimization

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "images": {
    "sizes": [256, 640, 1080, 2048, 3840],
    "formats": ["image/avif", "image/webp"],
    "minimumCacheTTL": 60,
    "remotePatterns": [
      {
        "protocol": "https",
        "hostname": "images.example.com",
        "pathname": "/assets/**"
      }
    ],
    "localPatterns": [
      {
        "pathname": "^/public/images/.*$"
      }
    ]
  }
}
```

**Key properties:**

- `sizes` -- Allowed widths for the optimization API
- `formats` -- Output formats (avif and/or webp)
- `remotePatterns` -- Allow-list of external image domains
- `minimumCacheTTL` -- Cache duration in seconds for optimized images
- `dangerouslyAllowSVG` -- Disabled by default for security

---

## cleanUrls and trailingSlash

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false
}
```

| Setting                | Behavior                            |
| ---------------------- | ----------------------------------- |
| `cleanUrls: true`      | `/about.html` redirects to `/about` |
| `trailingSlash: false` | `/about/` redirects to `/about`     |
| `trailingSlash: true`  | `/about` redirects to `/about/`     |

**Gotcha:** `cleanUrls: true` causes 404 errors locally with `vercel dev` but works correctly when deployed.

See [reference.md](../reference.md) for Vercel CLI commands.
