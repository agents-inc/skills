# Cypress Accessibility Testing with cypress-axe

> Accessibility testing patterns using axe-core. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Install `axe-core` and `cypress-axe`:
```bash
npm install --save-dev axe-core cypress-axe
```

---

## Pattern 1: Basic Setup

### Installing and Configuring cypress-axe

```typescript
// cypress/support/e2e.ts
import "cypress-axe";

// cypress/support/commands.ts (add to existing commands)
export function registerAccessibilityCommands() {
  // Optionally add custom a11y command
  Cypress.Commands.add("checkAccessibility", (context?: string, options?: object) => {
    cy.injectAxe();
    cy.checkA11y(context, options);
  });
}
```

### Type Declarations

```typescript
// cypress/support/index.d.ts
/// <reference types="cypress-axe" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Inject axe-core and check accessibility
     * @param context - Optional CSS selector to scope the check
     * @param options - axe-core run options
     */
    checkAccessibility(context?: string, options?: object): Chainable<void>;
  }
}
```

---

## Pattern 2: Basic Accessibility Tests

### Page-Level Accessibility Check

```typescript
describe("Accessibility Tests", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("homepage has no accessibility violations", () => {
    cy.checkA11y();
  });

  it("login page has no accessibility violations", () => {
    cy.visit("/login");
    cy.injectAxe();
    cy.checkA11y();
  });

  it("dashboard has no accessibility violations", () => {
    cy.login("user@example.com", "password123");
    cy.visit("/dashboard");
    cy.injectAxe();
    cy.checkA11y();
  });
});
```

### Scoped Accessibility Check

```typescript
describe("Component Accessibility", () => {
  beforeEach(() => {
    cy.visit("/components");
    cy.injectAxe();
  });

  it("header has no accessibility violations", () => {
    cy.checkA11y("[data-cy=header]");
  });

  it("navigation has no accessibility violations", () => {
    cy.checkA11y("[data-cy=main-navigation]");
  });

  it("footer has no accessibility violations", () => {
    cy.checkA11y("[data-cy=footer]");
  });
});
```

---

## Pattern 3: Filtering by WCAG Level

### WCAG 2.0 Level A Only

```typescript
describe("WCAG 2.0 Level A Compliance", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("meets WCAG 2.0 Level A requirements", () => {
    cy.checkA11y(null, {
      runOnly: {
        type: "tag",
        values: ["wcag2a"],
      },
    });
  });
});
```

### WCAG 2.1 Level AA

```typescript
describe("WCAG 2.1 Level AA Compliance", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("meets WCAG 2.1 Level AA requirements", () => {
    cy.checkA11y(null, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
  });
});
```

### Filtering by Rule

```typescript
describe("Specific Accessibility Rules", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("checks only color contrast", () => {
    cy.checkA11y(null, {
      runOnly: {
        type: "rule",
        values: ["color-contrast"],
      },
    });
  });

  it("checks keyboard accessibility", () => {
    cy.checkA11y(null, {
      runOnly: {
        type: "rule",
        values: ["keyboard", "focus-order-semantics", "tabindex"],
      },
    });
  });
});
```

---

## Pattern 4: Filtering by Impact

### Critical and Serious Issues Only

```typescript
describe("High Impact Accessibility Issues", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("has no critical accessibility violations", () => {
    cy.checkA11y(null, {
      includedImpacts: ["critical"],
    });
  });

  it("has no critical or serious accessibility violations", () => {
    cy.checkA11y(null, {
      includedImpacts: ["critical", "serious"],
    });
  });
});
```

### Excluding Minor Issues

```typescript
it("has no high-impact accessibility violations", () => {
  cy.checkA11y(null, {
    // Include critical, serious, and moderate
    // Exclude minor issues
    includedImpacts: ["critical", "serious", "moderate"],
  });
});
```

---

## Pattern 5: Excluding Known Issues

### Temporarily Excluding Rules

```typescript
describe("Accessibility with Known Issues", () => {
  beforeEach(() => {
    cy.visit("/legacy-page");
    cy.injectAxe();
  });

  it("has no new accessibility violations (excluding known issues)", () => {
    cy.checkA11y(null, {
      rules: {
        // Temporarily disable rules for known issues
        "color-contrast": { enabled: false },
        "image-alt": { enabled: false },
      },
    });
  });
});
```

### Excluding Specific Elements

```typescript
it("checks accessibility excluding third-party widgets", () => {
  cy.checkA11y(null, {
    exclude: [
      "[data-cy=third-party-chat-widget]",
      "[data-cy=advertising-banner]",
      ".legacy-component",
    ],
  });
});
```

---

## Pattern 6: Custom Violation Handling

### Custom Logging

```typescript
function logAccessibilityViolations(violations: axe.Result[]) {
  violations.forEach((violation) => {
    const nodes = violation.nodes
      .map((node) => {
        return `
          HTML: ${node.html}
          Target: ${node.target.join(", ")}
          Fix: ${node.failureSummary}
        `;
      })
      .join("\n");

    cy.log(`
      Rule: ${violation.id}
      Description: ${violation.description}
      Help: ${violation.help}
      Help URL: ${violation.helpUrl}
      Impact: ${violation.impact}
      Nodes:
      ${nodes}
    `);
  });
}

describe("Custom Violation Logging", () => {
  it("logs detailed violation information", () => {
    cy.visit("/");
    cy.injectAxe();

    cy.checkA11y(null, undefined, logAccessibilityViolations, true);
  });
});
```

### Fail on Specific Violations Only

```typescript
function failOnCriticalOnly(violations: axe.Result[]) {
  const critical = violations.filter((v) => v.impact === "critical");

  if (critical.length > 0) {
    const message = critical
      .map((v) => `${v.id}: ${v.description} (${v.nodes.length} occurrences)`)
      .join("\n");

    throw new Error(`Critical accessibility violations:\n${message}`);
  }

  // Log non-critical violations without failing
  violations
    .filter((v) => v.impact !== "critical")
    .forEach((v) => {
      cy.log(`Non-critical a11y issue: ${v.id} - ${v.description}`);
    });
}

it("fails only on critical violations", () => {
  cy.visit("/");
  cy.injectAxe();

  cy.checkA11y(null, undefined, failOnCriticalOnly, true);
});
```

---

## Pattern 7: Testing Interactive States

### Testing After User Interactions

```typescript
describe("Accessibility After Interactions", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe();
  });

  it("modal is accessible when opened", () => {
    // Check page before modal
    cy.checkA11y();

    // Open modal
    cy.getBySel("open-modal-button").click();
    cy.getBySel("modal").should("be.visible");

    // Check accessibility with modal open
    cy.checkA11y();

    // Specifically check the modal
    cy.checkA11y("[data-cy=modal]");
  });

  it("dropdown menu is accessible when expanded", () => {
    cy.checkA11y("[data-cy=dropdown]");

    cy.getBySel("dropdown-trigger").click();
    cy.getBySel("dropdown-menu").should("be.visible");

    cy.checkA11y("[data-cy=dropdown]");
  });

  it("form error states are accessible", () => {
    cy.visit("/signup");
    cy.injectAxe();

    // Initial state
    cy.checkA11y("[data-cy=signup-form]");

    // Trigger validation errors
    cy.getBySel("submit-button").click();
    cy.getBySel("email-error").should("be.visible");

    // Check form with errors
    cy.checkA11y("[data-cy=signup-form]");
  });
});
```

---

## Pattern 8: Comprehensive Test Suite

### Full Application Accessibility Test

```typescript
const ROUTES_TO_TEST = [
  { path: "/", name: "Homepage" },
  { path: "/login", name: "Login Page" },
  { path: "/signup", name: "Signup Page" },
  { path: "/products", name: "Products List" },
  { path: "/contact", name: "Contact Page" },
  { path: "/about", name: "About Page" },
];

const AUTHENTICATED_ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/profile", name: "Profile" },
  { path: "/settings", name: "Settings" },
];

describe("Application-Wide Accessibility", () => {
  context("Public Pages", () => {
    ROUTES_TO_TEST.forEach(({ path, name }) => {
      it(`${name} has no accessibility violations`, () => {
        cy.visit(path);
        cy.injectAxe();
        cy.checkA11y(null, {
          includedImpacts: ["critical", "serious"],
        });
      });
    });
  });

  context("Authenticated Pages", () => {
    beforeEach(() => {
      cy.login("user@example.com", "password123");
    });

    AUTHENTICATED_ROUTES.forEach(({ path, name }) => {
      it(`${name} has no accessibility violations`, () => {
        cy.visit(path);
        cy.injectAxe();
        cy.checkA11y(null, {
          includedImpacts: ["critical", "serious"],
        });
      });
    });
  });
});
```

---

## Pattern 9: Component Accessibility Testing

### Cypress Component Test with Accessibility

```tsx
// cypress/component/button.cy.tsx
import { Button } from "../../src/components/button/button";

describe("Button Accessibility", () => {
  beforeEach(() => {
    cy.injectAxe();
  });

  it("primary button is accessible", () => {
    cy.mount(<Button label="Click me" variant="primary" />);
    cy.checkA11y();
  });

  it("disabled button is accessible", () => {
    cy.mount(<Button label="Click me" disabled />);
    cy.checkA11y();
  });

  it("button with icon is accessible", () => {
    cy.mount(
      <Button label="Add item" variant="primary">
        <svg aria-hidden="true">...</svg>
      </Button>
    );
    cy.checkA11y();
  });
});
```

---

## Pattern 10: Keyboard Navigation Testing

### Manual Keyboard Tests

```typescript
describe("Keyboard Navigation", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("can navigate menu with keyboard", () => {
    // Tab to first menu item
    cy.get("body").tab();
    cy.focused().should("have.attr", "data-cy", "nav-home");

    // Tab to next item
    cy.focused().tab();
    cy.focused().should("have.attr", "data-cy", "nav-products");

    // Enter activates link
    cy.focused().type("{enter}");
    cy.url().should("include", "/products");
  });

  it("modal traps focus", () => {
    cy.getBySel("open-modal-button").click();

    // Tab through modal elements
    cy.get("body").tab();
    cy.focused().should("have.attr", "data-cy", "modal-close-button");

    cy.focused().tab();
    cy.focused().should("have.attr", "data-cy", "modal-confirm-button");

    // Tab should wrap back to close button
    cy.focused().tab();
    cy.focused().should("have.attr", "data-cy", "modal-close-button");

    // Escape closes modal
    cy.get("body").type("{esc}");
    cy.getBySel("modal").should("not.exist");
    cy.focused().should("have.attr", "data-cy", "open-modal-button");
  });

  it("dropdown can be navigated with arrow keys", () => {
    cy.getBySel("dropdown-trigger").click();

    cy.get("body").type("{downarrow}");
    cy.focused().should("have.attr", "data-cy", "dropdown-item-1");

    cy.get("body").type("{downarrow}");
    cy.focused().should("have.attr", "data-cy", "dropdown-item-2");

    cy.get("body").type("{uparrow}");
    cy.focused().should("have.attr", "data-cy", "dropdown-item-1");
  });
});
```

**Note:** For keyboard testing, you may need `cypress-real-events` plugin for better keyboard simulation.

---

## Quick Reference: Common axe-core Rules

| Rule ID | Description | Impact |
|---------|-------------|--------|
| `color-contrast` | Text must have sufficient color contrast | serious |
| `image-alt` | Images must have alt text | critical |
| `label` | Form elements must have labels | critical |
| `button-name` | Buttons must have discernible text | critical |
| `link-name` | Links must have discernible text | serious |
| `landmark-one-main` | Document must have one main landmark | moderate |
| `region` | All content should be in landmarks | moderate |
| `heading-order` | Heading levels should only increase by one | moderate |

---

_See [core.md](core.md) for E2E patterns and [component-testing.md](component-testing.md) for component testing._
