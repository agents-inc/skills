# React Testing Library - Accessibility Testing Examples

> Complete accessibility testing patterns. Reference from [SKILL.md](../SKILL.md).

---

## Testing Form Accessibility

```typescript
// Good Example - Testing accessible forms
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessibleForm } from "./accessible-form";

const EMAIL_ERROR = /please enter a valid email/i;
const REQUIRED_ERROR = /this field is required/i;

test("form has accessible labels", () => {
  render(<AccessibleForm />);

  // Inputs should be findable by label
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

  // Submit button should have accessible name
  expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
});

test("error messages are accessible", async () => {
  const user = userEvent.setup();
  render(<AccessibleForm />);

  // Submit empty form
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Error should be announced (role="alert" or aria-live)
  const errors = screen.getAllByRole("alert");
  expect(errors.length).toBeGreaterThan(0);

  // Error should be associated with input (aria-describedby)
  const emailInput = screen.getByLabelText(/email/i);
  expect(emailInput).toHaveAccessibleDescription(REQUIRED_ERROR);
});

test("focus moves to first error on validation", async () => {
  const user = userEvent.setup();
  render(<AccessibleForm />);

  // Fill email but not password
  await user.type(screen.getByLabelText(/email/i), "invalid-email");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Focus should be on the first invalid field
  expect(screen.getByLabelText(/email/i)).toHaveFocus();
});
```

**Why good:** Tests that forms are navigable by label, errors are announced to screen readers, focus management works correctly

---

## Testing Keyboard Navigation

```typescript
// Good Example - Testing keyboard accessibility
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./dropdown";

test("dropdown is keyboard navigable", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<Dropdown options={["Apple", "Banana", "Cherry"]} onSelect={onSelect} />);

  const button = screen.getByRole("combobox");

  // Tab to focus
  await user.tab();
  expect(button).toHaveFocus();

  // Enter opens dropdown
  await user.keyboard("{Enter}");
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  // Arrow keys navigate options
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("option", { name: /apple/i })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("option", { name: /banana/i })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  // Enter selects
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith("Banana");

  // Dropdown should close
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("escape closes dropdown", async () => {
  const user = userEvent.setup();
  render(<Dropdown options={["Apple", "Banana"]} />);

  // Open dropdown
  await user.click(screen.getByRole("combobox"));
  expect(screen.getByRole("listbox")).toBeInTheDocument();

  // Escape closes it
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

  // Focus returns to button
  expect(screen.getByRole("combobox")).toHaveFocus();
});
```

**Why good:** Tests complete keyboard interaction pattern, verifies ARIA attributes update correctly, tests focus management

---

## Testing ARIA Attributes

```typescript
// Good Example - Testing dynamic ARIA attributes
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Accordion } from "./accordion";

test("accordion has correct ARIA attributes", async () => {
  const user = userEvent.setup();
  render(
    <Accordion>
      <Accordion.Item title="Section 1">Content 1</Accordion.Item>
      <Accordion.Item title="Section 2">Content 2</Accordion.Item>
    </Accordion>
  );

  const trigger = screen.getByRole("button", { name: /section 1/i });
  const panel = screen.getByRole("region", { name: /section 1/i });

  // Initial state - collapsed
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(panel).toHaveAttribute("aria-hidden", "true");

  // Expand
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(panel).toHaveAttribute("aria-hidden", "false");

  // Verify association
  expect(trigger).toHaveAttribute("aria-controls", panel.id);
});

test("tabs have correct ARIA roles", async () => {
  const user = userEvent.setup();
  render(
    <Tabs>
      <Tab label="Tab 1">Content 1</Tab>
      <Tab label="Tab 2">Content 2</Tab>
    </Tabs>
  );

  const tablist = screen.getByRole("tablist");
  const tabs = screen.getAllByRole("tab");
  const tabpanels = screen.getAllByRole("tabpanel");

  // Verify structure
  expect(tablist).toBeInTheDocument();
  expect(tabs).toHaveLength(2);

  // First tab is selected
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(tabs[1]).toHaveAttribute("aria-selected", "false");

  // Tab controls panel
  expect(tabs[0]).toHaveAttribute("aria-controls", tabpanels[0].id);

  // Switch tabs
  await user.click(tabs[1]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  expect(tabs[1]).toHaveAttribute("aria-selected", "true");
});
```

**Why good:** Tests that ARIA attributes are correctly set and update with user interaction

---

## Testing Screen Reader Announcements

```typescript
// Good Example - Testing live regions
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationToast } from "./notification-toast";

test("notifications are announced to screen readers", async () => {
  const user = userEvent.setup();
  render(<NotificationToast />);

  // Trigger notification
  await user.click(screen.getByRole("button", { name: /save/i }));

  // Notification should have live region role
  const notification = await screen.findByRole("status");
  expect(notification).toBeInTheDocument();
  expect(notification).toHaveTextContent(/saved successfully/i);
});

test("error announcements are assertive", async () => {
  const user = userEvent.setup();
  render(<FormWithErrors />);

  // Submit invalid form
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Error should use assertive live region
  const errorRegion = await screen.findByRole("alert");
  expect(errorRegion).toHaveAttribute("aria-live", "assertive");
});
```

**Why good:** Verifies that important messages are announced to assistive technology

---

## Testing Focus Management

```typescript
// Good Example - Testing focus trapping in modals
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./modal";

test("modal traps focus", async () => {
  const user = userEvent.setup();
  render(
    <>
      <button>Outside Button</button>
      <Modal isOpen={true}>
        <button>First</button>
        <button>Second</button>
        <button>Close</button>
      </Modal>
    </>
  );

  // Focus should start on first focusable element in modal
  expect(screen.getByRole("button", { name: /first/i })).toHaveFocus();

  // Tab through modal elements
  await user.tab();
  expect(screen.getByRole("button", { name: /second/i })).toHaveFocus();

  await user.tab();
  expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();

  // Tab wraps back to first element (focus trap)
  await user.tab();
  expect(screen.getByRole("button", { name: /first/i })).toHaveFocus();

  // Shift+Tab wraps to last element
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
});

test("focus returns to trigger when modal closes", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <>
      <button data-testid="trigger">Open Modal</button>
      <Modal isOpen={false} />
    </>
  );

  const trigger = screen.getByTestId("trigger");
  await user.click(trigger);

  // Open modal
  rerender(
    <>
      <button data-testid="trigger">Open Modal</button>
      <Modal isOpen={true}>
        <button>Close</button>
      </Modal>
    </>
  );

  // Close modal
  await user.click(screen.getByRole("button", { name: /close/i }));
  rerender(
    <>
      <button data-testid="trigger">Open Modal</button>
      <Modal isOpen={false} />
    </>
  );

  // Focus should return to trigger
  expect(trigger).toHaveFocus();
});
```

**Why good:** Tests that modal properly traps focus and restores focus on close - critical accessibility requirements

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy with accessible queries
- [user-events.md](user-events.md) - Keyboard interaction patterns
