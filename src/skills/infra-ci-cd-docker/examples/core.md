# Docker -- Dockerfile Examples

> Dockerfile patterns for Node.js/TypeScript applications. Multi-stage builds, layer caching, .dockerignore, signal handling. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [compose.md](compose.md) - Docker Compose for development and production
- [production.md](production.md) - Security hardening, secrets, CI/CD pipelines

---

## Example 1: Production Dockerfile for Node.js/TypeScript API

Complete multi-stage Dockerfile for a TypeScript API server.

```dockerfile
# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Production dependencies only
# ============================================================
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.22

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app

# Install production dependencies with cache mount
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# ============================================================
# Stage 2: Build TypeScript
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
WORKDIR /app

# Install ALL dependencies (including devDependencies for tsc)
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy production artifacts
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

# Switch to non-root user
USER appuser

EXPOSE 3000

# Health check using Node.js built-in fetch (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

# Use tini as init system, node as direct process (not npm)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

**Why good:** Three-stage build separates concerns, BuildKit cache mount speeds up npm ci, tini handles signal forwarding, non-root user for security, health check for orchestration, exec form CMD, only production artifacts in final image

---

## Example 2: Multi-Stage Build with Bun

For projects using Bun as the runtime/package manager.

```dockerfile
# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.2

# ============================================================
# Stage 1: Install production dependencies
# ============================================================
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# ============================================================
# Stage 2: Build TypeScript
# ============================================================
FROM oven/bun:${BUN_VERSION}-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM oven/bun:${BUN_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["bun", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["bun", "run", "dist/server.js"]
```

---

## Example 3: Monorepo Dockerfile

Building a single service from a monorepo using prune-based Docker builds. This example uses Turborepo's `turbo prune --docker` but the multi-stage pattern applies to any monorepo tool with Docker-aware pruning.

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.22

# ============================================================
# Stage 1: Prune monorepo for target package
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @myorg/api --docker

# ============================================================
# Stage 2: Install dependencies
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app

# Install pruned dependencies
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ============================================================
# Stage 3: Build
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@myorg/api

# ============================================================
# Stage 4: Production runtime
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app

RUN apk add --no-cache tini
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy only the built API and its production dependencies
COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup apps/api/package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

---

## Example 4: BuildKit Cache Mounts

Cache mounts persist package manager caches across builds, reducing install times by 10x or more.

```dockerfile
# npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Bun cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# pnpm cache mount
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# apt cache mount (for native dependencies)
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3
```

**Why good:** Cache mounts persist across builds so only new/changed packages download, `--no-audit --no-fund` skip unnecessary npm checks, `--frozen-lockfile` ensures deterministic installs

### Layer Ordering Rules

1. Pin base image versions (change rarely)
2. Copy dependency manifests (package.json, lockfile)
3. Install dependencies (cached when manifests unchanged)
4. Copy source code (changes frequently)
5. Build/compile (runs only when source changes)

---

## Example 5: .dockerignore for Node.js/TypeScript

```text
# Dependencies (reinstalled deterministically in container)
node_modules
.pnp
.pnp.js

# Build output (rebuilt in container)
dist
build
.next
out

# Version control
.git
.gitignore
.gitattributes

# IDE and editor files
.vscode
.idea
*.swp
*.swo
*~

# Environment files (secrets)
.env
.env.*
!.env.example

# Docker files (prevent recursive context)
Dockerfile*
compose.yaml
compose.*.yaml
docker-compose*.yml
.dockerignore

# Documentation
README.md
LICENSE
CHANGELOG.md
docs/
*.md
!package.json

# Tests
__tests__
*.test.ts
*.test.js
*.spec.ts
*.spec.js
coverage

# CI/CD configuration
.github
.gitlab-ci.yml
.circleci

# Monorepo cache
.turbo

# OS files
.DS_Store
Thumbs.db

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

**Why good:** Excludes node_modules (reinstalled deterministically), excludes .env files (prevents secret leaks), excludes .git (large directory that invalidates cache), keeps build context small and focused

---

## Example 6: Signal Handling and Graceful Shutdown

Node.js running as PID 1 in a container does not handle signals (SIGTERM, SIGINT) correctly by default. Use tini for proper signal forwarding.

### Tini in Dockerfile

```dockerfile
FROM node:22-alpine AS runner
# tini must be installed on Alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

**Why good:** Tini runs as PID 1 and forwards signals to node process, handles zombie process reaping, ensures graceful shutdown on SIGTERM

### Application-Level Graceful Shutdown

```typescript
// src/server.ts
import { createServer } from "node:http";
import { app } from "./app.js";

const DEFAULT_PORT = 3_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const port = Number(process.env.PORT) || DEFAULT_PORT;
const server = createServer(app);

// Track active connections for graceful shutdown
const activeConnections = new Set<import("node:net").Socket>();

server.on("connection", (socket) => {
  activeConnections.add(socket);
  socket.on("close", () => activeConnections.delete(socket));
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log("All connections closed. Exiting.");
    process.exit(0);
  });

  // Close idle keep-alive connections
  for (const socket of activeConnections) {
    socket.end();
  }

  // Force shutdown after timeout
  setTimeout(() => {
    console.error(`Forced shutdown after ${SHUTDOWN_TIMEOUT_MS}ms timeout`);
    for (const socket of activeConnections) {
      socket.destroy();
    }
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

// Register signal handlers
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { server };
```

**Why good:** Handles both SIGTERM (Docker stop) and SIGINT (Ctrl+C), closes server gracefully allowing in-flight requests to complete, tracks active connections, timeout prevents hanging forever
