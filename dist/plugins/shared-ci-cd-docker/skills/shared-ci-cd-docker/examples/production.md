# Docker -- Production & CI/CD Examples

> Production hardening, secrets management, security settings, CI/CD pipelines, vulnerability scanning. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Multi-stage Dockerfiles, layer caching, .dockerignore
- [compose.md](compose.md) - Docker Compose for development, networking, volumes

---

## Example 1: Production Docker Compose

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

**Why good:** Read-only filesystem, no-new-privileges, drop all capabilities, resource limits, Docker secrets for credentials, no database ports exposed, structured logging with rotation, restart policy with backoff

---

## Example 2: Non-Root User Setup

```dockerfile
# Create system user with specific UID/GID
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

# Set ownership of app files during COPY (one layer, not two)
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist

# Switch to non-root before CMD
USER appuser
```

**Why good:** Explicit UID/GID for Kubernetes pod security policies, `--chown` on COPY avoids separate `chown` layer, `USER` before CMD ensures process runs unprivileged

---

## Example 3: Build-Time Secret Mounts

```dockerfile
# Pass secret at build time (never persisted in image)
RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN \
    npm ci --no-audit --no-fund

# Build command:
# docker build --secret id=npm_token,env=NPM_TOKEN .
```

**Why good:** Secret mount is ephemeral (exists only during RUN instruction), never written to image layers, BuildKit guarantees secrets are not persisted

### Anti-Pattern: Secrets in Image

```dockerfile
# BAD: Secrets persist in image layers
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
RUN npm ci
```

**Why bad:** ARG values persist in image history (`docker history`), ENV persists in image metadata (`docker inspect`), .npmrc with token gets baked into layer

---

## Example 4: Runtime Security Hardening

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

## Example 5: Health Check Endpoint

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

### Dockerfile Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"]
```

**Why good:** Uses Node.js built-in fetch (no curl/wget needed in Alpine), start-period allows app startup time, retries prevent flapping, checks actual app health not just process existence

---

## Example 6: GitHub Actions CI/CD Pipeline

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
        uses: actions/checkout@v5

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
        uses: docker/metadata-action@v6
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

## Example 7: Docker Scout in CI

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
        uses: actions/checkout@v5

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
