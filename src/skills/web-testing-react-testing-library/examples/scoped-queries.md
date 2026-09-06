# React Testing Library - Scoped Query Examples

> `within()` for tables, cards, sections and modals. See [core.md](core.md) for the queries being scoped.

> `fn()` below stands for your test runner's mock-function factory.

---

## Scoping to a region

```typescript
import { render, screen, within } from "@testing-library/react";
import { Dashboard } from "./dashboard";

test("navigation contains only its own links", () => {
  render(<Dashboard />);

  const navigation = screen.getByRole("navigation");

  expect(within(navigation).getByRole("link", { name: /home/i })).toBeInTheDocument();
  expect(within(navigation).getByRole("link", { name: /settings/i })).toBeInTheDocument();

  // Present in the main content, and correctly absent from the nav
  expect(within(navigation).queryByRole("link", { name: /view profile/i })).not.toBeInTheDocument();
});
```

**Why good:** the negative assertion is only meaningful because it is scoped — unscoped it would fail, since the link does exist on the page.

---

## Table rows

```typescript
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserTable } from "./user-table";

const USERS = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

test("each row holds its own user's data", () => {
  render(<UserTable users={USERS} />);

  const [, aliceRow, bobRow] = screen.getAllByRole("row"); // index 0 is the header

  expect(within(aliceRow).getByText("alice@example.com")).toBeInTheDocument();
  expect(within(bobRow).getByText("bob@example.com")).toBeInTheDocument();
});

test("the edit button in a row edits that row's user", async () => {
  const user = userEvent.setup();
  const onEdit = fn();
  render(<UserTable users={USERS} onEdit={onEdit} />);

  const bobRow = screen.getAllByRole("row")[2];
  await user.click(within(bobRow).getByRole("button", { name: /edit/i }));

  expect(onEdit).toHaveBeenCalledWith("2");
});
```

**Why good:** every row has a button named "Edit", so an unscoped `getByRole` throws on the ambiguity and `getAllByRole(...)[1]` would silently depend on DOM order. Scoping to the row makes the intent — _this_ user's button — explicit.

---

## Cards and list items

```typescript
import { render, screen, within } from "@testing-library/react";
import { ProductList } from "./product-list";

const PRODUCTS = [
  { id: "1", name: "Widget", price: 9.99, inStock: true },
  { id: "2", name: "Gadget", price: 19.99, inStock: false },
];

test("only in-stock products offer add to cart", () => {
  render(<ProductList products={PRODUCTS} />);

  const widget = screen.getByRole("article", { name: /widget/i });
  const gadget = screen.getByRole("article", { name: /gadget/i });

  expect(within(widget).getByRole("button", { name: /add to cart/i })).toBeInTheDocument();

  expect(within(gadget).queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  expect(within(gadget).getByText(/out of stock/i)).toBeInTheDocument();
});
```

**Why good:** the cards are found by their accessible names — `aria-label` or a heading referenced by `aria-labelledby` — rather than by index, so reordering the list does not silently repoint the assertions.

---

## Repeated form sections

```typescript
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./checkout-page";

test("billing and shipping addresses are independent", async () => {
  const user = userEvent.setup();
  render(<CheckoutPage />);

  const billing = screen.getByRole("region", { name: /billing address/i });
  const shipping = screen.getByRole("region", { name: /shipping address/i });

  await user.type(within(billing).getByLabelText(/street address/i), "123 Billing St");
  await user.type(within(shipping).getByLabelText(/street address/i), "456 Shipping Ave");

  expect(within(billing).getByLabelText(/street address/i)).toHaveValue("123 Billing St");
  expect(within(shipping).getByLabelText(/street address/i)).toHaveValue("456 Shipping Ave");
});
```

**Why good:** two fields labelled "Street address" is correct markup, not a defect to work around with test ids. Scoping to the labelled region handles it and keeps the accessible names honest.

---

## Modals, and async within a scope

```typescript
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";
import { SearchResults } from "./search-results";

test("confirm and cancel come from the dialog, not the page behind it", async () => {
  const user = userEvent.setup();
  const onConfirm = fn();
  render(<ConfirmDialog isOpen onConfirm={onConfirm} />);

  const modal = screen.getByRole("dialog");

  await user.click(within(modal).getByRole("button", { name: /confirm/i }));

  expect(onConfirm).toHaveBeenCalled();
});

test("results land inside the results region", async () => {
  const user = userEvent.setup();
  render(<SearchResults />);

  await user.type(screen.getByRole("searchbox"), "react");
  await user.click(screen.getByRole("button", { name: /search/i }));

  const region = screen.getByRole("region", { name: /results/i });

  // within() returns the async queries too
  const results = await within(region).findAllByRole("article");
  expect(results.length).toBeGreaterThan(0);
});
```

**Why good:** the second test asserts _where_ the results rendered, not merely that they exist — a distinction that matters when a portal or an error boundary can put content somewhere unexpected.

---

_Next: [configuration.md](configuration.md) for the setup options that change behaviour._
