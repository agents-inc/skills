# Cypress — Custom Commands

> Command kinds, TypeScript declarations, `cy.task()` and `cy.origin()`. See [core.md](core.md) for
> the foundations.

A command is registered once in `cypress/support/commands.ts` (loaded by `cypress/support/e2e.ts`)
and declared once in `cypress/support/index.d.ts` so editors and `tsc` see it.

---

## Pattern 1: Selector commands, and how declarations work

```typescript
// cypress/support/commands.ts
Cypress.Commands.add("getBySel", (selector: string, ...args) =>
  cy.get(`[data-cy=${selector}]`, ...args),
);

Cypress.Commands.add("getBySelLike", (selector: string, ...args) =>
  cy.get(`[data-cy*=${selector}]`, ...args),
);
```

```typescript
// cypress/support/index.d.ts
/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Get an element by its data-cy attribute.
     * @example cy.getBySel('submit-button')
     */
    getBySel(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;

    /** Partial data-cy match: 'error' matches data-cy="error-message". */
    getBySelLike(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>,
    ): Chainable<JQuery<HTMLElement>>;
  }
}
```

**Why good:** the `options` parameter is forwarded, so `cy.getBySel("row", { timeout: 10_000 })`
behaves like `cy.get`. Every command below adds one more entry to this same `Chainable` interface —
the declaration file is the single place they are all typed.

---

## Pattern 2: Authentication commands

```typescript
// cypress/support/commands.ts
const LOGIN_URL = "/login";
const DASHBOARD_URL = "/dashboard";

// Through the UI, cached across spec files.
Cypress.Commands.add("login", (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.visit(LOGIN_URL);
      cy.getBySel("email-input").type(email);
      cy.getBySel("password-input").type(password);
      cy.getBySel("submit-button").click();
      // Guarding assertion: the session is captured only after this passes.
      cy.url().should("include", DASHBOARD_URL);
    },
    {
      validate: () => cy.getCookie("session").should("exist"),
      cacheAcrossSpecs: true, // without it the cache is cleared per spec file
    },
  );
});

// Skipping the UI entirely — faster, and does not re-test the login form in every spec.
Cypress.Commands.add("loginViaApi", (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.request("POST", "/api/auth/login", { email, password }).then(
        (response) => {
          window.localStorage.setItem("authToken", response.body.token);
        },
      );
    },
    {
      validate: () => cy.window().its("localStorage.authToken").should("exist"),
    },
  );
});

Cypress.Commands.add("logout", () => {
  cy.clearCookies();
  cy.clearLocalStorage();
});
```

```typescript
// cypress/support/index.d.ts — added to the same Chainable interface
login(email: string, password: string): Chainable<void>;
loginViaApi(email: string, password: string): Chainable<void>;
logout(): Chainable<void>;
```

**Why good:** login happens once per credential pair for the whole run. The API variant is the one
to reach for in specs that are not about the login form, since it costs a request rather than a page
load and a form submission.

---

## Pattern 3: Child and dual commands

```typescript
// Child: requires a subject, so it chains off a query.
Cypress.Commands.add(
  "scrollAndClick",
  { prevSubject: "element" },
  (subject: JQuery<HTMLElement>) => {
    cy.wrap(subject).scrollIntoView().should("be.visible").click();
  },
);

// Dual: works with or without a subject.
Cypress.Commands.add(
  "captureScreenshot",
  { prevSubject: "optional" },
  (subject: JQuery<HTMLElement> | undefined, name: string) => {
    if (subject) {
      cy.wrap(subject).screenshot(name);
    } else {
      cy.screenshot(name);
    }
  },
);
```

```typescript
cy.getBySel("hidden-button").scrollAndClick();
cy.captureScreenshot("full-page");
cy.getBySel("header").captureScreenshot("header-only");
```

**Why good:** `prevSubject` is what decides whether the command reads as a verb on an element or as
a statement of its own, and `cy.wrap(subject)` is what puts the subject back into the queue.

---

## Pattern 4: `cy.task()` for work outside the browser

`setupNodeEvents` runs in Node, so a task can reach a database, the filesystem or any package the
browser cannot load.

```typescript
// cypress.config.ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on("task", {
        "db:seed": async (data: { users?: object[]; products?: object[] }) => {
          const response = await fetch(`${config.env.apiUrl}/test/seed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          return response.json(); // a task must return something, or null
        },
        "db:reset": async () => {
          await fetch(`${config.env.apiUrl}/test/reset`, { method: "POST" });
          return null;
        },
      });
    },
  },
});
```

```typescript
describe("User management", () => {
  beforeEach(() => {
    // Cleanup belongs here rather than in an after hook: an interrupted run skips after hooks,
    // and the final state stays on screen for debugging.
    cy.task("db:reset");
    cy.task("db:seed", { users: [{ id: "1", name: "Test User" }] });
  });

  it("lists the seeded users", () => {
    cy.visit("/users");
    cy.getBySel("user-row").should("have.length", 1);
  });
});
```

**Why good:** the test states the data it needs instead of depending on whatever the environment
happens to contain. Returning `null` matters — a task that returns `undefined` fails the run.

---

## Pattern 5: `cy.origin()` for cross-origin flows

Required since Cypress 14 for any navigation to a different scheme, host or port. The callback is
serialised into the other origin, so it closes over nothing — everything it needs arrives through
`args`.

```typescript
// cypress/support/commands.ts
Cypress.Commands.add(
  "loginViaIdentityProvider",
  (email: string, password: string, providerUrl: string) => {
    cy.session(
      ["sso", email],
      () => {
        cy.visit("/login");
        cy.getBySel("sso-login-button").click();

        cy.origin(
          providerUrl,
          { args: { email, password } },
          ({ email, password }) => {
            // Selectors here belong to the provider's page, not to your app.
            cy.get("#email").type(email);
            cy.get("#password").type(password);
            cy.get("#submit").click();
          },
        );

        cy.url().should("include", "/dashboard"); // back on the original origin
      },
      {
        validate: () => cy.getCookie("session").should("exist"),
        cacheAcrossSpecs: true,
      },
    );
  },
);
```

```typescript
// Subdomains count as separate origins too.
cy.visit("https://app.example.com/settings");

cy.origin("https://admin.example.com", () => {
  cy.visit("/admin");
  cy.get("[data-cy=admin-panel]").should("be.visible");
});
```

**Why good:** wrapping the provider's page in `cy.origin()` keeps the whole journey in one spec, and
caching the result with `cy.session()` means the external round trip happens once rather than per
test. The callback uses plain `cy.get` because it runs in the provider's origin, where the support
file's own commands and constants are not in scope.
