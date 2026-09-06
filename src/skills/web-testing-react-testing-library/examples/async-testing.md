# React Testing Library - Async Testing Examples

> `findBy*`, `waitFor` and `waitForElementToBeRemoved`. See [core.md](core.md) for queries and [configuration.md](configuration.md) for fake timers.

---

## findBy for content that arrives

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResults } from "./search-results";

test("displays search results", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  await user.type(screen.getByRole("searchbox"), "react");
  await user.click(screen.getByRole("button", { name: /search/i }));

  expect(screen.getByText(/searching/i)).toBeInTheDocument(); // present synchronously

  const results = await screen.findAllByRole("listitem"); // arrives later
  expect(results.length).toBeGreaterThan(0);

  expect(screen.queryByText(/searching/i)).not.toBeInTheDocument(); // queryBy for absence
});

test("raises the timeout for a slow path", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  await user.type(screen.getByRole("searchbox"), "xyznonexistent");
  await user.click(screen.getByRole("button", { name: /search/i }));

  // Third argument, not second - the second is the query's own options
  expect(await screen.findByText(/no results found/i, {}, { timeout: 3000 })).toBeInTheDocument();
});
```

**Why good:** the three variants are used for the three jobs they exist for — `getBy` for what is already there, `findBy` for what will be, `queryBy` for what should not be. Mixing them up is the commonest source of both flakes and misleading failure messages.

---

## waitFor, for assertions rather than elements

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("counter settles after debounce", async () => {
  const user = userEvent.setup();
  render(<Counter initialCount={0} />);

  await user.click(screen.getByRole("button", { name: /increment/i }));
  await user.click(screen.getByRole("button", { name: /increment/i }));
  await user.click(screen.getByRole("button", { name: /increment/i }));

  await waitFor(() => {
    expect(screen.getByText(/count: 3/i)).toBeInTheDocument();
  });
});

test("shows both validation errors", async () => {
  const user = userEvent.setup();
  render(<RegistrationForm />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  // One assertion per waitFor, so the first failure reports immediately
  await waitFor(() => {
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });
});
```

---

## The four waitFor mistakes

```typescript
// Bad Example
test("form shows errors", async () => {
  render(<RegistrationForm />);

  // 1. Finding an element - findByRole does this with a better failure message
  await waitFor(() => {
    screen.getByRole("button");
  });

  // 2. Several assertions - each retry re-runs all of them before any failure surfaces
  await waitFor(() => {
    expect(screen.getByText(/email required/i)).toBeInTheDocument();
    expect(screen.getByText(/password required/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // 3. A side effect - the callback runs on every poll, so this clicks repeatedly
  await waitFor(() => {
    fireEvent.click(button);
    expect(result).toBe(true);
  });

  // 4. An empty callback - waits one poll interval and asserts nothing
  await waitFor(() => {});
});
```

**Why bad:** `waitFor` retries its callback until it stops throwing. Everything above misuses that loop — as a query, as a batch, as a driver, or as a sleep — and each one either slows failure down or makes the result depend on timing.

---

## waitForElementToBeRemoved

```typescript
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

test("modal closes on dismiss", async () => {
  const user = userEvent.setup();
  render(<Modal isOpen />);

  expect(screen.getByRole("dialog")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /close/i }));

  // Callback form: queryBy, because getBy would throw the moment it succeeds
  await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
});

test("spinner disappears once data loads", async () => {
  render(<DataFetcher />);

  // Element form: the node must already be present, or this throws immediately
  await waitForElementToBeRemoved(screen.getByRole("progressbar"));

  expect(screen.getByText(/data loaded/i)).toBeInTheDocument();
});
```

**Why good:** the two forms differ in a way that bites. Passed an element, the helper requires it to exist at the call; passed a callback, it re-runs the query, which is why the callback must be a `queryBy*` that can return `null`.

---

_Next: [custom-render.md](custom-render.md) for provider setup._
