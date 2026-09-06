# Cypress — Running an Accessibility Audit in a Spec

> Wiring an automated audit into a Cypress run and asserting on its result. See [core.md](core.md)
> for the foundations. What the audit checks for, and which findings matter, is settled by whoever
> owns accessibility standards — this file covers the plumbing.

**Prerequisites:** `npm install --save-dev axe-core cypress-axe`.

---

## Pattern 1: Setup

```typescript
// cypress/support/e2e.ts
import "cypress-axe";
```

```typescript
// cypress/support/commands.ts — inject and check in one call
Cypress.Commands.add(
  "checkAccessibility",
  (context?: string, options?: object) => {
    cy.injectAxe();
    cy.checkA11y(context, options);
  },
);
```

```typescript
// cypress/support/index.d.ts
/// <reference types="cypress-axe" />

declare namespace Cypress {
  interface Chainable {
    /** Inject the audit engine and check the page, or a region of it. */
    checkAccessibility(context?: string, options?: object): Chainable<void>;
  }
}
```

**Why good:** the engine has to be injected after every navigation, which is the step most easily
forgotten; folding it into one command means a spec cannot check a page that was never instrumented.

---

## Pattern 2: Whole page, and one region

```typescript
describe("Accessibility", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe(); // re-injected per test, because each starts with a fresh page
  });

  it("has no violations on the homepage", () => {
    cy.checkA11y();
  });

  it("has no violations in the navigation", () => {
    // Scoping reports only the region under test, so an unrelated failure elsewhere
    // does not redden a component's own spec.
    cy.checkA11y("[data-cy=main-navigation]");
  });
});
```

---

## Pattern 3: Narrowing what counts as a failure

```typescript
// By rule tag — the set the project has agreed to hold itself to.
cy.checkA11y(null, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });

// By individual rule, when one class of issue is being worked on.
cy.checkA11y(null, { runOnly: { type: "rule", values: ["color-contrast"] } });

// By severity, so a large legacy surface can be gated on the worst findings first.
cy.checkA11y(null, { includedImpacts: ["critical", "serious"] });

// Known issues, disabled deliberately and visibly rather than by lowering the bar everywhere.
cy.checkA11y(null, { rules: { "color-contrast": { enabled: false } } });

// Third-party markup nobody here can fix.
cy.checkA11y(null, { exclude: ["[data-cy=third-party-chat-widget]"] });
```

**Why good:** each option narrows a different axis — standard, rule, severity, region — so a
temporary exception is one line that says what it excuses, rather than a disabled test.

---

## Pattern 4: Reporting instead of only failing

The fourth argument is a violation callback and the fifth makes the check non-blocking, which is
what lets a suite report findings while a backlog is worked through.

```typescript
function logViolations(violations: axe.Result[]) {
  violations.forEach((violation) => {
    cy.log(
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes.length} nodes`,
    );
  });
}

it("reports violations without failing the run", () => {
  cy.visit("/");
  cy.injectAxe();
  cy.checkA11y(null, undefined, logViolations, true);
});

function failOnCriticalOnly(violations: axe.Result[]) {
  const critical = violations.filter((v) => v.impact === "critical");
  if (critical.length > 0) {
    throw new Error(critical.map((v) => `${v.id}: ${v.help}`).join("\n"));
  }
  violations.forEach((v) => cy.log(`non-critical: ${v.id}`));
}

it("fails only on critical findings", () => {
  cy.visit("/");
  cy.injectAxe();
  cy.checkA11y(null, undefined, failOnCriticalOnly, true);
});
```

**Why good:** the default failure message names the rule but not the element; a callback puts the
node count and the help text in the run log, which is what makes a finding actionable.

---

## Pattern 5: Auditing after an interaction, and across routes

```typescript
it("keeps the modal accessible once opened", () => {
  cy.visit("/");
  cy.injectAxe();

  cy.checkA11y(); // before
  cy.getBySel("open-modal-button").click();
  cy.getBySel("modal").should("be.visible");
  cy.checkA11y("[data-cy=modal]"); // and in the state the interaction produced
});
```

```typescript
const PUBLIC_ROUTES = ["/", "/login", "/products", "/contact"];

PUBLIC_ROUTES.forEach((path) => {
  it(`has no critical violations on ${path}`, () => {
    cy.visit(path);
    cy.injectAxe();
    cy.checkA11y(null, { includedImpacts: ["critical", "serious"] });
  });
});
```

**Why good:** a static page audit misses everything a dialog, a menu or a validation error
introduces, and those are where accessible-name and focus problems actually live. Generating one
test per route keeps the failure attributable to a single page.

A component spec audits the same way — `cy.mount()` first, then `cy.injectAxe()` and `cy.checkA11y()`
— see [component-testing.md](component-testing.md).

An audit reports what the markup declares; whether the page can be operated without a mouse is a
keyboard test. The commands for that — `cy.focused()`, the braced key syntax, and why Tab is the
exception — are in [core.md](core.md) Pattern 7.
