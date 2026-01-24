# React Testing Library - Async Testing Examples

> Async utilities: findBy, waitFor, waitForElementToBeRemoved. Reference from [SKILL.md](../SKILL.md).

---

## Using findBy for Async Content

```typescript
// Good Example - findBy for elements that appear asynchronously
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResults } from "./search-results";

const SEARCH_TERM = "react";
const NO_RESULTS_TEXT = /no results found/i;
const LOADING_TEXT = /searching/i;

test("displays search results after API call", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  // Type search query
  await user.type(screen.getByRole("searchbox"), SEARCH_TERM);
  await user.click(screen.getByRole("button", { name: /search/i }));

  // Loading state appears immediately
  expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument();

  // Results appear asynchronously - use findBy
  const results = await screen.findAllByRole("listitem");
  expect(results.length).toBeGreaterThan(0);

  // Loading state should be gone
  expect(screen.queryByText(LOADING_TEXT)).not.toBeInTheDocument();
});

test("displays no results message", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  await user.type(screen.getByRole("searchbox"), "xyznonexistent");
  await user.click(screen.getByRole("button", { name: /search/i }));

  // findBy with custom timeout if needed
  const noResults = await screen.findByText(NO_RESULTS_TEXT, {}, { timeout: 3000 });
  expect(noResults).toBeInTheDocument();
});
```

**Why good:** Uses findBy for elements that appear after async operations, uses queryBy to verify elements are gone (returns null vs throwing), specifies timeout when default 1000ms isn't enough

---

## Using waitFor Correctly

```typescript
// Good Example - waitFor for assertions (not element queries)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "./counter";

const INITIAL_COUNT = 0;
const DEBOUNCE_DELAY_MS = 500;

test("counter updates after debounce", async () => {
  const user = userEvent.setup();
  render(<Counter initialCount={INITIAL_COUNT} />);

  // Click increment multiple times quickly
  await user.click(screen.getByRole("button", { name: /increment/i }));
  await user.click(screen.getByRole("button", { name: /increment/i }));
  await user.click(screen.getByRole("button", { name: /increment/i }));

  // GOOD: Single assertion in waitFor
  await waitFor(() => {
    expect(screen.getByText(/count: 3/i)).toBeInTheDocument();
  });
});

test("form validation shows errors", async () => {
  const user = userEvent.setup();
  render(<RegistrationForm />);

  // Submit empty form
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // GOOD: Separate waitFor for each assertion
  await waitFor(() => {
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });
});
```

**Why good:** Uses waitFor for assertions, not element queries. Keeps single assertion per waitFor for faster failure feedback.

---

## Common waitFor Mistakes

```typescript
// Bad Example - Incorrect waitFor usage
test("form shows errors", async () => {
  render(<RegistrationForm />);

  // BAD: Using waitFor to find elements (use findBy instead)
  await waitFor(() => {
    screen.getByRole("button"); // DON'T - use findByRole
  });

  // BAD: Multiple assertions in single waitFor
  await waitFor(() => {
    expect(screen.getByText(/email required/i)).toBeInTheDocument();
    expect(screen.getByText(/password required/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // BAD: Side effects inside waitFor
  await waitFor(() => {
    fireEvent.click(button); // DON'T - side effects outside
    expect(result).toBe(true);
  });

  // BAD: Empty waitFor for timing
  await waitFor(() => {}); // DON'T - fragile timing
});
```

**Why bad:** Using waitFor for element queries produces worse error messages than findBy. Multiple assertions cause slow failures. Side effects in waitFor execute unpredictably.

---

## waitForElementToBeRemoved

```typescript
// Good Example - Waiting for elements to disappear
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

test("modal closes when clicking dismiss", async () => {
  const user = userEvent.setup();
  render(<Modal isOpen={true} />);

  // Verify modal is visible
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  // Close modal
  await user.click(screen.getByRole("button", { name: /close/i }));

  // Wait for modal to be removed
  await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

  // Verify it's gone
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("loading spinner disappears after data loads", async () => {
  render(<DataFetcher />);

  // Loading spinner present initially
  const spinner = screen.getByRole("progressbar");

  // Wait for it to be removed
  await waitForElementToBeRemoved(spinner);

  // Data should now be visible
  expect(screen.getByText(/data loaded/i)).toBeInTheDocument();
});
```

**Why good:** Uses waitForElementToBeRemoved for disappearance (not polling with queryBy). Uses queryBy in callback (returns null instead of throwing).

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy
- [user-events.md](user-events.md) - User interactions
- [custom-render.md](custom-render.md) - Custom render setup
