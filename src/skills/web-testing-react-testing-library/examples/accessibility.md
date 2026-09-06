# React Testing Library - Accessibility Testing Examples

> Keyboard navigation, ARIA state, live regions and focus management. See [core.md](core.md) for the query hierarchy these build on.

> `fn()` below stands for your test runner's mock-function factory.

---

## Error messages that reach assistive technology

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessibleForm } from "./accessible-form";

test("errors are announced and associated with their field", async () => {
  const user = userEvent.setup();
  render(<AccessibleForm />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Announced: the error carries role="alert" or lives in an aria-live region
  expect(await screen.findAllByRole("alert")).not.toHaveLength(0);

  // Associated: aria-describedby points at it, so the field announces its own error
  expect(screen.getByLabelText(/email/i)).toHaveAccessibleDescription(/this field is required/i);
});

test("focus moves to the first invalid field", async () => {
  const user = userEvent.setup();
  render(<AccessibleForm />);

  await user.type(screen.getByLabelText(/email/i), "invalid-email");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(screen.getByLabelText(/email/i)).toHaveFocus();
});
```

**Why good:** each assertion covers a different failure. A visible error nobody announces, an announced error nobody attributes to a field, and a correct error a keyboard user has to hunt for are three separate defects, and only the third is visible in a screenshot.

---

## Keyboard navigation

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./dropdown";

test("dropdown is operable from the keyboard alone", async () => {
  const user = userEvent.setup();
  const onSelect = fn();
  render(<Dropdown options={["Apple", "Banana", "Cherry"]} onSelect={onSelect} />);

  await user.tab();
  expect(screen.getByRole("combobox")).toHaveFocus();

  await user.keyboard("{Enter}");
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("option", { name: /apple/i })).toHaveAttribute("aria-selected", "true");

  await user.keyboard("{ArrowDown}{Enter}");
  expect(onSelect).toHaveBeenCalledWith("Banana");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("escape closes and returns focus", async () => {
  const user = userEvent.setup();
  render(<Dropdown options={["Apple", "Banana"]} />);

  await user.click(screen.getByRole("combobox"));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveFocus(); // focus must not be lost to the body
});
```

**Why good:** the whole interaction runs without a single click, which is the definition of keyboard-operable. Asserting where focus lands after close catches the common bug of focus falling to `document.body` when the active element unmounts.

---

## ARIA state that changes

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "./accordion";
import { Tabs, Tab } from "./tabs";

test("accordion state and association", async () => {
  const user = userEvent.setup();
  render(
    <Accordion>
      <Accordion.Item title="Section 1">Content 1</Accordion.Item>
      <Accordion.Item title="Section 2">Content 2</Accordion.Item>
    </Accordion>,
  );

  const trigger = screen.getByRole("button", { name: /section 1/i });
  const panel = screen.getByRole("region", { name: /section 1/i });

  expect(trigger).toHaveAttribute("aria-expanded", "false");

  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");

  // The trigger must point at the panel it controls, by id
  expect(trigger).toHaveAttribute("aria-controls", panel.id);
});

test("tabs move selection together", async () => {
  const user = userEvent.setup();
  render(
    <Tabs>
      <Tab label="Tab 1">Content 1</Tab>
      <Tab label="Tab 2">Content 2</Tab>
    </Tabs>,
  );

  const tabs = screen.getAllByRole("tab");
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");

  await user.click(tabs[1]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  expect(tabs[1]).toHaveAttribute("aria-selected", "true");
});
```

**Why good:** asserting both ends of a state change catches the widget that sets the new selection without clearing the old one — a defect that looks correct on screen because CSS keys off something else.

---

## Live regions

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationToast } from "./notification-toast";
import { FormWithErrors } from "./form-with-errors";

test("a save confirmation is announced", async () => {
  const user = userEvent.setup();
  render(<NotificationToast />);

  await user.click(screen.getByRole("button", { name: /save/i }));

  const status = await screen.findByRole("status"); // aria-live="polite"
  expect(status).toHaveTextContent(/saved successfully/i);
});

test("a form error interrupts", async () => {
  const user = userEvent.setup();
  render(<FormWithErrors />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  const alert = await screen.findByRole("alert"); // aria-live="assertive"
  expect(alert).toBeInTheDocument();
});
```

**Why the two roles differ:** `status` queues behind whatever is being read; `alert` interrupts it. Using `alert` for a routine confirmation makes an application that talks over its user, and `status` for a submission failure means the failure is announced after the user has moved on.

---

## Focus trapping and restoration

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";
import { PageWithModal } from "./page-with-modal";

test("modal traps focus", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Outside Button</button>
      <Modal isOpen>
        <button>First</button>
        <button>Second</button>
        <button>Close</button>
      </Modal>
    </>,
  );

  expect(screen.getByRole("button", { name: /first/i })).toHaveFocus();

  await user.tab();
  await user.tab();
  expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();

  await user.tab(); // wraps rather than escaping to "Outside Button"
  expect(screen.getByRole("button", { name: /first/i })).toHaveFocus();

  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
});

test("focus returns to the trigger on close", async () => {
  const user = userEvent.setup();
  render(<PageWithModal />); // owns its own open/closed state

  const trigger = screen.getByRole("button", { name: /open modal/i });
  await user.click(trigger);

  await user.click(screen.getByRole("button", { name: /close/i }));

  expect(trigger).toHaveFocus();
});
```

**Why good:** the wrap assertion is the trap — without it the test passes for a modal that lets `Tab` walk out into the page behind it. Driving open and close through a component that holds its own state, rather than through `rerender`, keeps the focus restoration under test rather than under the test's control.

---

_Next: [scoped-queries.md](scoped-queries.md) for repeated structures._
