# Docker -- Compose Examples

> Docker Compose v2 patterns for development and production environments. Services, volumes, networking, healthchecks. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [dockerfile.md](dockerfile.md) - Multi-stage Dockerfiles, layer caching, .dockerignore
- [production.md](production.md) - Security hardening, secrets, CI/CD pipelines

---

## Example 1: Development Docker Compose

Full development environment with app, database, Redis, and admin UI.

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

**Why good:** Named project, explicit image tags, health checks on dependencies, `depends_on` with condition, bind mount with `:cached` for macOS perf, anonymous volume protects node_modules, named volume for database persistence, debugger port exposed

---

## Example 2: Custom Bridge Networks

Isolate services into separate networks for security.

```yaml
# compose.yaml - Custom bridge networks
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

### Network Driver Comparison

| Driver  | Use Case                                                                |
| ------- | ----------------------------------------------------------------------- |
| bridge  | Default. Containers on same host communicating by service name          |
| host    | Performance-critical apps needing raw host networking (no NAT overhead) |
| overlay | Multi-host communication (Docker Swarm)                                 |
| none    | Complete network isolation                                              |

---

## Example 3: Volume Mount Patterns

### Development: Bind Mounts

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

### Production: Named Volumes

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

### Mount Type Comparison

| Mount Type   | Use Case                | Persistence     | Performance                 |
| ------------ | ----------------------- | --------------- | --------------------------- |
| Bind mount   | Dev: source code sync   | Host filesystem | Varies (`:cached` on macOS) |
| Named volume | Prod: database, uploads | Docker-managed  | Native                      |
| tmpfs        | Temporary data, secrets | Memory only     | Fastest                     |

---

## Example 4: Environment-Specific Compose Files

```bash
# Development (auto-loads compose.override.yaml)
docker compose up

# Production
docker compose -f compose.yaml -f compose.prod.yaml up -d

# Testing
docker compose -f compose.yaml -f compose.test.yaml up --abort-on-container-exit
```

Use `compose.yaml` as the base, `compose.override.yaml` for development (auto-loaded), and `compose.prod.yaml` for production overrides (explicit). See [production.md](production.md) for production compose configuration.
