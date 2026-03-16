# Docker Examples

## Example 1: Production Dockerfile for Node.js/TypeScript API

Complete multi-stage Dockerfile for a TypeScript Express/Hono API server.

```dockerfile
# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Production dependencies only
# ============================================================
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.21

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

## Example 3: Development Docker Compose

Full development environment with app, database, Redis, and monitoring.

```yaml
# compose.yaml - Development environment
name: my-app-dev

services:
  # ---- Application ----
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    ports:
      - "3000:3000" # Application
      - "9229:9229" # Node.js debugger
    volumes:
      - .:/app:cached # Source code hot reload
      - /app/node_modules # Protect container node_modules
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://dev:dev@db:5432/devdb
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: debug
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: ["npm", "run", "dev"]
    restart: unless-stopped

  # ---- PostgreSQL ----
  db:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: devdb
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d devdb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ---- Redis ----
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: ["redis-server", "--appendonly", "yes"]

  # ---- Database admin UI ----
  adminer:
    image: adminer:4
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
```

---

## Example 4: Production Docker Compose

Hardened configuration for production deployment.

```yaml
# compose.prod.yaml - Production overrides
# Usage: docker compose -f compose.yaml -f compose.prod.yaml up -d

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      # Uses final stage (runner) by default
    image: ghcr.io/org/my-app:${APP_VERSION:-latest}
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    # Security hardening
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  db:
    image: postgres:17-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No ports exposed to host in production
    environment:
      POSTGRES_USER_FILE: /run/secrets/db_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_user
      - db_password
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

secrets:
  db_user:
    file: ./secrets/db_user.txt
  db_password:
    file: ./secrets/db_password.txt

volumes:
  pgdata:
    driver: local
```

---

## Example 5: GitHub Actions CI/CD Pipeline

Build, scan, and push Docker images with GitHub Actions.

```yaml
# .github/workflows/docker.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64,linux/arm64

      - name: Scan for vulnerabilities
        if: github.event_name != 'pull_request'
        uses: docker/scout-action@v1
        with:
          command: cves
          image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          sarif-file: sarif.output.json
          summary: true

      - name: Upload SARIF report
        if: github.event_name != 'pull_request'
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: sarif.output.json
```

---

## Example 6: .dockerignore for Node.js/TypeScript

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
.nyc_output
jest.config.*
vitest.config.*
playwright.config.*
playwright-report

# CI/CD configuration
.github
.gitlab-ci.yml
.circleci

# Turborepo
.turbo

# OS files
.DS_Store
Thumbs.db

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## Example 7: Monorepo Dockerfile (Turborepo)

Building a single service from a Turborepo monorepo.

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.21

# ============================================================
# Stage 1: Prune monorepo for target package
# ============================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @repo/api --docker

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
RUN npx turbo run build --filter=@repo/api

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

## Example 8: Graceful Shutdown Implementation

Complete TypeScript implementation for proper Docker shutdown handling.

```typescript
// src/server.ts
import { createServer } from "node:http";
import { app } from "./app.js";

const DEFAULT_PORT = 3_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const HEALTH_CHECK_PATH = "/health";

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

---

## Example 9: Docker Scout in CI

Vulnerability scanning integrated into pull request workflow.

```yaml
# .github/workflows/scout.yml
name: Docker Scout Analysis

on:
  pull_request:
    branches: [main]

jobs:
  scout:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build image for scanning
        uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: local/app:pr-${{ github.event.pull_request.number }}

      - name: Docker Scout CVE scan
        uses: docker/scout-action@v1
        with:
          command: cves
          image: local/app:pr-${{ github.event.pull_request.number }}
          only-severities: critical,high
          exit-code: true # Fail PR if critical/high CVEs found

      - name: Docker Scout compare
        uses: docker/scout-action@v1
        with:
          command: compare
          image: local/app:pr-${{ github.event.pull_request.number }}
          to-env: production
          summary: true
```
