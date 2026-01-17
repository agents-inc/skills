# React Testing Library Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### Query Selection Decision Tree

```
What are you looking for?
├─ Interactive element (button, link, input)?
│   └─ Use getByRole with name option
│       └─ getByRole("button", { name: /submit/i })
│
├─ Form field?
│   ├─ Has visible label?
│   │   └─ Use getByLabelText
│   ├─ Has aria-label?
│   │   └─ Use getByRole or getByLabelText
│   └─ Only has placeholder?
│       └─ Use getByPlaceholderText (improve accessibility!)
│
├─ Non-interactive text content?
│   └─ Use getByText
│       └─ getByText(/welcome message/i)
│
├─ Image?
│   └─ Use getByAltText
│       └─ getByAltText(/profile photo/i)
│
├─ Form element with current value?
│   └─ Use getByDisplayValue
│       └─ getByDisplayValue("current text")
│
└─ Nothing else works?
    └─ Use getByTestId (last resort)
        └─ Consider: Is the UI accessible?
```

### Async Query Decision Tree

```
Does the element exist immediately after render?
├─ YES → Use getBy*
│   └─ screen.getByRole("button")
│
└─ NO → Does it appear after async operation?
    ├─ YES → Use findBy*
    │   └─ await screen.findByRole("button")
    │
    └─ Want to verify element is ABSENT?
        └─ Use queryBy*
            └─ expect(screen.queryByRole("alert")).not.toBeInTheDocument()
```

### Event Simulation Decision Tree

```
What type of event?
├─ User interaction (click, type, select)?
│   └─ Use userEvent
│       └─ await user.click(button)
│
├─ Programmatic event (resize, scroll)?
│   └─ Use fireEvent
│       └─ fireEvent(window, new Event("resize"))
│
└─ Custom event with specific properties?
    └─ Use fireEvent with event object
        └─ fireEvent.change(input, { target: { value: "x" } })
```

### Hook Testing Decision Tree

```
Testing a custom hook?
├─ Is it tightly coupled to UI?
│   └─ Test through component (render, interact, assert)
│
├─ Is it a utility hook with complex logic?
│   └─ Use renderHook
│       └─ Good for: useLocalStorage, useDebounce, useCounter
│
├─ Does it require context providers?
│   └─ Pass wrapper option to renderHook
│       └─ renderHook(() => useAuth(), { wrapper: AuthProvider })
│
└─ Does it throw errors on invalid usage?
    └─ Wrap renderHook in expect().toThrow()
```

---

## Query Variant Reference

| Variant | Returns | Throws on No Match | Use Case |
|---------|---------|-------------------|----------|
| `getBy*` | Element | Yes | Element exists synchronously |
| `queryBy*` | Element or `null` | No | Verify element is absent |
| `findBy*` | Promise<Element> | Yes (after timeout) | Element appears asynchronously |
| `getAllBy*` | Element[] | Yes | Multiple elements exist |
| `queryAllBy*` | Element[] (empty if none) | No | Verify no elements match |
| `findAllBy*` | Promise<Element[]> | Yes | Multiple elements appear async |

### Query Priority Reference

| Priority | Query | Use When |
|----------|-------|----------|
| 1 | `getByRole` | Almost everything - buttons, links, inputs, headings |
| 1 | `getByLabelText` | Form fields with labels |
| 2 | `getByPlaceholderText` | Inputs without labels (improve accessibility!) |
| 2 | `getByText` | Non-interactive content |
| 2 | `getByDisplayValue` | Form elements by current value |
| 3 | `getByAltText` | Images, elements with alt text |
| 3 | `getByTitle` | Elements with title attribute (least reliable) |
| 4 | `getByTestId` | Last resort - dynamic/generated content only |

---

## Common Role Reference

| Role | Elements | Example Query |
|------|----------|---------------|
| `button` | `<button>`, `<input type="button">` | `getByRole("button", { name: /submit/i })` |
| `textbox` | `<input type="text">`, `<textarea>` | `getByRole("textbox", { name: /email/i })` |
| `checkbox` | `<input type="checkbox">` | `getByRole("checkbox", { name: /agree/i })` |
| `radio` | `<input type="radio">` | `getByRole("radio", { name: /option a/i })` |
| `combobox` | `<select>`, custom dropdowns | `getByRole("combobox", { name: /country/i })` |
| `link` | `<a href>` | `getByRole("link", { name: /home/i })` |
| `heading` | `<h1>`-`<h6>` | `getByRole("heading", { level: 1 })` |
| `list` | `<ul>`, `<ol>` | `getByRole("list")` |
| `listitem` | `<li>` | `getAllByRole("listitem")` |
| `dialog` | `<dialog>`, modals with `role="dialog"` | `getByRole("dialog")` |
| `alert` | Elements with `role="alert"` | `getByRole("alert")` |
| `form` | `<form>` | `getByRole("form")` |
| `navigation` | `<nav>` | `getByRole("navigation")` |
| `search` | `<input type="search">` | `getByRole("searchbox")` |
| `slider` | `<input type="range">` | `getByRole("slider")` |
| `switch` | Toggle switches | `getByRole("switch")` |
| `tab` | Tab elements | `getByRole("tab")` |
| `tabpanel` | Tab content | `getByRole("tabpanel")` |

---

## userEvent Methods Reference

| Method | Description | Example |
|--------|-------------|---------|
| `click(element)` | Clicks element | `await user.click(button)` |
| `dblClick(element)` | Double clicks | `await user.dblClick(cell)` |
| `tripleClick(element)` | Selects text | `await user.tripleClick(paragraph)` |
| `type(element, text)` | Types text character by character | `await user.type(input, "hello")` |
| `clear(element)` | Clears input/textarea | `await user.clear(input)` |
| `selectOptions(select, values)` | Selects dropdown options | `await user.selectOptions(select, ["a", "b"])` |
| `deselectOptions(select, values)` | Deselects multi-select options | `await user.deselectOptions(select, ["a"])` |
| `upload(input, files)` | Uploads files | `await user.upload(input, file)` |
| `tab()` | Presses Tab key | `await user.tab()` |
| `keyboard(text)` | Types keys including modifiers | `await user.keyboard("{Shift>}A{/Shift}")` |
| `hover(element)` | Hovers over element | `await user.hover(tooltip)` |
| `unhover(element)` | Moves away from element | `await user.unhover(tooltip)` |
| `copy()` | Copies selection | `await user.copy()` |
| `cut()` | Cuts selection | `await user.cut()` |
| `paste(text?)` | Pastes from clipboard | `await user.paste()` |

### Keyboard Syntax Reference

| Syntax | Meaning | Example |
|--------|---------|---------|
| `{Key}` | Single key press | `{Enter}`, `{Tab}`, `{Escape}` |
| `{Key>}...{/Key}` | Hold key | `{Shift>}A{/Shift}` = Shift+A |
| `{Key}{Key}` | Sequential keys | `{ArrowDown}{ArrowDown}` |
| `[KeyA]` | Key by code | `[KeyA]` = A key regardless of layout |

---

## Anti-Patterns to Avoid

### Using getByTestId When Accessible Queries Work

```typescript
// ANTI-PATTERN
test("submits form", async () => {
  render(<LoginForm />);

  await user.type(screen.getByTestId("email-input"), "test@example.com");
  await user.type(screen.getByTestId("password-input"), "password123");
  await user.click(screen.getByTestId("submit-button"));
});
```

**Why it's wrong:** Test IDs don't reflect how users interact. If accessible queries fail, your UI has accessibility issues.

**What to do instead:**

```typescript
test("submits form", async () => {
  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), "test@example.com");
  await user.type(screen.getByLabelText(/password/i), "password123");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
});
```

---

### Using waitFor for Element Queries

```typescript
// ANTI-PATTERN
test("shows results after search", async () => {
  render(<Search />);

  await user.type(screen.getByRole("searchbox"), "test");
  await user.click(screen.getByRole("button", { name: /search/i }));

  // DON'T: Using waitFor for element queries
  await waitFor(() => {
    expect(screen.getByText(/results/i)).toBeInTheDocument();
  });
});
```

**Why it's wrong:** `findBy*` produces better error messages and cleaner code.

**What to do instead:**

```typescript
test("shows results after search", async () => {
  render(<Search />);

  await user.type(screen.getByRole("searchbox"), "test");
  await user.click(screen.getByRole("button", { name: /search/i }));

  // DO: Use findBy for async elements
  expect(await screen.findByText(/results/i)).toBeInTheDocument();
});
```

---

### Multiple Assertions in waitFor

```typescript
// ANTI-PATTERN
test("form validation", async () => {
  render(<Form />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  // DON'T: Multiple assertions in single waitFor
  await waitFor(() => {
    expect(screen.getByText(/email required/i)).toBeInTheDocument();
    expect(screen.getByText(/password required/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/fix errors/i);
  });
});
```

**Why it's wrong:** If first assertion fails, you lose time on every retry. Unpredictable behavior.

**What to do instead:**

```typescript
test("form validation", async () => {
  render(<Form />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  // DO: Separate waitFor for each assertion
  await waitFor(() => {
    expect(screen.getByText(/email required/i)).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByText(/password required/i)).toBeInTheDocument();
  });
});
```

---

### Using fireEvent for User Interactions

```typescript
// ANTI-PATTERN
test("user types in input", () => {
  render(<TextInput />);

  // DON'T: fireEvent doesn't simulate real user interaction
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "hello" },
  });
});
```

**Why it's wrong:** `fireEvent.change` fires a single change event. Real typing fires keyDown, keyPress, keyUp per character plus focus events.

**What to do instead:**

```typescript
test("user types in input", async () => {
  const user = userEvent.setup();
  render(<TextInput />);

  // DO: userEvent simulates realistic interaction
  await user.type(screen.getByRole("textbox"), "hello");
});
```

---

### Testing Implementation Details

```typescript
// ANTI-PATTERN
test("counter state updates", () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  // DON'T: Testing internal state
  expect(result.current.count).toBe(1);
  expect(result.current.history).toEqual([0, 1]); // Implementation detail!
});
```

**Why it's wrong:** Testing internal state couples tests to implementation. Refactoring breaks tests even when behavior is correct.

**What to do instead:**

```typescript
test("counter increments on click", async () => {
  const user = userEvent.setup();
  render(<Counter />);

  // DO: Test user-visible behavior
  expect(screen.getByText(/count: 0/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /increment/i }));

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});
```

---

### Destructuring Render Return

```typescript
// ANTI-PATTERN
test("displays user", () => {
  const { getByRole, getByText } = render(<User name="John" />);

  // DON'T: Destructuring queries from render
  expect(getByText("John")).toBeInTheDocument();
  expect(getByRole("img")).toBeInTheDocument();
});
```

**Why it's wrong:** `screen` provides cleaner API, consistent import pattern, and better editor support.

**What to do instead:**

```typescript
test("displays user", () => {
  render(<User name="John" />);

  // DO: Use screen object
  expect(screen.getByText("John")).toBeInTheDocument();
  expect(screen.getByRole("img")).toBeInTheDocument();
});
```

---

### Manual Cleanup Calls

```typescript
// ANTI-PATTERN
import { cleanup, render, screen } from "@testing-library/react";

afterEach(() => {
  cleanup(); // DON'T: Usually unnecessary
});

test("renders component", () => {
  render(<Component />);
  // ...
});
```

**Why it's wrong:** Modern test frameworks (Vitest with @testing-library/react, Jest with @testing-library/jest-dom) handle cleanup automatically.

**What to do instead:** Remove manual cleanup unless you're using a framework that doesn't auto-cleanup.

---

### Unnecessary act() Wrapping

```typescript
// ANTI-PATTERN
test("updates on click", async () => {
  const user = userEvent.setup();

  // DON'T: render already wraps in act
  act(() => {
    render(<Counter />);
  });

  // DON'T: userEvent already wraps in act
  await act(async () => {
    await user.click(screen.getByRole("button"));
  });
});
```

**Why it's wrong:** `render`, `fireEvent`, and `userEvent` already wrap in `act()`. Double-wrapping is unnecessary.

**What to do instead:**

```typescript
test("updates on click", async () => {
  const user = userEvent.setup();

  render(<Counter />);
  await user.click(screen.getByRole("button"));

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});
```

---

### Forgetting await with userEvent

```typescript
// ANTI-PATTERN
test("submits form", () => {
  const user = userEvent.setup();
  render(<Form />);

  // DON'T: Missing await (userEvent v14+ methods are async)
  user.type(screen.getByLabelText(/email/i), "test@example.com");
  user.click(screen.getByRole("button"));

  // Assertions may run before interactions complete!
});
```

**Why it's wrong:** In userEvent v14+, all methods return Promises. Without await, assertions run before interactions complete.

**What to do instead:**

```typescript
test("submits form", async () => {
  const user = userEvent.setup();
  render(<Form />);

  // DO: Always await userEvent methods
  await user.type(screen.getByLabelText(/email/i), "test@example.com");
  await user.click(screen.getByRole("button"));
});
```

---

### Not Setting Up userEvent

```typescript
// ANTI-PATTERN (userEvent v14+)
test("clicks button", async () => {
  render(<Button />);

  // DON'T: Calling directly without setup (deprecated in v14)
  await userEvent.click(screen.getByRole("button"));
});
```

**Why it's wrong:** `userEvent.setup()` creates an isolated user session. Direct calls are deprecated and will be removed.

**What to do instead:**

```typescript
test("clicks button", async () => {
  const user = userEvent.setup(); // MUST call setup first
  render(<Button />);

  await user.click(screen.getByRole("button"));
});
```

---

## ESLint Rules Reference

Install these ESLint plugins to catch mistakes automatically:

```bash
# Install plugins
npm install -D eslint-plugin-testing-library eslint-plugin-jest-dom
```

### Key Rules

| Rule | Description | Catches |
|------|-------------|---------|
| `testing-library/prefer-screen-queries` | Enforce using `screen` | Destructured queries |
| `testing-library/prefer-find-by` | Enforce `findBy*` over `waitFor` + `getBy*` | Unnecessary waitFor |
| `testing-library/prefer-user-event` | Enforce `userEvent` over `fireEvent` | Direct fireEvent usage |
| `testing-library/no-wait-for-empty-callback` | Disallow empty waitFor | Fragile timing tests |
| `testing-library/no-wait-for-side-effects` | Disallow side effects in waitFor | Side effects in waitFor |
| `testing-library/no-wait-for-multiple-assertions` | Disallow multiple assertions in waitFor | Multiple assertions |
| `jest-dom/prefer-to-have-attribute` | Enforce semantic matchers | `.getAttribute()` assertions |

---

## Debug Checklist

When a test fails unexpectedly:

1. **Add `screen.debug()`** to see current DOM state
2. **Use `logRoles(container)`** to see available ARIA roles
3. **Use `logTestingPlaygroundURL()`** to get suggested queries
4. **Check async timing** - use `findBy*` for async elements
5. **Check userEvent setup** - ensure `userEvent.setup()` is called
6. **Check await** - all userEvent methods need await
7. **Check query variant** - `getBy*` throws, `queryBy*` returns null
8. **Increase DEBUG_PRINT_LIMIT** if output is truncated

---

## Jest-DOM Matcher Reference

| Matcher | Use Case | Example |
|---------|----------|---------|
| `toBeInTheDocument()` | Element exists | `expect(button).toBeInTheDocument()` |
| `toBeVisible()` | Element is visible | `expect(dialog).toBeVisible()` |
| `toBeEnabled()` | Element is not disabled | `expect(button).toBeEnabled()` |
| `toBeDisabled()` | Element is disabled | `expect(button).toBeDisabled()` |
| `toHaveValue(value)` | Input has value | `expect(input).toHaveValue("test")` |
| `toHaveTextContent(text)` | Element contains text | `expect(heading).toHaveTextContent(/hello/i)` |
| `toHaveAttribute(attr, value?)` | Element has attribute | `expect(link).toHaveAttribute("href", "/")` |
| `toHaveClass(className)` | Element has class | `expect(div).toHaveClass("active")` |
| `toHaveFocus()` | Element has focus | `expect(input).toHaveFocus()` |
| `toBeChecked()` | Checkbox/radio is checked | `expect(checkbox).toBeChecked()` |
| `toBePartiallyChecked()` | Checkbox is indeterminate | `expect(checkbox).toBePartiallyChecked()` |
| `toHaveAccessibleName(name)` | Element has accessible name | `expect(button).toHaveAccessibleName("Submit")` |
| `toHaveAccessibleDescription(desc)` | Element has description | `expect(input).toHaveAccessibleDescription(/error/i)` |
| `toHaveErrorMessage(msg)` | Element has error message | `expect(input).toHaveErrorMessage(/required/i)` |
| `toBeEmpty()` | Element has no content | `expect(container).toBeEmpty()` |
| `toContainElement(element)` | Container includes element | `expect(list).toContainElement(item)` |
| `toContainHTML(html)` | Container includes HTML | `expect(div).toContainHTML("<span>")` |
