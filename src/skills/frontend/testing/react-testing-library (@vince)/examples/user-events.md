# React Testing Library - User Event Examples

> User interaction patterns with userEvent. Reference from [SKILL.md](../SKILL.md).

---

## Basic User Interactions

```typescript
// Good Example - Complete userEvent patterns
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationForm } from "./registration-form";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePass123!";
const VALID_NAME = "John Doe";

test("completes registration form", async () => {
  const user = userEvent.setup(); // MUST call setup() first
  const onSubmit = vi.fn();
  render(<RegistrationForm onSubmit={onSubmit} />);

  // Type into inputs
  await user.type(screen.getByLabelText(/full name/i), VALID_NAME);
  await user.type(screen.getByLabelText(/email/i), VALID_EMAIL);
  await user.type(screen.getByLabelText(/password/i), VALID_PASSWORD);

  // Click checkbox
  await user.click(screen.getByRole("checkbox", { name: /agree to terms/i }));

  // Click submit button
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    name: VALID_NAME,
    email: VALID_EMAIL,
    password: VALID_PASSWORD,
    agreeToTerms: true,
  });
});
```

**Why good:** Sets up userEvent before interactions (required in v14+), awaits all userEvent calls (they're async), tests complete user flow

---

## Advanced userEvent Patterns

### Keyboard Shortcuts

```typescript
// Good Example - Advanced user interactions
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "./editor";

const KEYBOARD_SHORTCUT_CTRL_S = "{Control>}s{/Control}";
const KEYBOARD_SHORTCUT_SHIFT_TAB = "{Shift>}{Tab}{/Shift}";

test("handles keyboard shortcuts", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<Editor onSave={onSave} />);

  // Focus the editor
  await user.click(screen.getByRole("textbox"));

  // Type some content
  await user.type(screen.getByRole("textbox"), "Hello world");

  // Use keyboard shortcut (Ctrl+S)
  await user.keyboard(KEYBOARD_SHORTCUT_CTRL_S);

  expect(onSave).toHaveBeenCalled();
});
```

---

### Select and Clear

```typescript
test("handles select and clear", async () => {
  const user = userEvent.setup();
  render(<Editor initialValue="existing content" />);

  const textbox = screen.getByRole("textbox");

  // Clear existing content
  await user.clear(textbox);
  expect(textbox).toHaveValue("");

  // Select all and type to replace
  await user.type(textbox, "new content");
  await user.tripleClick(textbox); // Select all
  await user.type(textbox, "replaced");
  expect(textbox).toHaveValue("replaced");
});
```

---

### Tab Navigation

```typescript
test("handles tab navigation", async () => {
  const user = userEvent.setup();
  render(<Editor />);

  // Tab through focusable elements
  await user.tab();
  expect(screen.getByRole("textbox")).toHaveFocus();

  await user.tab();
  expect(screen.getByRole("button", { name: /save/i })).toHaveFocus();

  // Shift+Tab to go back
  await user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(screen.getByRole("textbox")).toHaveFocus();
});
```

**Why good:** Tests keyboard navigation and shortcuts, uses userEvent methods (clear, tripleClick, tab) that simulate real interactions, verifies focus management

---

## fireEvent vs userEvent

```typescript
// Example - When fireEvent might still be used
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Slider } from "./slider";

// GOOD: userEvent for user interactions
test("user adjusts slider with userEvent", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Slider onChange={onChange} />);

  // User interactions should use userEvent
  await user.click(screen.getByRole("slider"));
});

// ACCEPTABLE: fireEvent for programmatic events
test("slider responds to programmatic change", () => {
  const onChange = vi.fn();
  render(<Slider onChange={onChange} />);

  // fireEvent acceptable for non-user-initiated events
  // like resize, scroll, or custom events
  fireEvent(window, new Event("resize"));

  // Or for testing edge cases with specific event properties
  fireEvent.change(screen.getByRole("slider"), {
    target: { value: 75 },
  });
});
```

**Why this distinction matters:** userEvent simulates real user behavior with full event chains. fireEvent is lower-level and useful for programmatic events or specific edge cases.

---

_For more patterns, see:_
- [core.md](core.md) - Query hierarchy
- [async-testing.md](async-testing.md) - Async utilities
- [accessibility.md](accessibility.md) - Keyboard navigation testing
