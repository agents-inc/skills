# Accessibility Testing Patterns

> Role-based queries, jest-axe integration, and Lighthouse CI.

---

## Role-Based Accessibility Queries

### Example: Testing Library Patterns

```typescript
// Role-based queries encourage accessible markup
// These examples use Testing Library patterns - adapt to your testing framework

it('should toggle the feature', async () => {
  // Render your component

  // Query by role (encourages accessible markup)
  const feature = await screen.findByTestId('feature');
  const switchElement = within(feature).getByRole('switch');

  expect(switchElement).toBeChecked();

  // Simulate user interaction
  await userEvent.click(switchElement);
  await waitFor(() => expect(switchElement).not.toBeChecked());
});

it('should render button with accessible name', () => {
  // Render your button component

  // Query by role and accessible name
  const button = screen.getByRole('button', { name: 'Click me' });
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

## jest-axe Integration

### Example: Automated Accessibility Testing

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
