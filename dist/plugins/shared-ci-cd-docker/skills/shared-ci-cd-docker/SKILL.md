---
name: shared-ci-cd-docker
description: Docker containerization patterns for Node.js/TypeScript development and production
---

# Docker Containerization Patterns

> **Quick Guide:** Docker Engine 29 with BuildKit for containerizing Node.js/TypeScript applications. Multi-stage builds for minimal production images (1GB to under 100MB). Docker Compose v2 for development environments. BuildKit cache mounts for 10x faster dependency installs. Non-root users, health checks, and secret mounts for production security. Alpine for size, Debian slim for compatibility.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use multi-stage builds for production images - NEVER ship dev dependencies, TypeScript compiler, or source files in production)**

**(You MUST run containers as non-root user - NEVER run production containers as root (default))**

**(You MUST use `CMD ["node", "server.js"]` (exec form) - NEVER use `npm start` or shell form as CMD)**

**(You MUST use BuildKit secret mounts for sensitive data at build time - NEVER use ARG or ENV for secrets)**

**(You MUST copy package.json/lockfile BEFORE source code - NEVER `COPY . .` before `npm ci` (breaks layer cache))**

</critical_requirements>

---

**Detailed Resources:**

- For code examples, see [examples/](examples/) directory:
  - [docker.md](examples/docker.md) - Dockerfiles, multi-stage builds, compose configs, CI/CD pipelines
- For decision frameworks and quick reference, see [reference.md](reference.md)

---

**Auto-detection:** Dockerfile, docker-compose, compose.yaml, Docker, container, multi-stage build, BuildKit, .dockerignore, Docker Compose, docker build, docker run, HEALTHCHECK, Docker Scout, docker init, containerize, container image, Docker network, Docker volume

**When to use:**

- Creating Dockerfiles for Node.js/TypeScript applications
- Setting up multi-stage builds to minimize production image size
- Configuring Docker Compose for local development environments
- Optimizing Docker layer caching and BuildKit cache mounts
- Implementing container security (non-root, secrets, read-only filesystem)
- Setting up health checks for container orchestration
- Configuring Docker networking and volume mounts
- Building CI/CD pipelines that build and push Docker images
- Scanning images for vulnerabilities with Docker Scout

**When NOT to use:**

- Serverless deployments (AWS Lambda, Vercel Functions) that don't use containers
- Static site hosting (Netlify, Vercel, Cloudflare Pages) with no server runtime
- Local development without containerization requirements
- Kubernetes-specific orchestration patterns (use a Kubernetes skill)

**Key patterns covered:**

- Multi-stage Dockerfile for Node.js/TypeScript (builder pattern)
- Docker Compose v2 development environments
- BuildKit cache mounts and layer optimization
- Container security (non-root, secrets, capabilities, read-only)
- Health checks for production containers
- `.dockerignore` for build context optimization
- Volume mounts (named volumes, bind mounts, tmpfs)
- Docker networking (bridge, host, overlay)
- CI/CD integration (GitHub Actions build-push)
- Image selection (Alpine vs Debian slim)
- Docker Scout vulnerability scanning
- Docker init scaffolding
- Signal handling (tini/dumb-init for graceful shutdown)

---

<philosophy>

## Philosophy

Containers provide reproducible, isolated environments that eliminate "works on my machine" problems. Docker is the standard for packaging Node.js/TypeScript applications into portable, lightweight images that run consistently across development, CI, and production.

**Core principles:**

1. **Minimal production images** - Ship only what the app needs to run (compiled JS, production deps, runtime)
2. **Layer cache optimization** - Structure Dockerfiles so unchanged layers are reused, making rebuilds fast
3. **Security by default** - Non-root users, no secrets in images, minimal attack surface
4. **Development parity** - Docker Compose mirrors production topology locally

**When to use Docker:**

- Applications deploying to container orchestrators (Kubernetes, ECS, Cloud Run)
- Teams needing consistent development environments across OS platforms
- Microservice architectures requiring isolated services with dependencies (databases, caches)
- CI/CD pipelines building reproducible artifacts

**When NOT to use Docker:**

- Pure serverless (Lambda/Vercel Functions) where the platform manages containers
- Static sites deployed to CDNs
- Simple scripts or CLI tools distributed via npm
- When added complexity outweighs the isolation benefit

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Multi-Stage Dockerfile for Node.js/TypeScript

Multi-stage builds compile TypeScript in a builder stage, then copy only compiled JS and production dependencies into a minimal runtime image. This reduces images from 1GB+ to under 100MB.

#### Stage Architecture

A production Dockerfile uses three stages:

1. **deps** - Install production dependencies only
2. **builder** - Install all dependencies, compile TypeScript
3. **runner** - Copy compiled output and production deps into minimal image

#### Constants

```dockerfile
# Dockerfile constants (pinned versions)
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.21
```

```dockerfile
# ---- Good Example ----
# Stage 1: Dependencies
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# Stage 2: Builder
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 3: Runner (production)
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Copy only production artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "dist/server.js"]
```

**Why good:** Three-stage build separates concerns, BuildKit cache mount speeds up npm ci, non-root user for security, health check for orchestration, exec form CMD for signal handling, only production artifacts in final image

```dockerfile
# ---- Bad Example ----
FROM node:22
WORKDIR /app
COPY . .
RUN npm install
ENV DATABASE_URL=postgres://user:pass@db:5432/mydb
EXPOSE 3000
CMD npm start
```

**Why bad:** Single stage ships 1GB+ image with dev deps and source code, `COPY . .` before install breaks layer cache, `npm install` instead of `npm ci` is non-deterministic, secret in ENV persists in image layers, `npm start` swallows SIGTERM signals, runs as root

---

### Pattern 2: Docker Compose for Development

Docker Compose v2 defines multi-container development environments. Use `compose.yaml` (not `docker-compose.yml`) with the `docker compose` command (no hyphen).

#### Development Compose Configuration

```yaml
# compose.yaml - Good Example
name: my-app-dev

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    ports:
      - "3000:3000"
      - "9229:9229" # Node.js debugger
    volumes:
      - .:/app:cached # Bind mount for hot reload
      - /app/node_modules # Anonymous volume prevents overwrite
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://dev:dev@db:5432/devdb
    depends_on:
      db:
        condition: service_healthy
    command: ["npm", "run", "dev"]

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**Why good:** Named project, explicit image tags, health checks on dependencies, `depends_on` with condition, bind mount with `:cached` for macOS perf, anonymous volume protects node_modules, named volume for database persistence, debugger port exposed

```yaml
# compose.yaml - Bad Example
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    depends_on:
      - db
  db:
    image: postgres
    environment:
      POSTGRES_PASSWORD: password
```

**Why bad:** No health check on db (app starts before db is ready), no explicit image tag (`:latest` is unpredictable), no named volume (data lost on `docker compose down`), `depends_on` without condition only waits for container start not readiness, no named project

---

### Pattern 3: BuildKit Cache Mounts and Layer Optimization

BuildKit (default since Docker Engine 23+) provides cache mounts that persist package manager caches across builds, reducing install times by 10x or more.

#### Layer Ordering Rules

1. Pin base image versions (change rarely)
2. Copy dependency manifests (package.json, lockfile)
3. Install dependencies (cached when manifests unchanged)
4. Copy source code (changes frequently)
5. Build/compile (runs only when source changes)

#### Cache Mount Syntax

```dockerfile
# ---- Good Example: BuildKit Cache Mounts ----

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

**Why good:** Cache mounts persist across builds so only new/changed packages download, `--no-audit --no-fund` skip unnecessary checks, `--frozen-lockfile` ensures deterministic installs

```dockerfile
# ---- Bad Example ----
COPY . .
RUN npm install
```

**Why bad:** `COPY . .` invalidates cache on ANY file change (even README edits), `npm install` instead of `npm ci` is non-deterministic and slower, no cache mount means full download every build

---

### Pattern 4: Container Security

Security hardening for production containers reduces attack surface and limits blast radius of vulnerabilities.

#### Non-Root User

```dockerfile
# ---- Good Example: Non-Root User ----

# Create system user with specific UID/GID
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Set ownership of app files
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist

# Switch to non-root before CMD
USER appuser
```

**Why good:** Explicit UID/GID for Kubernetes pod security policies, `--chown` on COPY avoids separate `chown` layer, `USER` before CMD ensures process runs unprivileged

#### Secret Mounts (Build Time)

```dockerfile
# ---- Good Example: Build-Time Secrets ----

# Pass secret at build time (never persisted in image)
RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN \
    npm ci --no-audit --no-fund

# Build command:
# docker build --secret id=npm_token,env=NPM_TOKEN .
```

**Why good:** Secret mount is ephemeral (exists only during RUN instruction), never written to image layers, BuildKit guarantees secrets are not persisted

```dockerfile
# ---- Bad Example: Secrets in Image ----
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
RUN npm ci
```

**Why bad:** ARG values persist in image history (`docker history`), ENV persists in image metadata (`docker inspect`), .npmrc with token gets baked into layer

#### Runtime Security Hardening

```yaml
# compose.yaml - Production security settings
services:
  app:
    image: my-app:latest
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

**Why good:** Read-only filesystem prevents writes, tmpfs for temp files, no-new-privileges prevents privilege escalation, drop all capabilities then add only what's needed

---

### Pattern 5: Health Checks

Health checks enable orchestrators (Docker Compose, Kubernetes, ECS) to detect unresponsive containers and restart them automatically.

#### Application Health Endpoint

```typescript
// src/health.ts - Health check endpoint
const HEALTH_CHECK_PATH = "/health";
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export function registerHealthCheck(app: Application): void {
  app.get(HEALTH_CHECK_PATH, async (_req, res) => {
    try {
      // Verify critical dependencies
      await Promise.race([
        checkDatabase(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Health check timeout")),
            HEALTH_CHECK_TIMEOUT_MS,
          ),
        ),
      ]);
      res.status(200).json({ status: "healthy" });
    } catch {
      res.status(503).json({ status: "unhealthy" });
    }
  });
}
```

#### Dockerfile Health Check

```dockerfile
# ---- Good Example: Health Check ----
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
```

**Why good:** Uses Node.js built-in fetch (no curl/wget needed in Alpine), start-period allows app startup time, retries prevent flapping, checks actual app health not just process existence

```dockerfile
# ---- Bad Example ----
HEALTHCHECK CMD curl -f http://localhost:3000/ || exit 1
```

**Why bad:** curl may not exist in Alpine images, checks root path not dedicated health endpoint, no timeout/interval/retries/start-period configuration, does not verify dependencies (db, cache)

---

### Pattern 6: .dockerignore

The `.dockerignore` file excludes files from the build context, preventing cache invalidation from irrelevant changes and keeping secrets out of images.

```text
# .dockerignore - Good Example

# Dependencies (reinstalled in container)
node_modules

# Build output (rebuilt in container)
dist
build
.next

# Version control
.git
.gitignore

# IDE and editor
.vscode
.idea
*.swp
*.swo

# Environment and secrets
.env
.env.*
!.env.example

# Docker files (prevent recursive context)
Dockerfile*
compose.yaml
docker-compose*.yml
.dockerignore

# Documentation
README.md
LICENSE
CHANGELOG.md
docs/

# Tests
__tests__
*.test.ts
*.spec.ts
coverage
.nyc_output
jest.config.*
vitest.config.*

# CI/CD
.github
.gitlab-ci.yml

# OS files
.DS_Store
Thumbs.db
```

**Why good:** Excludes node_modules (reinstalled deterministically), excludes .env files (prevents secret leaks), excludes .git (large directory that invalidates cache), keeps build context small and focused

---

### Pattern 7: Signal Handling and Graceful Shutdown

Node.js running as PID 1 in a container does not handle signals (SIGTERM, SIGINT) correctly by default. Use tini or `--init` flag for proper signal forwarding.

#### Using Tini (Recommended for Production)

```dockerfile
# ---- Good Example: Tini Init System ----
FROM node:22-alpine AS runner
# tini is included in node:alpine images
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

**Why good:** Tini runs as PID 1 and forwards signals to node process, handles zombie process reaping, ensures graceful shutdown on SIGTERM

#### Application-Level Graceful Shutdown

```typescript
// src/shutdown.ts - Graceful shutdown handler
const SHUTDOWN_TIMEOUT_MS = 10_000;

export function registerGracefulShutdown(server: Server): void {
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
```

**Why good:** Handles both SIGTERM (Docker stop) and SIGINT (Ctrl+C), closes server gracefully allowing in-flight requests to complete, timeout prevents hanging forever

```dockerfile
# ---- Bad Example ----
CMD npm start
```

**Why bad:** npm swallows SIGTERM/SIGINT signals (npm is not a process manager), shell form wraps command in `/bin/sh -c` adding another layer, node process never receives shutdown signal

---

### Pattern 8: Docker Networking

Docker provides multiple network drivers for different use cases. Compose creates a default bridge network per project.

#### Bridge Network (Default for Compose)

```yaml
# compose.yaml - Custom bridge network
services:
  app:
    build: .
    networks:
      - backend
    ports:
      - "3000:3000"

  api:
    build: ./api
    networks:
      - backend
      - frontend

  db:
    image: postgres:17-alpine
    networks:
      - backend
    # No ports exposed to host - only accessible from backend network

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
```

**Why good:** Services on same network communicate by service name (DNS resolution), db not exposed to host (only reachable from backend network), separate networks isolate frontend from database

**When to use which network driver:**

| Driver  | Use Case                                                                |
| ------- | ----------------------------------------------------------------------- |
| bridge  | Default. Containers on same host communicating by service name          |
| host    | Performance-critical apps needing raw host networking (no NAT overhead) |
| overlay | Multi-host communication (Docker Swarm)                                 |
| none    | Complete network isolation                                              |

---

### Pattern 9: Volume Mounts

Docker provides three mount types for different data persistence needs.

#### Development: Bind Mounts

```yaml
# compose.yaml - Development with bind mounts
services:
  app:
    volumes:
      - .:/app:cached # Source code for hot reload
      - /app/node_modules # Protect container's node_modules
      - ./config:/app/config:ro # Read-only config
```

**Why good:** `:cached` improves macOS file system performance, anonymous volume prevents host node_modules from overwriting container's, `:ro` for config prevents accidental writes

#### Production: Named Volumes

```yaml
# compose.yaml - Production with named volumes
services:
  db:
    image: postgres:17-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: my-app:latest
    tmpfs:
      - /tmp # In-memory temp storage

volumes:
  pgdata:
    driver: local
```

**Why good:** Named volume persists across `docker compose down`/`up`, Docker manages the volume lifecycle, tmpfs for temporary files (security + performance)

| Mount Type   | Use Case                | Persistence     | Performance                 |
| ------------ | ----------------------- | --------------- | --------------------------- |
| Bind mount   | Dev: source code sync   | Host filesystem | Varies (`:cached` on macOS) |
| Named volume | Prod: database, uploads | Docker-managed  | Native                      |
| tmpfs        | Temporary data, secrets | Memory only     | Fastest                     |

</patterns>

---

<performance>

## Performance Optimization

### Image Size Reduction

| Technique                 | Impact                                   |
| ------------------------- | ---------------------------------------- |
| Multi-stage builds        | 1GB to under 100MB (90%+ reduction)      |
| Alpine base image         | 135MB vs 1GB (full) vs 200MB (slim)      |
| `npm ci --omit=dev`       | Removes dev dependencies from production |
| `.dockerignore`           | Smaller build context, faster sends      |
| `npm cache clean --force` | Removes npm cache from final layer       |

### Build Speed Optimization

| Technique                              | Impact                                          |
| -------------------------------------- | ----------------------------------------------- |
| BuildKit cache mounts                  | 10x faster dependency installs                  |
| Layer ordering (deps before source)    | Cache hit on source-only changes                |
| `.dockerignore` excluding node_modules | Prevents sending GBs to daemon                  |
| `--no-audit --no-fund` flags           | Skip unnecessary npm checks                     |
| Parallel multi-stage builds            | BuildKit builds independent stages concurrently |

### CI/CD Build Cache

```yaml
# GitHub Actions - Cache Docker layers
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Why good:** GitHub Actions cache (`type=gha`) persists layers across CI runs, `mode=max` caches all layers (not just final), Buildx enables BuildKit features automatically

</performance>

---

<decision_framework>

## Decision Framework

### Base Image Selection

```
Which base image?
  |
  +-- Need smallest image? --> Alpine (node:22-alpine, ~135MB)
  |     +-- Native npm packages with C bindings? --> May need build tools
  |     +-- musl libc compatibility issues? --> Use Debian slim instead
  |
  +-- Need maximum compatibility? --> Debian slim (node:22-slim, ~200MB)
  |     +-- Native extensions work out of the box
  |     +-- Larger but fewer surprises
  |
  +-- Need debugging tools? --> Full image (node:22, ~1GB)
  |     +-- Development only, never for production
  |
  +-- Maximum security? --> Distroless (gcr.io/distroless/nodejs22)
        +-- No shell, no package manager, no utilities
        +-- Hardest to debug, smallest attack surface
```

### Compose vs Dockerfile Targets

```
How to manage dev vs prod?
  |
  +-- Multi-stage Dockerfile with targets
  |     +-- `docker compose build --target builder` for dev
  |     +-- Final stage for production
  |
  +-- Separate compose files
  |     +-- compose.yaml (base)
  |     +-- compose.override.yaml (dev - auto-loaded)
  |     +-- compose.prod.yaml (production)
  |     +-- `docker compose -f compose.yaml -f compose.prod.yaml up`
```

### Volume Strategy

```
What data needs to persist?
  |
  +-- Source code (dev hot reload) --> Bind mount with :cached
  +-- Database files --> Named volume
  +-- Temporary/cache data --> tmpfs
  +-- Secrets at runtime --> Docker secrets or tmpfs
  +-- node_modules in dev --> Anonymous volume (protect from host)
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **GitHub Actions**: `docker/build-push-action@v6` for CI/CD builds, `docker/setup-buildx-action@v3` for BuildKit
- **GitHub Container Registry (ghcr.io)**: Free private image hosting for GitHub repos
- **Kubernetes**: Production orchestration, pod security contexts, liveness/readiness probes
- **Docker Scout**: `docker scout cves` for vulnerability scanning in CLI and CI
- **Node.js**: Official `node:22-alpine` images, signal handling with tini
- **PostgreSQL/Redis**: Official Alpine images with health checks in Compose

**Replaces / Conflicts with:**

- **Vagrant**: Docker Compose replaces VM-based development environments
- **Manual server provisioning**: Dockerfiles codify environment setup
- **nvm/fnm for Node versions**: Dockerfile pins exact Node version

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Running production containers as root (default behavior - always add USER directive)
- Secrets in ARG/ENV/COPY (persist in image layers - use `--mount=type=secret`)
- Single-stage builds shipping dev dependencies and source code to production
- Using `npm start` as CMD (npm swallows SIGTERM - use `CMD ["node", "dist/server.js"]`)
- No `.dockerignore` file (node_modules sent to daemon, secrets leaked into image)
- Using `:latest` tag for base images (non-deterministic builds)

**Medium Priority Issues:**

- `COPY . .` before `npm ci` (any file change invalidates dependency cache)
- No health check defined (orchestrator cannot detect unresponsive containers)
- `docker-compose.yml` with `version:` key (deprecated - use `compose.yaml` without version)
- `depends_on` without `condition: service_healthy` (container starts before dependency is ready)
- Using `npm install` instead of `npm ci` in Dockerfile (non-deterministic, slower)

**Common Mistakes:**

- Forgetting anonymous volume for node_modules in dev (`/app/node_modules`) causing host to overwrite container's modules
- Not using `:cached` on bind mounts on macOS (significant performance impact)
- Installing build tools (gcc, make, python) in the final stage instead of the builder stage
- Exposing database ports to host in production Compose (only needed for dev)
- Using shell form `CMD npm start` instead of exec form `CMD ["node", "server.js"]`

**Gotchas and Edge Cases:**

- Alpine uses musl libc - some npm packages with native C bindings (bcrypt, sharp, canvas) may fail or need rebuild; use `npm rebuild` or switch to Debian slim
- Node.js `fetch()` is available since Node 18+ (no need for curl in health checks on Alpine)
- BuildKit cache mounts require `# syntax=docker/dockerfile:1` or Docker Engine 23+ with BuildKit enabled by default
- `docker compose down -v` removes named volumes (data loss) - use `docker compose down` without `-v` to preserve data
- Docker Desktop on macOS/Windows has different file system performance characteristics than Linux - bind mounts are slower
- `COPY --chown` is more efficient than `COPY` + `RUN chown` (one layer vs two)
- The `node_modules/.cache` directory can grow large in development - consider adding it to `.dockerignore`
- `tini` is included in `node:alpine` images but must be installed separately on Debian-based images

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use multi-stage builds for production images - NEVER ship dev dependencies, TypeScript compiler, or source files in production)**

**(You MUST run containers as non-root user - NEVER run production containers as root (default))**

**(You MUST use `CMD ["node", "server.js"]` (exec form) - NEVER use `npm start` or shell form as CMD)**

**(You MUST use BuildKit secret mounts for sensitive data at build time - NEVER use ARG or ENV for secrets)**

**(You MUST copy package.json/lockfile BEFORE source code - NEVER `COPY . .` before `npm ci` (breaks layer cache))**

**Failure to follow these rules will result in bloated images (1GB+), security vulnerabilities (root access, leaked secrets), broken graceful shutdown (lost requests on deploy), and slow CI builds (no layer caching).**

</critical_reminders>
