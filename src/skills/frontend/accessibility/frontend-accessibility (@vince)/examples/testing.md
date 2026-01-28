# Accessibility Testing Patterns

> Role-based queries, jest-axe/vitest-axe integration, cypress-axe, and Lighthouse CI.

---

## Role-Based Accessibility Queries

### Example: Testing Library Patterns

```typescript
// Role-based queries encourage accessible markup
// These examples use Testing Library patterns - adapt to your testing framework

it("should toggle the feature", async () => {
  // Render your component

  // Query by role (encourages accessible markup)
  const feature = await screen.findByTestId("feature");
  const switchElement = within(feature).getByRole("switch");

  expect(switchElement).toBeChecked();

  // Simulate user interaction
  await userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it("should render button with accessible name", () => {
  // Render your button component

  // Query by role and accessible name
  const button = screen.getByRole("button", { name: "Click me" });
  expect(button).toBeInTheDocument();
});
```

**Why good:** Role-based queries fail if markup isn't accessible, catching issues early.

**Key accessibility query patterns:**

- `getByRole('button')` - Finds buttons by ARIA role
- `getByRole('link', { name: 'Home' })` - Finds links by accessible name
- `getByRole('textbox')` - Finds inputs by role
- `getByRole('switch')` - Finds toggle controls
- `getByLabelText('Email')` - Finds inputs by label association

---

## jest-axe Integration (Jest)

### Example: Automated Accessibility Testing with Jest

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('should have no accessibility violations', async () => {
    // Render your component and get the container element
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should have no violations with errors', async () => {
    // Test with error state
    const { container } = render(
      <LoginForm errors={{ email: 'Invalid email' }} />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
```

**Why good:** Automated testing catches common issues (missing labels, insufficient contrast, etc.).

---

## vitest-axe Integration (Vitest)

### Example: Automated Accessibility Testing with Vitest

```typescript
// vitest.setup.ts - Setup file
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);
```

```typescript
// component.test.tsx
import { axe } from 'vitest-axe';
import { render } from '@testing-library/react';

describe('LoginForm', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  // Configure for WCAG 2.2 rules
  it('should pass WCAG 2.2 AA checks', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag22aa'],
      },
    });

    expect(results).toHaveNoViolations();
  });
});
```

**Why good:** Same API as jest-axe, but compatible with Vitest. Supports WCAG 2.2 via axe-core 4.10+.

**Note:** Color contrast checks don't work in JSDOM - test manually or in E2E.

---

## cypress-axe Integration (Cypress E2E)

### Example: E2E Accessibility Testing

```typescript
// cypress/support/e2e.ts
import "cypress-axe";

// Optional: Add terminal logging
Cypress.Commands.add("logA11yViolations", (violations) => {
  cy.task("log", `${violations.length} accessibility violations found`);
  cy.task(
    "table",
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
    })),
  );
});
```

```typescript
// cypress/e2e/accessibility.cy.ts
describe("Accessibility", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.injectAxe(); // Must be called after cy.visit()
  });

  it("should have no critical violations on homepage", () => {
    cy.checkA11y(null, {
      includedImpacts: ["critical", "serious"],
    });
  });

  it("should have no violations in main content", () => {
    // Scope to specific element
    cy.checkA11y("main");
  });

  // Gradual adoption: log violations without failing
  it("should audit full page (non-blocking)", () => {
    cy.checkA11y(
      null,
      {},
      (violations) => {
        cy.logA11yViolations(violations);
      },
      true, // skipFailures = true
    );
  });

  // Test with dynamic content (retries)
  it("should check modal after opening", () => {
    cy.get('[data-testid="open-modal"]').click();
    cy.checkA11y('[role="dialog"]', {
      retries: 3,
      interval: 500,
    });
  });
});
```

**Why good:** E2E tests catch real-world issues including color contrast (which JSDOM misses).

---

## Lighthouse CI Integration

### Example: CI Configuration

```json
// .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }]
      }
    }
  }
}
```

```bash
# Run Lighthouse CI
npm install -g @lhci/cli
lhci autorun
```

**Why good:** Automated accessibility audits in CI prevent regressions.
