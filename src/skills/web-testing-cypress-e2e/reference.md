# Cypress E2E Testing Reference

> Lookup tables, config and CLI, version changes, troubleshooting. Decisions and red flags live in
> [SKILL.md](SKILL.md); code lives under [examples/](examples/core.md).

---

## Selector priority

| Priority | Selector         | Example                 | Use when                               |
| -------- | ---------------- | ----------------------- | -------------------------------------- |
| 1        | `data-cy`        | `[data-cy=submit]`      | Default choice                         |
| 2        | `cy.contains()`  | `cy.contains("Submit")` | The text is the subject                |
| 3        | `name` attribute | `input[name="email"]`   | Form controls                          |
| 4        | Semantic element | `button[type="submit"]` | No attribute available                 |
| 5        | CSS class        | `.btn-primary`          | Last resort — moves with styling       |
| 6        | Id               | `#submit-btn`           | Last resort — an implementation detail |
| 7        | DOM position     | `div > button:first`    | Breaks on any markup change            |

---

## Assertions

| Assertion                  | Checks              | Example                                                    |
| -------------------------- | ------------------- | ---------------------------------------------------------- |
| `should("be.visible")`     | Visible on screen   | `cy.getBySel("modal").should("be.visible")`                |
| `should("not.exist")`      | Absent from the DOM | `cy.getBySel("error").should("not.exist")`                 |
| `should("not.be.visible")` | Present but hidden  | `cy.getBySel("menu").should("not.be.visible")`             |
| `should("be.disabled")`    | Disabled control    | `cy.getBySel("submit").should("be.disabled")`              |
| `should("have.value")`     | Input value         | `cy.getBySel("email").should("have.value", "a@b.com")`     |
| `should("contain")`        | Contains text       | `cy.getBySel("message").should("contain", "Success")`      |
| `should("have.length")`    | Match count         | `cy.getBySel("item").should("have.length", 5)`             |
| `should("have.class")`     | Class present       | `cy.getBySel("tab").should("have.class", "active")`        |
| `should("have.attr")`      | Attribute value     | `cy.getBySel("link").should("have.attr", "href", "/home")` |

```typescript
// Chain conditions on one query — all of them retried together
cy.getBySel("email-input")
  .should("be.visible")
  .and("have.attr", "type", "email")
  .and("have.value", "");

// Location
cy.url().should("include", "/dashboard");
cy.location("pathname").should("eq", "/dashboard");
```

---

## Cypress 14 / 15 changes

### Removed

| Removed                       | Replacement                         | Version |
| ----------------------------- | ----------------------------------- | ------- |
| `delayMs` on `cy.intercept()` | `delay`                             | 14.0    |
| `cypress open-ct` / `run-ct`  | the `--component` flag              | 14.0    |
| Three-argument `cy.stub()`    | `cy.stub(obj, method).returns(val)` | 15.0    |

### Deprecated but still working

| Deprecated                                 | Replacement                                                  | Notes                                                                          |
| ------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `resourceType` on `cy.intercept()`         | Route matching                                               | Deprecated in 14.0                                                             |
| `Cypress.env()`                            | `cy.env()` for secrets, `Cypress.expose()` for public values | Deprecated in 15.10, removed in 16; `cy.env()` is async                        |
| `Cypress.Commands.overwrite()` for queries | `Cypress.Commands.overwriteQuery()`                          | Queries are `.get()`, `.find()`, `.contains()`, `cy.location()`, `cy.window()` |

### Changed or added in 15

| Change                               | Detail                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `cy.exec()` returns `exitCode`       | Renamed from `code` — update `.its("code")`             |
| `Cypress.ElementSelector`            | Renamed from `Cypress.SelectorPlayground`               |
| `--pass-with-no-tests`               | Exit 0 when no spec matches                             |
| `cy.env(keys)` (15.10)               | Async, exposes only the variables asked for             |
| `Cypress.expose(key, value)` (15.10) | Public configuration values — flags, environment labels |

### Requirements (Cypress 15)

Node 20+ (18 and 23 dropped), macOS 11+, and for component testing React 18+, Angular 17.2+ or
Vue 3+.

`cy.origin()` has been mandatory for cross-origin navigation since 14, because Chrome removed the
`document.domain` behaviour Cypress previously relied on.

---

## Configuration

| Option                   | Effect                                             | Typical value                  |
| ------------------------ | -------------------------------------------------- | ------------------------------ |
| `baseUrl`                | Base for `cy.visit()`                              | dev server URL                 |
| `specPattern`            | Which files are specs                              | `cypress/e2e/**/*.cy.{ts,tsx}` |
| `supportFile`            | Loaded before every spec                           | `cypress/support/e2e.ts`       |
| `testIsolation`          | Reset cookies and storage between tests (e2e only) | `true` — the default           |
| `defaultCommandTimeout`  | Retry budget per command (ms)                      | `4000`, higher in CI           |
| `pageLoadTimeout`        | Navigation budget (ms)                             | `10000`, higher in CI          |
| `retries.runMode`        | Retries in `cypress run`                           | `2`                            |
| `retries.openMode`       | Retries while iterating                            | `0`                            |
| `video`                  | Record video                                       | CI only                        |
| `screenshotOnRunFailure` | Capture on failure                                 | `true`                         |
| `e2e.setupNodeEvents`    | Node-side hooks and tasks                          | `on("task", …)`                |
| `component.devServer`    | Framework and bundler                              | the project's own              |

### Suggested layout

```
cypress/
├── e2e/          specs by journey: auth/, checkout/, search/
├── component/    component specs, *.cy.tsx
├── fixtures/     JSON test data
└── support/      commands.ts, e2e.ts, component.ts, index.d.ts
```

Naming: `*.cy.ts` for E2E specs, `*.cy.tsx` for component specs, `index.d.ts` for the `Chainable`
declarations.

---

## CLI

```bash
npx cypress open                                    # interactive runner
npx cypress run                                     # headless
npx cypress run --spec "cypress/e2e/auth/**/*.cy.ts"
npx cypress run --browser chrome
npx cypress run --component
npx cypress run --env apiUrl=http://localhost:4000
```

---

## Troubleshooting

| Symptom                                        | Usually                                               | Try                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Passes sometimes, fails otherwise              | `cy.wait(ms)`, or state shared between specs          | Wait on an intercept alias; reset in `beforeEach`; stub external APIs                                           |
| `Timed out retrying: expected to find element` | Element hidden, conditional, or inside an iframe      | Check it renders at all; scope with `.within()`; use an iframe helper for iframes                               |
| Value read from a command is `undefined`       | The command had not run yet                           | `.then()` or an alias — see [core.md](examples/core.md) Pattern 5                                               |
| Green locally, red in CI                       | Slower machine, missing env values, different browser | Raise `defaultCommandTimeout` under CI, enable `retries.runMode`, stub external APIs, seed data in `beforeEach` |
