# React Testing Library Reference

> Lookup tables and the debug checklist. Decisions and red flags live in [SKILL.md](SKILL.md); worked code lives in [examples/](examples/core.md).

---

## Query Variants

| Variant       | Returns                   | Throws on no match | Use for                        |
| ------------- | ------------------------- | ------------------ | ------------------------------ |
| `getBy*`      | Element                   | Yes                | Element exists synchronously   |
| `queryBy*`    | Element or `null`         | No                 | Asserting an element is absent |
| `findBy*`     | Promise<Element>          | Yes, after timeout | Element appears asynchronously |
| `getAllBy*`   | Element[]                 | Yes                | Several elements exist         |
| `queryAllBy*` | Element[] (empty if none) | No                 | Asserting no elements match    |
| `findAllBy*`  | Promise<Element[]>        | Yes, after timeout | Several elements appear later  |

## Query Priority

| Priority | Query                  | Use for                                              |
| -------- | ---------------------- | ---------------------------------------------------- |
| 1        | `getByRole`            | Almost everything — buttons, links, inputs, headings |
| 1        | `getByLabelText`       | Form fields, including those with no matching role   |
| 2        | `getByPlaceholderText` | Inputs with no label — and a hint to add one         |
| 2        | `getByText`            | Non-interactive content                              |
| 2        | `getByDisplayValue`    | A form element by its current value                  |
| 3        | `getByAltText`         | Images and other elements carrying `alt`             |
| 3        | `getByTitle`           | `title` attribute — announced inconsistently         |
| 4        | `getByTestId`          | Last resort; generated content with no stable name   |

---

## Common Roles

| Role         | Elements                               | Example query                                 |
| ------------ | -------------------------------------- | --------------------------------------------- |
| `button`     | `<button>`, `<input type="button">`    | `getByRole("button", { name: /submit/i })`    |
| `textbox`    | `<input type="text">`, `<textarea>`    | `getByRole("textbox", { name: /email/i })`    |
| `checkbox`   | `<input type="checkbox">`              | `getByRole("checkbox", { name: /agree/i })`   |
| `radio`      | `<input type="radio">`                 | `getByRole("radio", { name: /option a/i })`   |
| `combobox`   | `<select>`, custom dropdowns           | `getByRole("combobox", { name: /country/i })` |
| `searchbox`  | `<input type="search">`                | `getByRole("searchbox")`                      |
| `slider`     | `<input type="range">`                 | `getByRole("slider")`                         |
| `switch`     | Toggle switches                        | `getByRole("switch")`                         |
| `link`       | `<a href>`                             | `getByRole("link", { name: /home/i })`        |
| `heading`    | `<h1>`–`<h6>`                          | `getByRole("heading", { level: 1 })`          |
| `list`       | `<ul>`, `<ol>`                         | `getByRole("list")`                           |
| `listitem`   | `<li>`                                 | `getAllByRole("listitem")`                    |
| `dialog`     | `<dialog>`, `role="dialog"`            | `getByRole("dialog")`                         |
| `alert`      | `role="alert"` (assertive live region) | `getByRole("alert")`                          |
| `status`     | `role="status"` (polite live region)   | `getByRole("status")`                         |
| `form`       | `<form>` with an accessible name       | `getByRole("form")`                           |
| `navigation` | `<nav>`                                | `getByRole("navigation")`                     |
| `region`     | `<section>` with an accessible name    | `getByRole("region", { name: /billing/i })`   |
| `tab`        | `role="tab"`                           | `getByRole("tab")`                            |
| `tabpanel`   | `role="tabpanel"`                      | `getByRole("tabpanel")`                       |

A password input has **no** role — reach it with `getByLabelText`. A `<section>` or `<form>` gets its role only once it has an accessible name.

---

## userEvent Methods

| Method                            | Description                       | Example                                        |
| --------------------------------- | --------------------------------- | ---------------------------------------------- |
| `click(element)`                  | Clicks element                    | `await user.click(button)`                     |
| `dblClick(element)`               | Double clicks                     | `await user.dblClick(cell)`                    |
| `tripleClick(element)`            | Selects the text                  | `await user.tripleClick(paragraph)`            |
| `type(element, text)`             | Types character by character      | `await user.type(input, "hello")`              |
| `clear(element)`                  | Clears an input or textarea       | `await user.clear(input)`                      |
| `selectOptions(select, values)`   | Selects dropdown options          | `await user.selectOptions(select, ["a", "b"])` |
| `deselectOptions(select, values)` | Deselects multi-select options    | `await user.deselectOptions(select, ["a"])`    |
| `upload(input, files)`            | Uploads files                     | `await user.upload(input, file)`               |
| `tab()`                           | Moves focus in document tab order | `await user.tab()`                             |
| `keyboard(text)`                  | Keys, including modifiers         | `await user.keyboard("{Shift>}A{/Shift}")`     |
| `hover(element)`                  | Hovers                            | `await user.hover(tooltip)`                    |
| `unhover(element)`                | Moves away                        | `await user.unhover(tooltip)`                  |
| `copy()` / `cut()` / `paste()`    | Clipboard operations              | `await user.paste()`                           |

Every one of these returns a promise.

### Keyboard syntax

| Syntax            | Meaning            | Example                          |
| ----------------- | ------------------ | -------------------------------- |
| `{Key}`           | One key press      | `{Enter}`, `{Tab}`, `{Escape}`   |
| `{Key>}...{/Key}` | Hold, then release | `{Shift>}A{/Shift}` = Shift+A    |
| `{Key}{Key}`      | Keys in sequence   | `{ArrowDown}{ArrowDown}`         |
| `[KeyA]`          | Key by code        | `[KeyA]` = the A key, any layout |

---

## Configuration

Set through `configure({ … })`; read back through `getConfig()`.

| Option             | Default         | Effect                                          |
| ------------------ | --------------- | ----------------------------------------------- |
| `testIdAttribute`  | `"data-testid"` | Attribute `getByTestId` matches on              |
| `asyncUtilTimeout` | `1000`          | Default timeout for `findBy*` and `waitFor`, ms |
| `reactStrictMode`  | `false`         | Renders under StrictMode                        |
| `throwSuggestions` | `false`         | Throw on deprecated usage                       |

### userEvent setup options

| Option               | Default     | Effect                                                     |
| -------------------- | ----------- | ---------------------------------------------------------- |
| `advanceTimers`      | no-op async | Timer-advance function; required under fake timers         |
| `delay`              | `0`         | Wait between events in ms; `null` removes it               |
| `pointerEventsCheck` | `2`         | Pointer-events validation: 0 never, 1 once, 2 per API call |
| `skipHover`          | `false`     | Skips the hover that precedes a click                      |

---

## DOM Matchers

Provided by `@testing-library/jest-dom`, registered once in the test runner's setup file. Runner-agnostic despite the package name.

| Matcher                             | Asserts                     | Example                                               |
| ----------------------------------- | --------------------------- | ----------------------------------------------------- |
| `toBeInTheDocument()`               | Element is attached         | `expect(button).toBeInTheDocument()`                  |
| `toBeVisible()`                     | Element is visible          | `expect(dialog).toBeVisible()`                        |
| `toBeEnabled()` / `toBeDisabled()`  | Interactive state           | `expect(button).toBeEnabled()`                        |
| `toHaveValue(value)`                | Input value                 | `expect(input).toHaveValue("test")`                   |
| `toHaveTextContent(text)`           | Contained text              | `expect(heading).toHaveTextContent(/hello/i)`         |
| `toHaveAttribute(attr, value?)`     | Attribute presence or value | `expect(link).toHaveAttribute("href", "/")`           |
| `toHaveClass(className)`            | Class presence              | `expect(div).toHaveClass("active")`                   |
| `toHaveFocus()`                     | Element is `activeElement`  | `expect(input).toHaveFocus()`                         |
| `toBeChecked()`                     | Checkbox or radio is on     | `expect(checkbox).toBeChecked()`                      |
| `toBePartiallyChecked()`            | Indeterminate state         | `expect(checkbox).toBePartiallyChecked()`             |
| `toHaveAccessibleName(name)`        | Computed accessible name    | `expect(button).toHaveAccessibleName("Submit")`       |
| `toHaveAccessibleDescription(desc)` | Computed description        | `expect(input).toHaveAccessibleDescription(/error/i)` |
| `toHaveErrorMessage(msg)`           | `aria-errormessage` target  | `expect(input).toHaveErrorMessage(/required/i)`       |
| `toBeEmptyDOMElement()`             | No child nodes              | `expect(container).toBeEmptyDOMElement()`             |
| `toContainElement(element)`         | Descendant relationship     | `expect(list).toContainElement(item)`                 |

---

## Lint Rules Worth Enabling

`eslint-plugin-testing-library` and `eslint-plugin-jest-dom` catch several of the red flags mechanically.

| Rule                                              | Catches                                     |
| ------------------------------------------------- | ------------------------------------------- |
| `testing-library/prefer-screen-queries`           | Queries destructured from `render`          |
| `testing-library/prefer-find-by`                  | `waitFor` wrapped around `getBy*`           |
| `testing-library/prefer-user-event`               | `fireEvent` for a user interaction          |
| `testing-library/await-async-events`              | A `userEvent` call with no `await`          |
| `testing-library/no-wait-for-empty-callback`      | `waitFor(() => {})`                         |
| `testing-library/no-wait-for-side-effects`        | Side effects inside a `waitFor` callback    |
| `testing-library/no-wait-for-multiple-assertions` | More than one assertion inside `waitFor`    |
| `jest-dom/prefer-to-have-attribute`               | `.getAttribute()` in place of a DOM matcher |

---

## Debug Checklist

When a query fails and the reason is not obvious:

1. **Print the DOM.** `screen.debug()` for the document, `screen.debug(element)` for one node, `screen.debug(screen.getAllByRole("listitem"))` for a set.
2. **Raise the print limit** if the output is truncated — output is capped at 7000 characters, raised per call with `prettyDOM(element, 15000)` or globally with the `DEBUG_PRINT_LIMIT` environment variable.
3. **List the roles actually present.** `logRoles(container)` prints the accessibility tree the queries see, which is usually where the mismatch is.
4. **Get a suggested query.** `logTestingPlaygroundURL()` prints a URL that renders the current DOM with a query recommendation for any node.
5. **Check the timing.** An element that exists in the printed DOM but not at query time needs `findBy*`.
6. **Check the session.** `userEvent.setup()` before the interactions, and `await` on every one.
7. **Check the variant.** `getBy*` throws, `queryBy*` returns `null` — a "received null" failure is usually a `queryBy*` used where `getBy*` was meant.

Remove debug calls before committing; they are development instrumentation, not assertions.
