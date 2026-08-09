# Infra Reviewing - Core Examples

> Good/bad infrastructure patterns to look for during review. See [../SKILL.md](../SKILL.md) for checklists and the severity framework.

---

## SHA-Pinned Actions

```yaml
# Must Fix: both mutable - the tag can be rewritten to point at hostile code
- uses: actions/checkout@main
- uses: cool-org/setup-thing@v2

# Good: immutable SHAs; the comment keeps the version readable and bumpable
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
- uses: cool-org/setup-thing@5c1f9e1a1c9436c9e73d29b3a1a8d9d5f7f0e2ab # v2.3.0
```

---

## Least-Privilege Workflow Permissions

```yaml
# Must Fix: no permissions block - the job inherits whatever the org default grants,
# often contents: write, on a workflow that only reads
name: test
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest

# Good: read by default, write scopes named one by one where a job needs them
name: test
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
  comment:
    permissions:
      contents: read
      pull-requests: write
```

---

## Secrets Out of Build Args and Logs

```dockerfile
# Must Fix: `docker history` on the pushed image prints the token forever
ARG API_TOKEN
RUN curl -H "Authorization: Bearer ${API_TOKEN}" https://registry.example.com/setup

# Good: BuildKit secret mount - present during the RUN, absent from every layer
RUN --mount=type=secret,id=api_token \
    curl -H "Authorization: Bearer $(cat /run/secrets/api_token)" https://registry.example.com/setup
```

```yaml
# Must Fix: debug line ships the secret to the log archive
- run: echo "deploying with key ${{ secrets.DEPLOY_KEY }}"

# Good: log the fact, never the value
- run: echo "deploying to ${ENVIRONMENT}"
```

---

## Non-Root, Cache-Friendly Dockerfile

```dockerfile
# Should Fix x3: root user, cache busted by every source change, build tools shipped to prod
FROM node:22
COPY . .
RUN npm install && npm run build
CMD ["node", "dist/server.js"]

# Good: staged, manifest-first, unprivileged runtime
FROM node:22.12-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.12-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

---

## Deploy Concurrency and Job Ordering

```yaml
# Should Fix: two merges in quick succession deploy in whichever order the runners finish
jobs:
  deploy:
    runs-on: ubuntu-latest

# Good: one deploy at a time, later run supersedes; and deploy waits for the suite
concurrency:
  group: deploy-production
  cancel-in-progress: false
jobs:
  deploy:
    needs: [lint, test, e2e]
    runs-on: ubuntu-latest
```

---

## Lockfile-Faithful Installs

```yaml
# Should Fix: npm install may resolve different versions than the lockfile CI just checked out
- run: npm install && npm test

# Good: exactly the committed dependency tree, or fail
- run: npm ci
- run: npm test
```
