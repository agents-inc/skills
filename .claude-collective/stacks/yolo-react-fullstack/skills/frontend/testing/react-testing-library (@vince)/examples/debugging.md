# React Testing Library - Debugging Examples

> Debug utilities and snapshot testing guidance. Reference from [SKILL.md](../SKILL.md).

---

## Using screen.debug()

> **Note:** Debug utilities are for development/debugging only. Remove debug calls before committing tests.

```typescript
// Example - Debugging with screen.debug
import { render, screen } from "@testing-library/react";
import { ComplexForm } from "./complex-form";

test("debugging form structure", () => {
  render(<ComplexForm />);

  // Debug entire document
  screen.debug();

  // Debug specific element
  const form = screen.getByRole("form");
  screen.debug(form);

  // Debug multiple elements
  const inputs = screen.getAllByRole("textbox");
  screen.debug(inputs);

  // Your actual test assertions
  expect(form).toBeInTheDocument();
});
```

**When to use:** Temporarily during test development to understand DOM structure. Remove before committing.

---

## Using prettyDOM

```typescript
// Example - Custom DOM output with prettyDOM
import { render, screen, prettyDOM } from "@testing-library/react";
import { DataTable } from "./data-table";

const MAX_LENGTH = 15000; // Increase from default 7000

test("debugging large components", () => {
  render(<DataTable rows={mockData} />);

  const table = screen.getByRole("table");

  // Get formatted string for custom logging
  const domString = prettyDOM(table, MAX_LENGTH);
  console.log(domString);

  // Or use in assertions
  expect(domString).toContain("Expected Content");
});
```

**When to use:** When screen.debug truncates output, or when you need the DOM string for custom processing.

---

## Using logRoles

```typescript
// Example - Discovering available roles
import { render, logRoles } from "@testing-library/react";
import { Navigation } from "./navigation";

test("discovering accessible roles", () => {
  const { container } = render(<Navigation />);

  // Log all accessible roles in the rendered component
  logRoles(container);

  // Output shows all elements with their ARIA roles:
  // navigation:
  //   <nav />
  // list:
  //   <ul />
  // listitem:
  //   <li />
  //   <li />
  // link:
  //   <a href="/home" />
  //   <a href="/about" />
});
```

**When to use:** When you're unsure what role to use in getByRole queries. Shows all available roles in the DOM.

---

## Using logTestingPlaygroundURL

```typescript
// Example - Getting query suggestions
import { render, screen, logTestingPlaygroundURL } from "@testing-library/react";
import { LoginForm } from "./login-form";

test("getting suggested queries", () => {
  render(<LoginForm />);

  // Logs a URL to Testing Playground
  logTestingPlaygroundURL();

  // Visit the URL to:
  // 1. See the rendered DOM
  // 2. Click on elements to get suggested queries
  // 3. Copy the best query for your test

  // Then write your actual test
  expect(screen.getByRole("form")).toBeInTheDocument();
});
```

**When to use:** When struggling to find the right query. The Testing Playground suggests the best accessible query for any element.

---

## Snapshot Testing Considerations

### When Snapshots Are Appropriate

```typescript
// Example - Appropriate snapshot usage
import { render } from "@testing-library/react";
import { Icon } from "./icon";

// ACCEPTABLE: Simple, stable component with known output
test("icon renders correctly", () => {
  const { container } = render(<Icon name="check" size="md" />);
  expect(container.firstChild).toMatchSnapshot();
});

// ACCEPTABLE: Testing component structure rarely changes
test("breadcrumb structure", () => {
  const { container } = render(
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Products" }]} />
  );
  expect(container).toMatchSnapshot();
});
```

**When snapshots work:** Simple components, stable output, structure verification

---

### When NOT to Use Snapshots

```typescript
// Example - When NOT to use snapshots
// BAD: Dynamic content that changes frequently
test("user list", () => {
  render(<UserList users={mockUsers} />);
  // DON'T snapshot - user data changes, timestamps, etc.
});

// BAD: Large components with many children
test("dashboard", () => {
  render(<Dashboard />);
  // DON'T snapshot - too much noise, hard to review changes
});

// BETTER: Targeted assertions
test("dashboard shows user count", () => {
  render(<Dashboard users={mockUsers} />);
  expect(screen.getByText(/5 active users/i)).toBeInTheDocument();
});
```

**Why avoid large snapshots:** Hard to review changes, prone to false positives, don't communicate intent. Prefer targeted assertions that document expected behavior.

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy
- [async-testing.md](async-testing.md) - Async utilities
