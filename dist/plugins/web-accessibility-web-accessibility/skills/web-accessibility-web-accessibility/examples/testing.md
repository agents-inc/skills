# Accessibility Testing Patterns

> axe-core integration, role-based queries, and CI accessibility audits.

---

## Role-Based Queries

### Example: Query by ARIA Role

Role-based queries encourage accessible markup - if a component can't be found by role, it's likely missing ARIA attributes.

```typescript
// These patterns work with any testing library that supports role queries

it("should toggle the feature", async () => {
  // Query by role (encourages accessible markup)
  const feature = await screen.findByTestId("feature");
  const switchElement = within(feature).getByRole("switch");

  expect(switchElement).toBeChecked();

  await userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it("should render button with accessible name", () => {
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

## axe-core Integration

### Example: Automated Accessibility Testing

Use axe-core to run automated WCAG checks against rendered components. Available as `jest-axe`, `vitest-axe`, or `cypress-axe` depending on your test runner.

```typescript
// Unit/component test pattern (adapt imports to your test runner)
import { axe, toHaveNoViolations } from 'jest-axe'; // or vitest-axe

expect.extend(toHaveNoViolations);

describe('LoginForm', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should have no violations with error state', async () => {
    const { container } = render(
      <LoginForm errors={{ email: 'Invalid email' }} />
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  // Target specific WCAG versions
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

**Why good:** Automated testing catches common issues (missing labels, insufficient contrast, etc.).

**Limitations:** axe-core finds ~57% of WCAG issues automatically. Color contrast checks don't work in JSDOM - test those manually or in E2E tests.

---

## E2E Accessibility Testing

### Example: axe-core in E2E Tests

```typescript
// E2E test pattern - inject axe-core into real browser
describe("Accessibility", () => {
  beforeEach(() => {
    // Visit page and inject axe-core
  });

  it("should have no critical violations on homepage", () => {
    // Check with severity filter
    checkA11y(null, {
      includedImpacts: ["critical", "serious"],
    });
  });

  it("should have no violations in main content", () => {
    // Scope to specific element
    checkA11y("main");
  });

  // Gradual adoption: log violations without failing
  it("should audit full page (non-blocking)", () => {
    checkA11y(null, {}, (violations) => {
      logViolations(violations); // Log but don't fail
    });
  });
});
```

**Why good:** E2E tests catch real-world issues including color contrast (which JSDOM misses).

---

## CI Accessibility Audits

### Example: Lighthouse CI Configuration

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

**Why good:** Automated accessibility audits in CI prevent regressions.
