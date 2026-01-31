# React Testing Library - Core Query Examples

> Essential query patterns and hierarchy. Reference from [SKILL.md](../SKILL.md).

---

## Query Hierarchy

### Using getByRole (Priority 1 - Best)

```typescript
// Good Example - Role-based queries with accessible names
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

const SUBMIT_BUTTON_NAME = /sign in/i;
const EMAIL_INPUT_NAME = /email address/i;
const PASSWORD_INPUT_NAME = /password/i;
const REMEMBER_ME_NAME = /remember me/i;

test("renders login form with accessible elements", () => {
  render(<LoginForm />);

  // Buttons - most common role query
  expect(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME })).toBeInTheDocument();

  // Text inputs - use textbox role
  expect(screen.getByRole("textbox", { name: EMAIL_INPUT_NAME })).toBeInTheDocument();

  // Password inputs don't have textbox role - use getByLabelText
  expect(screen.getByLabelText(PASSWORD_INPUT_NAME)).toBeInTheDocument();

  // Checkboxes
  expect(screen.getByRole("checkbox", { name: REMEMBER_ME_NAME })).toBeInTheDocument();

  // Links
  expect(screen.getByRole("link", { name: /forgot password/i })).toBeInTheDocument();

  // Headings with level
  expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument();
});
```

**Why good:** Uses accessible queries that match how screen readers and assistive technology navigate the page, tests that UI is accessible while verifying functionality, uses named constants for consistent test data

---

### Using getByLabelText (Priority 1 - Forms)

```typescript
// Good Example - Form fields by label
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "./contact-form";

const EMAIL_LABEL = /email/i;
const MESSAGE_LABEL = /message/i;
const PHONE_LABEL = /phone number/i;

test("fills out contact form", async () => {
  const user = userEvent.setup();
  render(<ContactForm />);

  // Input by associated label
  const emailInput = screen.getByLabelText(EMAIL_LABEL);
  await user.type(emailInput, "test@example.com");

  // Textarea by label
  const messageInput = screen.getByLabelText(MESSAGE_LABEL);
  await user.type(messageInput, "Hello, this is my message");

  // Input with placeholder (less ideal but sometimes needed)
  const phoneInput = screen.getByLabelText(PHONE_LABEL);
  await user.type(phoneInput, "555-1234");

  expect(emailInput).toHaveValue("test@example.com");
  expect(messageInput).toHaveValue("Hello, this is my message");
});
```

**Why good:** Tests form fields the way users with screen readers navigate them (by label), verifies label-input associations are correct, uses userEvent.setup() before interactions

---

### Using getByText and getByTestId

```typescript
// Good Example - Text content and test IDs appropriately
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./product-card";

const PRODUCT_NAME = "Wireless Headphones";
const PRODUCT_PRICE = "$99.99";

test("renders product information", () => {
  render(<ProductCard name={PRODUCT_NAME} price={PRODUCT_PRICE} />);

  // Use getByText for non-interactive content
  expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
  expect(screen.getByText(PRODUCT_PRICE)).toBeInTheDocument();

  // Use getByRole for interactive elements
  expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
});

// Example where getByTestId is acceptable
test("renders dynamic content with test ID", () => {
  const dynamicId = "abc123";
  render(<ProductCard id={dynamicId} name={PRODUCT_NAME} price={PRODUCT_PRICE} />);

  // Test ID acceptable for dynamic/generated content
  expect(screen.getByTestId(`product-${dynamicId}`)).toBeInTheDocument();
});
```

**Why good:** Uses getByText for static content, getByRole for interactive elements, reserves getByTestId for truly dynamic content where no accessible query works

```typescript
// Bad Example - Using test IDs when accessible queries work
test("renders product card", () => {
  render(<ProductCard name="Headphones" price="$99" />);

  // BAD: Using test IDs for everything
  expect(screen.getByTestId("product-name")).toBeInTheDocument();
  expect(screen.getByTestId("product-price")).toBeInTheDocument();
  expect(screen.getByTestId("add-to-cart-button")).toBeInTheDocument();
});
```

**Why bad:** Test IDs don't reflect how users interact with the UI, doesn't verify accessibility, harder to maintain when DOM structure changes

---

_For more patterns, see:_

- [user-events.md](user-events.md) - User interaction patterns
- [async-testing.md](async-testing.md) - Async utilities
- [custom-render.md](custom-render.md) - Custom render setup
