# Turborepo CI - Docker Examples

> turbo prune --docker for optimized Docker builds, multi-stage Dockerfile patterns, and layer caching. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for turbo.json task configuration.

---

## Pattern 1: turbo prune --docker

### Generate Pruned Workspace

```bash
# Prune to only packages needed for 'web' app
turbo prune web --docker

# Output structure:
# out/
#   json/           # package.json files only (for dependency install layer)
#   full/           # Full source code (for build layer)
#   package-lock.json  # Pruned lockfile (subset of root lockfile)
```

**Why --docker flag:** Splits output into `json/` (package manifests) and `full/` (source). This enables Docker layer caching: the dependency install layer only invalidates when `package.json` files change, not when source code changes.

**Without --docker:** All files land in a single directory, meaning any source change invalidates the dependency install layer.

---

## Pattern 2: Multi-Stage Dockerfile

```dockerfile
# Stage 0: Generate pruned monorepo
FROM node:20-alpine AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune web --docker

# Stage 1: Install dependencies (cached unless package.json/lockfile changes)
FROM node:20-alpine AS deps
WORKDIR /app
# Copy only package manifests and pruned lockfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm install --frozen-lockfile

# Stage 2: Build (cached unless source changes)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app .
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=web

# Stage 3: Production image (minimal)
FROM node:20-alpine AS runner
WORKDIR /app
# Copy only the built output (adjust paths to your framework's output)
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/public ./public

CMD ["node", "dist/server.js"]
```

**Why good:** Four distinct layers with clear cache invalidation boundaries. Source changes only invalidate stage 2+. Dependency changes invalidate stage 1+. The production image contains only runtime artifacts.

### Bad Example: No Pruning

```dockerfile
# ❌ Bad - Copies entire monorepo, no layer separation
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npx turbo run build --filter=web
CMD ["node", "apps/web/server.js"]
```

**Why bad:** Any file change in any package invalidates ALL layers. Docker rebuilds everything from `COPY . .` forward. No lockfile pruning means unrelated package additions bust the install cache. Production image includes all source, devDependencies, and build tools.

---

## Pattern 3: Custom Output Directory

```bash
# Change output directory (default: ./out)
turbo prune web --docker --out=./docker-context

# Use in Dockerfile
COPY --from=pruner /app/docker-context/json/ .
```

---

## Pattern 4: Respect .gitignore

```bash
# Exclude gitignored files from pruned output
turbo prune web --docker --respect-gitignore
```

**When useful:** Prevents copying generated files, caches, or local env files into the Docker context. Reduces context size sent to Docker daemon.

---

## Pattern 5: Combining prune with Remote Cache in CI

```bash
#!/usr/bin/env bash
set -euo pipefail

# Step 1: Check if web app is affected
AFFECTED=$(turbo query affected --packages web \
  | jq '.data.affectedPackages.length')

if [ "$AFFECTED" -eq 0 ]; then
  echo "web not affected -- skipping Docker build"
  exit 0
fi

# Step 2: Prune and build Docker image
turbo prune web --docker
docker build -t web:latest -f apps/web/Dockerfile .
```

**Why good:** Skips the entire Docker build if the web package isn't affected. Combines `turbo query affected` (skip decision) with `turbo prune` (optimized build context).
