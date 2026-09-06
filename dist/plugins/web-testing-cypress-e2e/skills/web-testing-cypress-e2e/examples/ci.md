# Cypress — Running in CI

> The runner's own CI surface: the official action's options, the config that differs under CI, and
> the artifacts a run produces. How a pipeline is structured is settled by whoever owns CI; this
> file covers what Cypress needs from it.

---

## Pattern 1: The official action

`cypress-io/github-action` installs, caches, builds, starts the app, waits for it and runs the
suite. The three options that matter are `build`, `start` and `wait-on` — without `wait-on` the run
starts against a server that is not listening yet.

```yaml
- uses: cypress-io/github-action@v6
  with:
    build: npm run build
    start: npm start
    wait-on: "http://localhost:3000"
    browser: chrome
```

| Option      | Purpose                        | Example                                                |
| ----------- | ------------------------------ | ------------------------------------------------------ |
| `build`     | Command run before the tests   | `npm run build`                                        |
| `start`     | Command that serves the app    | `npm start`                                            |
| `wait-on`   | URL polled until it answers    | `http://localhost:3000`                                |
| `browser`   | Browser to run in              | `chrome`, `firefox`, `edge`                            |
| `component` | Run component specs instead    | `true`                                                 |
| `spec`      | Narrow the run                 | `cypress/e2e/auth/**/*.cy.ts`                          |
| `runTests`  | Install and build only         | `false`, in a job that primes the cache for later ones |
| `config`    | Override config values inline  | `retries=2,video=true`                                 |
| `record`    | Send results to Cypress Cloud  | `true`                                                 |
| `parallel`  | Split specs across machines    | `true`                                                 |
| `group`     | Label for a parallel run       | `UI-Chrome`                                            |
| `tag`       | Labels attached to a recording | `nightly`                                              |

**Parallelism needs Cypress Cloud.** `parallel: true` asks the Cloud service to allocate specs to
each machine; without `record: true` and `CYPRESS_RECORD_KEY` the machines all run the whole suite.

**A prebuilt image** — `cypress/browsers` — carries the browsers and system libraries, which is what
removes the install step from every job.

---

## Pattern 2: Configuration that differs under CI

```typescript
// cypress.config.ts
import { defineConfig } from "cypress";

const IS_CI = Boolean(process.env.CI);

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_baseUrl ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",

    video: IS_CI, // the artifact is only useful where nobody watched
    screenshotOnRunFailure: true,
    defaultCommandTimeout: IS_CI ? 10_000 : 4_000, // CI machines are slower than laptops
    pageLoadTimeout: IS_CI ? 30_000 : 10_000,

    retries: { runMode: IS_CI ? 2 : 0, openMode: 0 }, // never retry while iterating

    reporter: IS_CI ? "junit" : "spec",
    reporterOptions: {
      mochaFile: "cypress/results/results-[hash].xml",
      toConsole: true,
    },
  },

  component: {
    devServer: { framework: "react", bundler: "vite" },
  },
});
```

**Why good:** every value is a decision about the environment rather than a preference — retries
hide flakiness locally where it should be fixed, and video costs time on a run someone is watching
live.

**Environment values** reach the runner through `CYPRESS_`-prefixed variables: `CYPRESS_baseUrl`
overrides `baseUrl`, and anything else lands in `config.env`.

---

## Pattern 3: Surfacing flaky specs

A spec that passes on retry is invisible in the exit code. `after:spec` is where it can be reported.

```typescript
setupNodeEvents(on) {
  on("after:spec", (spec, results) => {
    results.tests
      .filter((test) => test.attempts.length > 1 && test.state === "passed")
      .forEach((test) => console.log(`Flaky: ${spec.relative} — ${test.title}`));
  });
}
```

**Why good:** retries keep a pipeline green, so without this the suite quietly degrades until the
retries stop being enough.

---

## Artifacts a run produces

| Path                  | Written when                           |
| --------------------- | -------------------------------------- |
| `cypress/screenshots` | A test fails, and on `cy.screenshot()` |
| `cypress/videos`      | `video: true`                          |
| `cypress/results`     | Whatever the configured reporter emits |

Upload these from the pipeline on failure; a screenshot of the moment an assertion failed is usually
faster to read than the log.
