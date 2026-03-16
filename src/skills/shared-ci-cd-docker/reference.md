# Docker Quick Reference

## Dockerfile Instructions

| Instruction    | Purpose                     | Example                                           |
| -------------- | --------------------------- | ------------------------------------------------- |
| `FROM`         | Base image                  | `FROM node:22-alpine AS builder`                  |
| `WORKDIR`      | Set working directory       | `WORKDIR /app`                                    |
| `COPY`         | Copy files from context     | `COPY package.json package-lock.json ./`          |
| `COPY --from`  | Copy from another stage     | `COPY --from=builder /app/dist ./dist`            |
| `COPY --chown` | Copy with ownership         | `COPY --chown=appuser:appgroup . .`               |
| `RUN`          | Execute command             | `RUN npm ci --omit=dev`                           |
| `RUN --mount`  | Execute with mount          | `RUN --mount=type=cache,target=/root/.npm npm ci` |
| `ENV`          | Set environment variable    | `ENV NODE_ENV=production`                         |
| `ARG`          | Build-time variable         | `ARG NODE_VERSION=22`                             |
| `EXPOSE`       | Document port               | `EXPOSE 3000`                                     |
| `USER`         | Set runtime user            | `USER appuser`                                    |
| `CMD`          | Default command (exec form) | `CMD ["node", "dist/server.js"]`                  |
| `ENTRYPOINT`   | Fixed command prefix        | `ENTRYPOINT ["/sbin/tini", "--"]`                 |
| `HEALTHCHECK`  | Health check config         | See below                                         |
| `LABEL`        | Image metadata              | `LABEL org.opencontainers.image.source=...`       |

## Health Check Syntax

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
```

| Parameter        | Default | Recommended | Purpose                        |
| ---------------- | ------- | ----------- | ------------------------------ |
| `--interval`     | 30s     | 30s         | Time between checks            |
| `--timeout`      | 30s     | 10s         | Max time for check to complete |
| `--retries`      | 3       | 3           | Failures before unhealthy      |
| `--start-period` | 0s      | 30s         | Grace period for app startup   |

## BuildKit Mount Types

| Mount  | Syntax                                             | Purpose                          |
| ------ | -------------------------------------------------- | -------------------------------- |
| Cache  | `--mount=type=cache,target=/root/.npm`             | Persistent package manager cache |
| Secret | `--mount=type=secret,id=token,env=TOKEN`           | Build-time secrets (ephemeral)   |
| SSH    | `--mount=type=ssh`                                 | SSH agent forwarding             |
| Bind   | `--mount=type=bind,source=./config,target=/config` | Bind file/dir into build         |
| tmpfs  | `--mount=type=tmpfs,target=/tmp`                   | In-memory temp storage           |

## Docker Compose v2 Reference

### Service Configuration

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder # Multi-stage target
      args:
        NODE_VERSION: "22"
    image: my-app:latest
    container_name: my-app
    ports:
      - "3000:3000" # host:container
      - "9229:9229" # Debugger
    volumes:
      - .:/app:cached # Bind mount
      - /app/node_modules # Anonymous volume
      - pgdata:/var/lib/data # Named volume
    environment:
      NODE_ENV: development
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    networks:
      - backend
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          memory: 256M
    # Security hardening
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

### Common Docker CLI Commands

```bash
# Build
docker build -t my-app:latest .
docker build --target builder -t my-app:dev .
docker buildx build --platform linux/amd64,linux/arm64 -t my-app:latest .

# Run
docker run -d -p 3000:3000 --name my-app my-app:latest
docker run --init -d my-app:latest          # Use tini init

# Compose
docker compose up -d                         # Start all services
docker compose up -d --build                 # Rebuild and start
docker compose down                          # Stop (preserve volumes)
docker compose down -v                       # Stop and remove volumes
docker compose logs -f app                   # Follow logs
docker compose exec app sh                   # Shell into container
docker compose ps                            # List services

# Images
docker images                                # List images
docker image prune -a                        # Remove unused images
docker scout cves my-app:latest              # Scan for vulnerabilities

# Debug
docker logs my-app --tail 100 -f             # Follow logs
docker exec -it my-app sh                    # Shell into running container
docker inspect my-app                        # Container details
docker stats                                 # Resource usage
```

## Base Image Comparison

| Image                 | Size   | C Library | Vulnerabilities | Best For                       |
| --------------------- | ------ | --------- | --------------- | ------------------------------ |
| `node:22`             | ~1GB   | glibc     | High            | Development, debugging         |
| `node:22-slim`        | ~200MB | glibc     | Medium          | Production (max compatibility) |
| `node:22-alpine`      | ~135MB | musl      | Low             | Production (small + secure)    |
| `distroless/nodejs22` | ~120MB | glibc     | Very Low        | Production (max security)      |

## Docker Scout Commands

```bash
docker scout cves my-app:latest              # List CVEs
docker scout quickview my-app:latest         # Summary view
docker scout recommendations my-app:latest   # Fix suggestions
docker scout compare --to my-app:v1 my-app:v2  # Compare versions
```

## Docker Init

```bash
docker init                                  # Interactive scaffolding
# Generates: Dockerfile, .dockerignore, compose.yaml, README.Docker.md
# Prompts for: Node version, package manager, build command, port
```

## Environment-Specific Compose Files

```bash
# Development (auto-loads compose.override.yaml)
docker compose up

# Production
docker compose -f compose.yaml -f compose.prod.yaml up -d

# Testing
docker compose -f compose.yaml -f compose.test.yaml up --abort-on-container-exit
```

## Named Constants Reference

```typescript
// Docker-related constants for application code
const HEALTH_CHECK_PATH = "/health";
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const DEFAULT_PORT = 3_000;
```
