# Turborepo - Caching Examples

> Remote caching, CI/CD integration, and cache behavior patterns. See [../SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for essential task pipeline patterns.

**Related Examples:**
- [core.md](core.md) - Essential task pipeline patterns (prerequisite)
- [workspaces.md](workspaces.md) - Workspace protocol, syncpack
- [packages.md](packages.md) - Internal package conventions

---

## Remote Caching Configuration

### Good Example - Remote caching with signature verification

```json
{
  "remoteCache": {
    "signature": true
  },
  "tasks": {
    "build": {
      "env": ["DATABASE_URL", "NODE_ENV", "NEXT_PUBLIC_API_URL"]
    }
  }
}
```

**Why good:** `signature: true` enables cache verification for security, `env` array declares all environment variables so different values trigger rebuilds, remote cache shares artifacts across team and CI reducing redundant builds

---

## Advanced Caching Configuration

### Good Example - Full turbo.json with advanced caching

```json
// turbo.json - Advanced caching configuration (Turborepo 2.x)
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.json",
    "eslint.config.js"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true,
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"]
    },
    "lint": {
      "cache": true,
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

**Why good:** `globalDependencies` ensures changes to shared config files invalidate all caches, `inputs` array fine-tunes what triggers test cache invalidation, `outputs: []` for lint means it caches the result without storing files, remote cache with signature verification is secure

---

## Cache Hit Examples

```bash
# Local development - uses local cache
npx turbo run build
# Cache miss - Building...
# Packages built: 5
# Time: 45.2s

# Second run - hits cache
npx turbo run build
# Cache hit - Skipping...
# Packages restored: 5
# Time: 1.2s (97% faster)

# Only rebuilds changed packages
# Edit packages/ui/src/Button.tsx
npx turbo run build
# Cache hit: @repo/types, @repo/config, @repo/api-client
# Cache miss: @repo/ui (changed)
# Cache miss: web, admin (depend on @repo/ui)
# Time: 12.4s (73% faster)
```

---

## CI/CD Integration Examples

### Good Example - Remote caching in GitHub Actions

```yaml
# .github/workflows/ci.yml - Remote caching in CI
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Needed for --filter

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      # Remote cache with Vercel
      - name: Build
        run: npx turbo run build
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

      # Only run affected tests on PRs
      - name: Test affected
        if: github.event_name == 'pull_request'
        run: npx turbo run test --filter=...[HEAD^]

      # Run all tests on main
      - name: Test all
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx turbo run test
```

**Why good:** `fetch-depth: 2` enables affected detection with `--filter=...[HEAD^]`, remote cache tokens shared via secrets, affected tests run only on PRs to save CI time, full tests run on main for comprehensive coverage

---

## Package.json Scripts Examples

### Good Example - Remote cache setup scripts

```json
// package.json - Remote cache setup
{
  "scripts": {
    "build": "turbo run build",
    "build:fresh": "turbo run build --force",
    "build:affected": "turbo run build --filter=...[HEAD^1]",
    "test:affected": "turbo run test --filter=...[HEAD^1]"
  }
}
```

**Why good:** `:fresh` script bypasses cache when needed, `:affected` scripts only run tasks for changed packages, clear naming convention indicates purpose

---
