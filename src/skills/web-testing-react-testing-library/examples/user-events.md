# React Testing Library - User Event Examples

> Typing, clicking, keyboard shortcuts and focus order. See [core.md](core.md) for queries and [accessibility.md](accessibility.md) for what keyboard interaction proves.

> `fn()` below stands for your test runner's mock-function factory, and `expect` for its assertion API.

---

## A complete form flow

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationForm } from "./registration-form";

test("completes registration form", async () => {
  const user = userEvent.setup(); // before the first interaction
  const onSubmit = fn();
  render(<RegistrationForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/full name/i), "John Doe");
  await user.type(screen.getByLabelText(/email/i), "user@example.com");
  await user.type(screen.getByLabelText(/password/i), "SecurePass123!");
  await user.click(screen.getByRole("checkbox", { name: /agree to terms/i }));
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    name: "John Doe",
    email: "user@example.com",
    password: "SecurePass123!",
    agreeToTerms: true,
  });
});
```

**Why good:** one `setup()` session drives the whole flow, so focus moves between fields the way it does for a real user, and the assertion is on what the component reported outward rather than on its internal state.

---

## Keyboard shortcuts

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "./editor";

test("saves on Ctrl+S", async () => {
  const user = userEvent.setup();
  const onSave = fn();
  render(<Editor onSave={onSave} />);

  await user.click(screen.getByRole("textbox"));
  await user.type(screen.getByRole("textbox"), "Hello world");
  await user.keyboard("{Control>}s{/Control}"); // `{Key>}…{/Key}` holds and releases

  expect(onSave).toHaveBeenCalled();
});
```

The keyboard syntax — single presses, held modifiers, key codes — is tabulated in [reference.md](../reference.md).

---

## Selecting and clearing

```typescript
test("replaces existing content", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="existing content" />);

  const textbox = screen.getByRole("textbox");

  await user.clear(textbox);
  expect(textbox).toHaveValue("");

  await user.type(textbox, "new content");
  await user.tripleClick(textbox); // selects the paragraph
  await user.type(textbox, "replaced"); // typing over a selection replaces it

  expect(textbox).toHaveValue("replaced");
});
```

---

## Tab order

```typescript
test("moves focus through the form in order", async () => {
  const user = userEvent.setup();
  render(<Editor />);

  await user.tab();
  expect(screen.getByRole("textbox")).toHaveFocus();

  await user.tab();
  expect(screen.getByRole("button", { name: /save/i })).toHaveFocus();

  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(screen.getByRole("textbox")).toHaveFocus();
});
```

**Why good:** `user.tab()` follows the document's real tab order, so this fails when a `tabindex` or a wrapper element changes the sequence — a class of regression no click-driven test notices.

---

## Where fireEvent still applies

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Slider } from "./slider";

test("user adjusts slider", async () => {
  const user = userEvent.setup();
  render(<Slider onChange={fn()} />);

  await user.click(screen.getByRole("slider")); // a user action: userEvent
});

test("slider responds to a resize", () => {
  render(<Slider onChange={fn()} />);

  fireEvent(window, new Event("resize")); // nobody "does" a resize event: fireEvent

  // Also fireEvent's territory: an event whose properties you need to set exactly
  fireEvent.change(screen.getByRole("slider"), { target: { value: 75 } });
});
```

**Why this split:** `userEvent` exists to reproduce a human. For an event no human dispatches — resize, scroll, a custom event, a synthetic payload — that fidelity buys nothing and `fireEvent` says what is happening more directly.

---

_Next: [async-testing.md](async-testing.md) for content that arrives later._
