---
name: web-testing-cypress-e2e
description: Cypress E2E testing patterns - test structure, data-cy selectors, cy.intercept() mocking, custom commands, fixtures, component testing, accessibility testing with cypress-axe, and CI/CD integration
---

# Cypress E2E Testing Patterns

> **Quick Guide:** Cypress runs inside the browser alongside the application. Commands are enqueued
> rather than executed, so nothing they produce can be read out of a `const` — use `.then()` or an
> alias. Select with `data-cy` attributes, wait on `cy.intercept()` aliases rather than on
> milliseconds, and cache authentication with `cy.session()`. Cypress 15 is current stable;
> `cy.origin()` has been required for any cross-origin navigation since 14, and `Cypress.env()` is
> deprecated in favour of `cy.env()` and `Cypress.expose()`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — user flows, structure, selectors, assertions, aliases,
  `cy.session()`, keys and focus
- [examples/intercept.md](examples/intercept.md) — stubbing, error states, request verification,
  response modification, sequencing
- [examples/custom-commands.md](examples/custom-commands.md) — command types, TypeScript
  declarations, `cy.task()`, `cy.origin()`
- [examples/fixtures-data.md](examples/fixtures-data.md) — fixture files, factories, shared
  constants
- [examples/component-testing.md](examples/component-testing.md) — `cy.mount()`, spies on props,
  intercepts in component specs
- [examples/accessibility.md](examples/accessibility.md) — wiring an accessibility audit into a run
- [examples/ci.md](examples/ci.md) — the CI config decisions and the official action's options
- [reference.md](reference.md) — selector and assertion tables, config and CLI lookup, Cypress
  14/15 changes, troubleshooting

---

## Which path applies

- **A user journey through the running app** — specs in `cypress/e2e`, entered with `cy.visit()`,
  configured under the `e2e` key; follow [examples/core.md](examples/core.md).
- **One component in isolation** — specs in `cypress/component`, entered with `cy.mount()`,
  configured under the `component` key with a dev server; follow
  [examples/component-testing.md](examples/component-testing.md).

Both halves share the command API, the selectors and `cy.intercept()`; only the entry point and the
config block differ.

---

<critical_requirements>

## Before writing Cypress code

**Alias every intercept and wait on the alias** — `cy.intercept(...).as("getUsers")` then
`cy.wait("@getUsers")`. The wait ends exactly when the response arrives, where a millisecond wait is
either too short or wasted.

**Select with a dedicated test attribute** — `[data-cy=submit-button]`. It is the one hook in the
markup that styling changes and DOM restructuring do not move.

**Read a command's result through `.then()` or an alias.** Commands are queued and run after the
enclosing function returns, so a `const` captures a chainer rather than a value.

**Wrap cross-origin navigation in `cy.origin()`** — required since Cypress 14, because Chrome
removed the `document.domain` setter Cypress previously used to reach another origin from the same
agent cluster.

</critical_requirements>

---

**Auto-detection:** Cypress, cypress.config, cy.visit, cy.get, cy.contains, cy.intercept, cy.wait,
cy.origin, cy.session, cy.fixture, cy.task, cy.mount, cy.env, Cypress.Commands.add,
Cypress.Commands.overwriteQuery, data-cy, .cy.ts specs

**Applies to:**

- User journeys through the running application, including cross-origin steps
- Selector strategy, assertions and Cypress's retry model
- Stubbing, delaying and verifying network traffic with `cy.intercept()`
- Custom commands, fixtures, `cy.session()` and `cy.task()`
- Component specs mounted with `cy.mount()`, and the config both spec types share

**Handled elsewhere:**

- Authoring the components under test — a component spec mounts what already exists
- What makes an interface accessible — this skill wires an audit into the run and asserts on its
  result; the standard being audited against is settled elsewhere
- Pipeline authoring — this skill covers the runner's own CI-relevant settings, not how a workflow
  is written
- Unit-level checks on pure functions, which need no browser at all

---

<philosophy>

Cypress commands do not execute where they are written. Each one is appended to a queue that runs
after the surrounding function returns, which explains nearly every surprise: why a `const` is
useless, why `.then()` exists, and why an assertion "waits" without anyone asking it to.

Retry-ability follows from the same model. Cypress re-runs the **last query** in a chain until the
attached assertion passes, so `cy.get(...).should(...)` is self-waiting while
`cy.get(...).then(el => expect(el)...)` is not — the `.then()` body runs once, on whatever the query
found the first time.

</philosophy>

---

<decision_framework>

**Which selector:**

- You can add an attribute to the markup → `data-cy`, always the first choice.
- The text itself is the thing under test → `cy.contains("Sign In")`, so a copy change fails the
  test deliberately.
- A form control with a stable `name` → `input[name="email"]`.
- Nothing else available → a semantic selector such as `button[type="submit"]`; classes and ids are
  the last resort because both move with styling.

**Stub the request or let it through:**

- Third-party API → stub it; its rate limits and downtime are not your test's subject.
- Your own API, testing an error path or a specific payload → stub it with `cy.intercept()`.
- Your own API, testing that the whole stack agrees → let it through, and keep one such test per
  feature.

**How to reach an authenticated state:**

- Through the UI, once, cached → `cy.session()` with a `validate` callback; add
  `cacheAcrossSpecs: true` to keep it between spec files.
- Skipping the UI entirely → `cy.request()` to the login endpoint inside `cy.session()`, which is
  faster and does not re-test the login form in every spec.
- Needing server state as well → `cy.task()` to seed, called from `beforeEach`.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Test structure

`describe` groups the feature, `context` separates scenarios, `beforeEach` puts every test in the
same starting state.

```typescript
describe("Login Flow", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  context("with valid credentials", () => {
    it("redirects to the dashboard", () => {
      cy.getBySel("email-input").type(VALID_EMAIL);
      cy.getBySel("password-input").type(VALID_PASSWORD);
      cy.getBySel("submit-button").click();
      cy.url().should("include", "/dashboard");
    });
  });
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Selectors

```typescript
cy.get("[data-cy=submit-button]").click();
cy.getBySel("submit-button").click(); // same thing, via a custom command
cy.contains("button", "Submit").click(); // when the text is the subject

cy.getBySel("confirmation-modal").within(() => {
  cy.getBySel("confirm-button").click(); // scoped, so a duplicate id elsewhere cannot match
});
```

Full code: [examples/core.md](examples/core.md) — the command itself in
[examples/custom-commands.md](examples/custom-commands.md)

### Pattern 3: Network stubbing with `cy.intercept()`

```typescript
cy.intercept("GET", "/api/users", { statusCode: 200, body: MOCK_USERS }).as(
  "getUsers",
);

cy.visit("/users");
cy.wait("@getUsers");
cy.getBySel("user-row").should("have.length", 2);

// The alias also carries the request, so the payload can be asserted on
cy.wait("@createUser")
  .its("request.body")
  .should("deep.include", { name: "New User" });
```

Full code: [examples/intercept.md](examples/intercept.md)

### Pattern 4: Custom commands

Wrap the flows every spec repeats, and declare their types so editors and `tsc` see them.

```typescript
// cypress/support/commands.ts
Cypress.Commands.add("login", (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit("/login");
    cy.getBySel("email-input").type(email);
    cy.getBySel("password-input").type(password);
    cy.getBySel("submit-button").click();
    cy.url().should("include", "/dashboard"); // guards the cache: session is saved after this
  });
});
```

Full code: [examples/custom-commands.md](examples/custom-commands.md)

### Pattern 5: Fixtures and factories

A fixture file for data that several specs share; a factory for data a single scenario shapes.

```typescript
cy.intercept("GET", "/api/products", { fixture: "products.json" }).as(
  "getProducts",
);

const users = createUsers(5);
cy.intercept("GET", "/api/users", { body: users }).as("getUsers");
```

Full code: [examples/fixtures-data.md](examples/fixtures-data.md)

### Pattern 6: Cross-origin steps with `cy.origin()`

Anything on another scheme, host or port runs inside the callback, which is serialised into that
origin — so it can only see values passed through `args`.

```typescript
cy.visit("/login");
cy.getBySel("sso-button").click();

cy.origin(
  IDENTITY_PROVIDER_URL,
  { args: { email, password } },
  ({ email, password }) => {
    cy.get("#email").type(email);
    cy.get("#password").type(password);
    cy.get("#submit").click();
  },
);

cy.url().should("include", "/dashboard"); // back on the original origin
```

Full code: [examples/custom-commands.md](examples/custom-commands.md)

### Pattern 7: Component specs with `cy.mount()`

The same command API against a mounted component instead of a visited page. `cy.spy().as()` records
prop callbacks; `cy.intercept()` works exactly as it does in an E2E spec.

```typescript
const onSelect = cy.spy().as("onSelect");
cy.mount(<ProductList products={MOCK_PRODUCTS} onSelect={onSelect} />);

cy.getBySel("product-item").first().click();
cy.get("@onSelect").should("have.been.calledWith", MOCK_PRODUCTS[0]);
```

Full code: [examples/component-testing.md](examples/component-testing.md)

### Pattern 8: Work outside the browser with `cy.task()`

`cy.task()` runs in the Node process, which is the only place a test can reach a database, the
filesystem, or anything else the browser cannot.

```typescript
// cypress.config.ts — setupNodeEvents
on("task", { "db:seed": (data) => seed(data), "db:reset": () => reset() });

// in a spec
beforeEach(() => {
  cy.task("db:reset");
  cy.task("db:seed", { users: [TEST_USER] });
});
```

Full code: [examples/custom-commands.md](examples/custom-commands.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `const el = cy.get(...)` then using `el` later — the command has not run; alias it with `.as()`
  and read it back with `cy.get("@alias")`.
- `cy.fixture("users").as("users")` read as `this.users` from an arrow function — `this` is not the
  test context there; use `function ()`.
- Navigating to another origin without `cy.origin()` — refused since Cypress 14.
- `delayMs` on `cy.intercept()` — removed in 14; the option is `delay`.
- `cypress open-ct` / `run-ct` — removed in 14; use the `--component` flag.
- The three-argument `cy.stub()` form — removed in 15; use `cy.stub(obj, "method").returns(value)`.
- `Cypress.Commands.overwrite()` against a query such as `.get()` or `.contains()` — queries need
  `Cypress.Commands.overwriteQuery()` since 14.
- `.its("code")` on `cy.exec()` — renamed to `exitCode` in 15.
- Starting a web server from inside a test with `cy.exec()` — the process never exits and the run
  hangs; start it from the CI step or `webServer`-style tooling instead.

**Surprising behaviour:**

- `cy.wait(5000)` passes today and fails on a slower machine — wait on an intercept alias instead.
- Every `it()` starts from a reset browser: `testIsolation` clears cookies and both storages between
  e2e tests, so a spec that signs in during its first test and assumes it in the second fails, and
  fails differently when run alone. Put the setup in `beforeEach`, and use `cy.session()` so
  restoring it costs nothing.
- Only the **last** query in a chain retries, so an assertion inside `.then()` runs once against a
  stale element.
- Fixture files are cached for the run; a file changed mid-run still serves the old content, so use
  `cy.readFile()` where freshness matters.
- `cy.session()` clears cached state when the spec file changes unless `cacheAcrossSpecs: true` is
  set.
- Cleanup in `after`/`afterEach` is skipped when a run is interrupted — clean in `beforeEach`, which
  also leaves the final state on screen for debugging.
- Intercept routes last for the whole test and later registrations shadow earlier ones — set them up
  in `beforeEach` so no test inherits another's stub.
- `Cypress.env()` is deprecated from 15.10 and removed in 16 — `cy.env()` (async, for secrets) and
  `Cypress.expose()` (for public values) replace it.
- Branded Chrome no longer accepts `--load-extension` from 137 — run extension tests in Electron,
  Chrome for Testing or Chromium.

</red_flags>
