# Cypress CI/CD Integration

> GitHub Actions, Docker, and CI pipeline patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Basic understanding of GitHub Actions workflows and CI/CD concepts.

---

## Pattern 1: Basic GitHub Actions Workflow

### Simple Cypress Test Run

```yaml
# .github/workflows/cypress.yml
name: Cypress Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  cypress-run:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
```

**Why good:** Uses official Cypress GitHub Action, handles dependency caching automatically, waits for server to be ready

---

## Pattern 2: Chrome Browser Testing

### Running Tests in Chrome

```yaml
# .github/workflows/cypress-chrome.yml
name: Cypress Chrome Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  cypress-chrome:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run in Chrome
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
          browser: chrome
```

### Multi-Browser Testing

```yaml
# .github/workflows/cypress-multi-browser.yml
name: Cypress Multi-Browser Tests

on:
  push:
    branches: [main]

jobs:
  cypress-browsers:
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        browser: [chrome, firefox, edge]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run - ${{ matrix.browser }}
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
          browser: ${{ matrix.browser }}
```

---

## Pattern 3: Parallel Execution

### Split Tests Across Workers

```yaml
# .github/workflows/cypress-parallel.yml
name: Cypress Parallel Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  install:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install dependencies
        uses: cypress-io/github-action@v6
        with:
          runTests: false
          build: npm run build

      - name: Save build folder
        uses: actions/upload-artifact@v4
        with:
          name: build
          if-no-files-found: error
          path: build

  cypress-run:
    runs-on: ubuntu-24.04
    needs: install
    strategy:
      fail-fast: false
      matrix:
        containers: [1, 2, 3, 4]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download build folder
        uses: actions/download-artifact@v4
        with:
          name: build
          path: build

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          start: npm start
          wait-on: "http://localhost:3000"
          record: true
          parallel: true
          group: "UI-Chrome"
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Note:** Parallel execution requires Cypress Cloud for test orchestration.

---

## Pattern 4: Docker Container Usage

### Using Cypress Docker Image

```yaml
# .github/workflows/cypress-docker.yml
name: Cypress Docker Tests

on:
  push:
    branches: [main]

jobs:
  cypress-docker:
    runs-on: ubuntu-24.04
    container:
      image: cypress/browsers:22.15.0
      options: --user 1001
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
          browser: chrome
```

### Docker Compose for Complex Setup

```yaml
# docker-compose.cypress.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgres://postgres:postgres@db:5432/test

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=test

  cypress:
    image: cypress/browsers:22.15.0
    depends_on:
      - app
    working_dir: /e2e
    volumes:
      - ./:/e2e
    environment:
      - CYPRESS_baseUrl=http://app:3000
    command: npx cypress run --browser chrome
```

```yaml
# .github/workflows/cypress-compose.yml
name: Cypress with Docker Compose

on:
  push:
    branches: [main]

jobs:
  cypress-e2e:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Start services
        run: docker-compose -f docker-compose.cypress.yml up -d app db

      - name: Wait for services
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:3000; do sleep 2; done'

      - name: Run Cypress tests
        run: docker-compose -f docker-compose.cypress.yml run cypress

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

---

## Pattern 5: Artifact Management

### Uploading Test Artifacts

```yaml
# .github/workflows/cypress-artifacts.yml
name: Cypress with Artifacts

on:
  push:
    branches: [main]

jobs:
  cypress-run:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-screenshots
          path: cypress/screenshots
          if-no-files-found: ignore

      - name: Upload videos
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-videos
          path: cypress/videos
          if-no-files-found: ignore

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-results
          path: cypress/results
          if-no-files-found: ignore
```

---

## Pattern 6: Environment Configuration

### Environment Variables

```yaml
# .github/workflows/cypress-env.yml
name: Cypress with Environment

on:
  push:
    branches: [main]

jobs:
  cypress-staging:
    runs-on: ubuntu-24.04
    environment: staging
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run against staging
        uses: cypress-io/github-action@v6
        with:
          browser: chrome
        env:
          CYPRESS_baseUrl: ${{ vars.STAGING_URL }}
          CYPRESS_API_URL: ${{ vars.STAGING_API_URL }}
          CYPRESS_AUTH_TOKEN: ${{ secrets.STAGING_AUTH_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Multiple Environments

```yaml
# .github/workflows/cypress-multi-env.yml
name: Cypress Multi-Environment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Environment to test"
        required: true
        default: "staging"
        type: choice
        options:
          - staging
          - production

jobs:
  cypress-test:
    runs-on: ubuntu-24.04
    environment: ${{ inputs.environment }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set environment URL
        id: set-url
        run: |
          if [ "${{ inputs.environment }}" == "production" ]; then
            echo "url=https://www.example.com" >> $GITHUB_OUTPUT
          else
            echo "url=https://staging.example.com" >> $GITHUB_OUTPUT
          fi

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          browser: chrome
        env:
          CYPRESS_baseUrl: ${{ steps.set-url.outputs.url }}
```

---

## Pattern 7: Recording to Cypress Cloud

### Basic Recording

```yaml
# .github/workflows/cypress-cloud.yml
name: Cypress Cloud Recording

on:
  push:
    branches: [main]

jobs:
  cypress-run:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run with recording
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
          record: true
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Tagged Recording

```yaml
- name: Cypress run with tags
  uses: cypress-io/github-action@v6
  with:
    build: npm run build
    start: npm start
    record: true
    tag: ${{ github.event_name }},${{ github.ref_name }}
  env:
    CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Pattern 8: Component Testing in CI

### Running Component Tests

```yaml
# .github/workflows/cypress-component.yml
name: Cypress Component Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  component-tests:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run component tests
        uses: cypress-io/github-action@v6
        with:
          component: true
          browser: chrome
```

### Combined E2E and Component

```yaml
# .github/workflows/cypress-combined.yml
name: Cypress All Tests

on:
  push:
    branches: [main]

jobs:
  component-tests:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Component tests
        uses: cypress-io/github-action@v6
        with:
          component: true

  e2e-tests:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: E2E tests
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
```

---

## Pattern 9: Cypress Configuration for CI

### cypress.config.ts for CI

```typescript
// cypress.config.ts
import { defineConfig } from "cypress";

const BASE_URL = process.env.CYPRESS_baseUrl || "http://localhost:3000";
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  e2e: {
    baseUrl: BASE_URL,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",

    // CI-specific settings
    video: IS_CI,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: IS_CI ? 10000 : 4000,
    pageLoadTimeout: IS_CI ? 30000 : 10000,

    retries: {
      runMode: IS_CI ? 2 : 0,
      openMode: 0,
    },

    // Reporter configuration
    reporter: IS_CI ? "junit" : "spec",
    reporterOptions: {
      mochaFile: "cypress/results/results-[hash].xml",
      toConsole: true,
    },

    setupNodeEvents(on, config) {
      // Implement node event listeners here
    },
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
});
```

---

## Pattern 10: Flaky Test Detection

### Retry Configuration

```yaml
# .github/workflows/cypress-retry.yml
name: Cypress with Retries

on:
  push:
    branches: [main]

jobs:
  cypress-run:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Cypress run with retries
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: "http://localhost:3000"
          config: retries=2
```

### Flaky Test Reporting

```yaml
# In cypress.config.ts
export default defineConfig({
  e2e: {
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      on("after:spec", (spec, results) => {
        if (results && results.stats.failures > 0) {
          // Log flaky tests (tests that passed after retry)
          results.tests
            .filter((test) => test.attempts.length > 1 && test.state === "passed")
            .forEach((test) => {
              console.log(`Flaky test detected: ${test.title}`);
            });
        }
      });
    },
  },
});
```

---

## Quick Reference: GitHub Action Options

| Option | Description | Example |
|--------|-------------|---------|
| `build` | Build command before tests | `npm run build` |
| `start` | Start server command | `npm start` |
| `wait-on` | URL to wait for | `http://localhost:3000` |
| `browser` | Browser to use | `chrome`, `firefox`, `edge` |
| `record` | Record to Cypress Cloud | `true` |
| `parallel` | Run tests in parallel | `true` |
| `group` | Group name for parallel | `UI-Chrome` |
| `component` | Run component tests | `true` |
| `config` | Cypress config overrides | `retries=2,video=true` |
| `spec` | Spec files to run | `cypress/e2e/auth/**/*.cy.ts` |
| `tag` | Tags for recording | `develop,nightly` |

---

_See [core.md](core.md) for E2E patterns and [reference.md](../reference.md) for troubleshooting._
