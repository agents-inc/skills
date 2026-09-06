# React Testing Library - Core Query Examples

> Query hierarchy and how to choose between role, label, text and test id. See [user-events.md](user-events.md) for interaction, [async-testing.md](async-testing.md) for elements that arrive later, and [custom-render.md](custom-render.md) for provider setup.

> `test`, `describe` and `expect` come from whatever test runner executes these files; DOM matchers such as `toBeInTheDocument` come from the Testing Library matcher package registered in the runner's setup file.

---

## getByRole — the first query to try

```typescript
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

test("renders login form with accessible elements", () => {
  render(<LoginForm />);

  expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /email address/i })).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /remember me/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /forgot password/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument();

  // A password input has no textbox role - reach it by its label
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});
```

**Why good:** every assertion goes through the accessibility tree, so a passing test is also evidence that assistive technology can reach the form. The `name` option matches the element's accessible name, which is what a screen reader announces.

---

## getByLabelText — form fields

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";

test("fills out contact form", async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  const email = screen.getByLabelText(/email/i);
  const message = screen.getByLabelText(/message/i);

  await user.type(email, "test@example.com");
  await user.type(message, "Hello, this is my message");

  expect(email).toHaveValue("test@example.com");
  expect(message).toHaveValue("Hello, this is my message");
});
```

**Why good:** finding a field by its label proves the `label`/`for`/`aria-labelledby` wiring is correct — the same wiring a screen-reader user depends on to know what they are typing into.

---

## getByText and getByTestId

```typescript
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./product-card";

test("renders product information", () => {
  render(<ProductCard name="Wireless Headphones" price="$99.99" />);

  // Text for static content
  expect(screen.getByText("Wireless Headphones")).toBeInTheDocument();
  expect(screen.getByText("$99.99")).toBeInTheDocument();

  // Role for anything interactive
  expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
});

test("locates a card by a server-generated id", () => {
  const dynamicId = "abc123";
  render(<ProductCard id={dynamicId} name="Wireless Headphones" price="$99.99" />);

  // Acceptable: the id is generated, so no stable accessible name exists
  expect(screen.getByTestId(`product-${dynamicId}`)).toBeInTheDocument();
});
```

```typescript
// Bad Example - test ids where accessible queries work
test("renders product card", () => {
  render(<ProductCard name="Headphones" price="$99" />);

  expect(screen.getByTestId("product-name")).toBeInTheDocument();
  expect(screen.getByTestId("product-price")).toBeInTheDocument();
  expect(screen.getByTestId("add-to-cart-button")).toBeInTheDocument();
});
```

**Why bad:** the test passes whether or not the button is reachable by keyboard, has an accessible name, or is even a `button`. The three assertions prove that three attributes exist in the markup and nothing about the product card working.

---

_Next: [user-events.md](user-events.md) for interaction, [async-testing.md](async-testing.md) for async content._
