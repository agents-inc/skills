# React Testing Library - Scoped Queries Examples

> Using `within` for scoped queries. Reference from [SKILL.md](../SKILL.md).

---

## Basic within Usage

```typescript
// Good Example - Scoped queries with within
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "./dashboard";

test("navigation contains home and settings links", () => {
  render(<Dashboard />);

  // Get the navigation element
  const navigation = screen.getByRole("navigation");

  // Query only within the navigation
  expect(within(navigation).getByRole("link", { name: /home/i })).toBeInTheDocument();
  expect(within(navigation).getByRole("link", { name: /settings/i })).toBeInTheDocument();

  // These links exist in main content but NOT in navigation
  expect(within(navigation).queryByRole("link", { name: /view profile/i })).not.toBeInTheDocument();
});
```

**Why good:** Prevents accidentally matching elements in other sections of the page, makes tests more resilient to layout changes

---

## Testing Tables with within

```typescript
// Good Example - Testing table rows
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserTable } from "./user-table";

const MOCK_USERS = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

test("displays user data in correct rows", () => {
  render(<UserTable users={MOCK_USERS} />);

  const rows = screen.getAllByRole("row");
  // First row is header, data rows start at index 1
  const [, aliceRow, bobRow] = rows;

  // Verify Alice's row
  expect(within(aliceRow).getByText("Alice")).toBeInTheDocument();
  expect(within(aliceRow).getByText("alice@example.com")).toBeInTheDocument();

  // Verify Bob's row
  expect(within(bobRow).getByText("Bob")).toBeInTheDocument();
  expect(within(bobRow).getByText("bob@example.com")).toBeInTheDocument();
});

test("edit button in each row edits correct user", async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  render(<UserTable users={MOCK_USERS} onEdit={onEdit} />);

  const rows = screen.getAllByRole("row");
  const bobRow = rows[2]; // Bob is second data row

  // Click edit button in Bob's row specifically
  await user.click(within(bobRow).getByRole("button", { name: /edit/i }));

  expect(onEdit).toHaveBeenCalledWith("2"); // Bob's ID
});
```

**Why good:** Tests specific rows without ambiguity, handles tables with identical button labels per row

---

## Testing Cards or List Items

```typescript
// Good Example - Testing card components
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductList } from "./product-list";

const MOCK_PRODUCTS = [
  { id: "1", name: "Widget", price: 9.99, inStock: true },
  { id: "2", name: "Gadget", price: 19.99, inStock: false },
];

test("shows add to cart only for in-stock products", () => {
  render(<ProductList products={MOCK_PRODUCTS} />);

  // Find each product card by its heading
  const widgetCard = screen.getByRole("article", { name: /widget/i });
  const gadgetCard = screen.getByRole("article", { name: /gadget/i });

  // Widget (in stock) should have add to cart
  expect(within(widgetCard).getByRole("button", { name: /add to cart/i })).toBeInTheDocument();

  // Gadget (out of stock) should show out of stock message
  expect(within(gadgetCard).queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  expect(within(gadgetCard).getByText(/out of stock/i)).toBeInTheDocument();
});

test("adding product to cart from specific card", async () => {
  const user = userEvent.setup();
  const onAddToCart = vi.fn();
  render(<ProductList products={MOCK_PRODUCTS} onAddToCart={onAddToCart} />);

  const widgetCard = screen.getByRole("article", { name: /widget/i });
  await user.click(within(widgetCard).getByRole("button", { name: /add to cart/i }));

  expect(onAddToCart).toHaveBeenCalledWith("1"); // Widget's ID
});
```

**Why good:** Each card has identical buttons; within ensures you interact with the correct one

---

## Testing Forms within Sections

```typescript
// Good Example - Testing forms in different sections
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./checkout-page";

test("billing and shipping forms have separate inputs", async () => {
  const user = userEvent.setup();
  render(<CheckoutPage />);

  // Get each form section
  const billingSection = screen.getByRole("region", { name: /billing address/i });
  const shippingSection = screen.getByRole("region", { name: /shipping address/i });

  // Fill billing address
  await user.type(
    within(billingSection).getByLabelText(/street address/i),
    "123 Billing St"
  );

  // Fill shipping address (different input with same label)
  await user.type(
    within(shippingSection).getByLabelText(/street address/i),
    "456 Shipping Ave"
  );

  // Verify both have correct values
  expect(within(billingSection).getByLabelText(/street address/i)).toHaveValue("123 Billing St");
  expect(within(shippingSection).getByLabelText(/street address/i)).toHaveValue("456 Shipping Ave");
});
```

**Why good:** Handles identical form fields in different sections without relying on test IDs

---

## Testing Modal Content

```typescript
// Good Example - Testing modal dialogs
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

test("modal has confirm and cancel buttons", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<ConfirmDialog isOpen={true} onConfirm={onConfirm} />);

  // Get the modal dialog
  const modal = screen.getByRole("dialog");

  // Query buttons within the modal (not elsewhere on page)
  const confirmButton = within(modal).getByRole("button", { name: /confirm/i });
  const cancelButton = within(modal).getByRole("button", { name: /cancel/i });

  expect(confirmButton).toBeInTheDocument();
  expect(cancelButton).toBeInTheDocument();

  await user.click(confirmButton);
  expect(onConfirm).toHaveBeenCalled();
});
```

**Why good:** Ensures you interact with modal buttons, not buttons that might exist behind the modal

---

## Combining within with findBy (Async)

```typescript
// Good Example - Async queries within scoped element
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResults } from "./search-results";

test("search results appear in results section", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  await user.type(screen.getByRole("searchbox"), "react");
  await user.click(screen.getByRole("button", { name: /search/i }));

  // Get results container
  const resultsSection = screen.getByRole("region", { name: /results/i });

  // Wait for async results within that section
  const results = await within(resultsSection).findAllByRole("article");
  expect(results.length).toBeGreaterThan(0);
});
```

**Why good:** Combines scoped queries with async utilities for testing dynamically loaded content

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy
- [async-testing.md](async-testing.md) - Async utilities
- [accessibility.md](accessibility.md) - Accessibility testing
