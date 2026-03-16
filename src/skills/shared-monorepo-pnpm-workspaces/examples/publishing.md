# pnpm Workspaces -- Publishing & Versioning Examples

> Changesets, publishConfig, versioning, and Docker deployment examples. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Workspace initialization, pnpm-workspace.yaml, settings
- [packages.md](packages.md) -- Shared packages, TypeScript config, workspace protocol
- [scripts.md](scripts.md) -- Running scripts, filtering, dependency management
- [ci.md](ci.md) -- CI/CD pipelines, GitHub Actions, Docker

---

## publishConfig

```json
{
  "name": "@repo/ui",
  "version": "1.0.0",
  "private": false,
  "main": "./src/index.ts",
  "publishConfig": {
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "access": "public"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  }
}
```

**Why good:** `main` points to source during development (fast HMR), `publishConfig.main` points to built output on publish, `access: public` required for scoped packages on npm

---

## Changesets Setup

```bash
# Install changesets in workspace root
pnpm add -Dw @changesets/cli

# Initialize changesets
pnpm changeset init
```

### Configuration

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@repo/ui", "@repo/types"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@repo/web-app", "@repo/api-server"]
}
```

**Key options:**

- `linked`: Packages that should always share the same version
- `access`: `"public"` for scoped packages on npm
- `ignore`: Private packages that should not be versioned/published
- `updateInternalDependencies`: How to bump internal dep references

### Development Workflow

```bash
# 1. Make code changes across packages

# 2. Create a changeset describing the change
pnpm changeset
# Interactive prompt: select packages, bump type, description

# 3. Commit the changeset file
# .changeset/cool-dogs-dance.md gets committed with your PR

# 4. When ready to release (usually automated):
pnpm changeset version   # Bumps versions, generates changelogs
pnpm install              # Update lockfile
pnpm publish -r           # Publish to npm
```

### Root package.json Scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version && pnpm install",
    "release": "pnpm build && pnpm publish -r --access=public"
  }
}
```

---

## Docker with pnpm Workspaces

### Multi-Stage Dockerfile

```dockerfile
# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN corepack enable pnpm

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @repo/api build

# Stage 3: Production
FROM node:22-alpine AS runner
RUN corepack enable pnpm

WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

### Using pnpm deploy (Recommended)

```yaml
# pnpm-workspace.yaml
injectWorkspacePackages: true # Required for pnpm deploy
```

```dockerfile
FROM node:22-alpine AS builder
RUN corepack enable pnpm

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/api build
RUN pnpm --filter @repo/api deploy ./pruned

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/pruned .
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Why good:** `pnpm deploy` creates a standalone directory with only the production dependencies for a specific package, dramatically smaller Docker images, `injectWorkspacePackages: true` required for deploy to resolve workspace deps correctly. Use `pnpm deploy --legacy` if you cannot enable `injectWorkspacePackages` globally.

---

## Migration from npm/yarn

### Step-by-Step

```bash
# 1. Remove old lockfile and node_modules
rm -rf node_modules package-lock.json yarn.lock

# 2. Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# 3. Set packageManager in root package.json
# "packageManager": "pnpm@10.32.1"

# 4. Install with pnpm
pnpm install

# 5. Convert internal dependencies to workspace:*
# In each package.json, change "@repo/ui": "^1.0.0" to "@repo/ui": "workspace:*"

# 6. Re-install to generate proper lockfile
pnpm install
```

**Key differences from npm/yarn:**

- pnpm creates strict `node_modules` (no phantom dependencies)
- You may need to add missing dependency declarations that npm/yarn silently resolved
- `shamefullyHoist: true` can ease migration but should be removed once deps are fixed
