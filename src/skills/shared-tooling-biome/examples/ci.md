# Biome -- CI & Git Hooks Examples

> CI pipeline integration, pre-commit hooks, and staged file processing. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Installation, biome.json config, editor integration
- [linting.md](linting.md) -- Lint rules, domains, suppressions, overrides
- [formatting.md](formatting.md) -- Formatter config, Prettier compatibility
- [migration.md](migration.md) -- Migrating from ESLint + Prettier

---

## GitHub Actions (Minimal)

```yaml
# .github/workflows/lint.yml
name: Lint & Format
on: [push, pull_request]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
      - run: biome ci .
```

**Key:** The `biomejs/setup-biome` action installs the Biome binary directly -- no Node.js or npm required.

---

## GitHub Actions (Full Pipeline)

```yaml
# .github/workflows/quality.yml
name: Code Quality
on:
  push:
    branches: [main]
  pull_request:

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Option A: Use setup-biome (no Node.js needed)
      - uses: biomejs/setup-biome@v2
        with:
          version: latest

      # Run Biome CI with strict mode
      - run: biome ci --error-on-warnings --max-diagnostics=100 .

  # If using Biome with other Node.js tools
  biome-with-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx biome ci .
```

---

## GitHub Actions (Changed Files Only)

```yaml
# .github/workflows/lint-changed.yml
name: Lint Changed Files
on: pull_request

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: biomejs/setup-biome@v2
      - run: biome ci --changed --since=origin/main .
```

---

## GitLab CI

```yaml
# .gitlab-ci.yml
biome:
  image:
    name: ghcr.io/biomejs/biome:latest
    entrypoint: [""]
  stage: lint
  script:
    - biome ci --reporter=gitlab --colors=off > /tmp/code-quality.json
  artifacts:
    reports:
      codequality:
        - code-quality.json
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

---

## CLI Commands for CI vs Local

```bash
# Run everything: lint + format + organize imports (read-only)
npx biome check .

# Run everything with auto-fix
npx biome check --write .

# Format only
npx biome format --write .

# Lint only
npx biome lint --write .

# CI mode (read-only, optimized for pipelines)
npx biome ci .
```

### Filtering and Targeting

```bash
# Run only specific rule groups
npx biome lint --only=correctness .

# Skip specific rules
npx biome lint --skip=style/useNamingConvention .

# Check only staged files (pre-commit hooks)
npx biome check --staged --write .

# Check only changed files (compared to main branch)
npx biome check --changed --since=main .

# Apply unsafe fixes (requires review)
npx biome check --write --unsafe .
```

### Output and Reporting

```bash
# Verbose output
npx biome check --verbose .

# JSON reporter
npx biome ci --reporter=json .

# GitHub annotations (auto-detected in GitHub Actions)
npx biome ci --reporter=github .

# GitLab code quality report
npx biome ci --reporter=gitlab --colors=off > code-quality.json

# Error on warnings (strict mode)
npx biome ci --error-on-warnings .

# Limit diagnostics output
npx biome check --max-diagnostics=50 .
```

**Why good:** `check --write` handles everything in one command, `ci` is purpose-built for pipelines (no `--write` flag, better runner integration), `--staged` eliminates the need for lint-staged, `--changed` enables incremental CI checks

---

## Git Hooks

### Husky with --staged (Simplest)

```bash
# Install and configure Husky
npm install --save-dev husky
npx husky init
```

```bash
# .husky/pre-commit
npx biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched
```

**Why good:** The `--staged` flag (Biome v1.7.0+) eliminates the need for lint-staged entirely -- Biome handles staged file filtering natively

### Husky + lint-staged

If using lint-staged for multiple tools:

```jsonc
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,jsonc,css}": [
      "biome check --write --no-errors-on-unmatched",
    ],
  },
}
```

### Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome-check:
      glob: "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc,css}"
      run: >
        npx @biomejs/biome check --write
        --no-errors-on-unmatched
        --files-ignore-unknown=true
        --colors=off
        {staged_files}
      stage_fixed: true
```

### pre-commit Framework

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/biomejs/pre-commit
    rev: "v2.0.6"
    hooks:
      - id: biome-check
        additional_dependencies: ["@biomejs/biome@2.4.7"]
```

---

## See Also

- [SKILL.md](../SKILL.md) for core patterns and philosophy
- [reference.md](../reference.md) for complete CLI flags reference

**Official Documentation:**

- [Biome CI Integration](https://biomejs.dev/recipes/continuous-integration/)
- [Biome Git Hooks](https://biomejs.dev/recipes/git-hooks/)
- [Biome CLI Reference](https://biomejs.dev/reference/cli/)
