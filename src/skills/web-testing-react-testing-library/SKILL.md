---
name: web-testing-react-testing-library
description: React Testing Library — query hierarchy, userEvent, async utilities, renderHook, custom render with providers. Load when writing or reviewing tests that render React components or hooks.
---

# React Testing Library Patterns

> **Quick Guide:** Query through the accessibility tree (`getByRole` first, `getByTestId` last), drive interactions with `userEvent` rather than `fireEvent`, and reach for `findBy*` whenever the element arrives asynchronously. `userEvent` has been async and `setup()`-first since v14, so every call is awaited. The library renders and interacts; the assertion API, mock functions and fake timers come from whatever test runner is executing the file.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — query hierarchy, choosing between role, label, text and test id
- [examples/user-events.md](examples/user-events.md) — typing, clicking, keyboard shortcuts, tab order, and the cases fireEvent still covers
- [examples/async-testing.md](examples/async-testing.md) — `findBy*`, `waitFor`, `waitForElementToBeRemoved`
- [examples/custom-render.md](examples/custom-render.md) — a render wrapped in the app's providers, with per-test initial state
- [examples/hooks.md](examples/hooks.md) — `renderHook`, `rerender`, `unmount`, wrappers, hooks that throw
- [examples/accessibility.md](examples/accessibility.md) — keyboard navigation, ARIA attributes, live regions, focus trapping
- [examples/scoped-queries.md](examples/scoped-queries.md) — `within()` for tables, cards, sections and modals
- [examples/configuration.md](examples/configuration.md) — fake timers, pointer-events checks, timeout overrides
- [reference.md](reference.md) — query and role tables, userEvent methods, keyboard syntax, matcher list, debug checklist

---

## Which path applies

- **A component is the subject** — render it and query the resulting DOM;
  [examples/core.md](examples/core.md) and [examples/user-events.md](examples/user-events.md) are the
  path.
- **A bare hook is the subject** — no DOM to query, so `renderHook` exposes `result.current`;
  [examples/hooks.md](examples/hooks.md). Where the hook only makes sense inside its UI, test the
  component instead.
- **The subject needs providers** — theme, auth, routing — wrap once in a custom render rather than
  per test; [examples/custom-render.md](examples/custom-render.md).

---

<critical_requirements>

## Before writing React Testing Library code

**Reach for queries in accessibility order — `getByRole`, then `getByLabelText`, then `getByText`, and `getByTestId` only when nothing else reaches the element.** A query that has to fall back is telling you the element is unreachable to assistive technology too.

**Call `userEvent.setup()` before the first interaction and await every method.** Since v14 the methods return promises, so an un-awaited call lets assertions run against a DOM that has not finished updating.

**Use `findBy*` for anything that arrives asynchronously.** It retries and reports the DOM it gave up on, where `waitFor` wrapped around `getBy*` reports only the last thrown error.

**Query through `screen` rather than the object `render` returns.** One import serves every query, and the destructured form drifts out of step as a test grows.

**Assert on what the user can see or operate.** Internal state, refs and instance fields change under a refactor that keeps the behaviour identical.

</critical_requirements>

---

**Auto-detection:** @testing-library/react, @testing-library/user-event, @testing-library/dom, render, screen, userEvent.setup, fireEvent, waitFor, waitForElementToBeRemoved, findByRole, getByRole, getByLabelText, queryByRole, renderHook, result.current, within, cleanup, prettyDOM, logRoles, logTestingPlaygroundURL, testIdAttribute, asyncUtilTimeout

**Applies to:**

- Rendering a React component and asserting on what it puts in the DOM
- Driving forms, keyboard navigation and pointer interaction through a simulated user
- Testing loading, error and success states that resolve asynchronously
- Testing a custom hook in isolation, and deciding when not to
- Building a render that carries the app's providers
- Asserting that interactive elements are reachable by role, label and keyboard

**Handled elsewhere:**

- Test runner mechanics — the file's `describe`/`it`, the assertion API, mock functions, fake timers
  and the setup file are the runner's; this skill only names the seam where an option must be handed
  the runner's timer-advance function
- Test doubles for the network — a component is unaware of its transport, so responses are arranged
  by whatever intercepts them
- Journeys spanning navigations and real backends — browser-driven end-to-end coverage
- Whether a rendered frame still looks right — pixel comparison against an approved image

---

<philosophy>

## Philosophy

The library's own guiding principle: the more a test resembles the way the software is used, the more confidence it gives. Three consequences follow.

**Queries are an accessibility audit that happens to be a test.** A component reachable by `getByRole("button", { name: /submit/i })` is reachable by a screen reader for the same reason. When the only query that works is `getByTestId`, the test has just reported a defect in the UI rather than in itself.

**Implementation details are whatever survives a refactor unchanged.** State shape, hook internals, class names and DOM nesting are all free to move; rendered text, roles and accessible names are the contract.

**The DOM is real.** Components render into a real document, so integration bugs between a component and its children surface here rather than in production.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Query Priority Hierarchy

Pick the query by how a user would find the element, not by what is convenient in the markup.

```typescript
screen.getByRole("button", { name: /sign in/i }); // interactive elements
screen.getByLabelText(/password/i); // form fields, incl. password inputs (no textbox role)
screen.getByText(/welcome back/i); // non-interactive content
screen.getByDisplayValue("draft title"); // a field by its current value
screen.getByAltText(/profile photo/i); // images
screen.getByTestId(`product-${generatedId}`); // last resort: genuinely generated content
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: userEvent Over fireEvent

`fireEvent` dispatches one DOM event. `userEvent` replays the sequence a real interaction produces — pointer, focus and keyboard events in order — which is where handler bugs actually live.

```typescript
import userEvent from "@testing-library/user-event";

const user = userEvent.setup(); // before the first interaction
await user.type(screen.getByLabelText(/email/i), "user@example.com");
await user.click(screen.getByRole("button", { name: /create account/i }));
```

Reach for `fireEvent` only for events a user does not originate — `resize`, `scroll`, a synthetic event carrying properties you need to control.

Full code: [examples/user-events.md](examples/user-events.md)

### Pattern 3: Async Utilities

`findBy*` when the element appears; `waitFor` only when the thing you are waiting on is an assertion rather than an element; `waitForElementToBeRemoved` when it disappears.

```typescript
expect(await screen.findByText(/results/i)).toBeInTheDocument();

await waitFor(() => {
  expect(handler).toHaveBeenCalledWith("react"); // one assertion, no side effects
});

await waitForElementToBeRemoved(() => screen.queryByRole("progressbar"));
```

`waitFor` polls until its callback stops throwing, so a second assertion inside it pays the full retry cost before the first failure is reported, and a side effect inside it runs on every poll.

Full code: [examples/async-testing.md](examples/async-testing.md)

### Pattern 4: Testing Hooks with renderHook

`renderHook` mounts a hook without a component. `result.current` is re-read on every access, so hold the access rather than the value.

```typescript
const { result, rerender, unmount } = renderHook(
  ({ key }) => useLocalStorage(key, "initial"),
  { initialProps: { key: "draft" } },
);

act(() => {
  result.current[1]("updated");
});
expect(result.current[0]).toBe("updated");
```

Prefer a component test where the hook is inseparable from its UI; `renderHook` earns its place for hooks you publish, or hooks with edge cases a component would obscure.

Full code: [examples/hooks.md](examples/hooks.md)

### Pattern 5: Custom Render with Providers

Wrap the app's providers once and re-export, so no test repeats the nesting.

```typescript
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render }; // shadow the default export
```

Widen the options type to accept per-test initial state — an auth state, a starting route — so a test states its precondition instead of arranging it.

Full code: [examples/custom-render.md](examples/custom-render.md)

### Pattern 6: Asserting Accessible Behaviour

Beyond finding elements, the accessibility tree is where keyboard order, expanded/selected state and announcements are asserted.

```typescript
await user.tab();
expect(screen.getByRole("combobox")).toHaveFocus();

await user.keyboard("{Enter}");
expect(screen.getByRole("button", { name: /section 1/i })).toHaveAttribute(
  "aria-expanded",
  "true",
);

expect(await screen.findByRole("alert")).toHaveTextContent(
  /email is required/i,
);
```

Full code: [examples/accessibility.md](examples/accessibility.md)

### Pattern 7: Scoped Queries with within

`within` bounds a query to a container, which is what makes repeated structures testable at all.

```typescript
const bobRow = screen.getAllByRole("row")[2];
await user.click(within(bobRow).getByRole("button", { name: /edit/i }));

const billing = screen.getByRole("region", { name: /billing address/i });
await user.type(
  within(billing).getByLabelText(/street address/i),
  "123 Billing St",
);
```

Full code: [examples/scoped-queries.md](examples/scoped-queries.md)

### Pattern 8: userEvent Setup Options

Three options change behaviour rather than tune it, and all three are set at `setup()`.

```typescript
const user = userEvent.setup({
  advanceTimers: advanceTimersBy, // your runner's timer-advance fn; without it, fake timers hang
  delay: null, // skip the inter-event wait
  pointerEventsCheck: 0, // interact with an element whose CSS sets pointer-events: none
});
```

Full code: [examples/configuration.md](examples/configuration.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `userEvent` call without `await` — assertions run against the pre-interaction DOM, and the test passes or fails by timing
- Fake timers installed without passing `advanceTimers` to `setup()` — `userEvent`'s internal delay never resolves and the test hangs until the runner's timeout
- Calling `userEvent.click(...)` directly instead of on a `setup()` session — the direct API is deprecated and carries none of the session's pointer or keyboard state
- `getBy*` for an element that arrives asynchronously — throws immediately rather than waiting
- A side effect inside a `waitFor` callback — the callback runs on every poll, so the effect fires repeatedly

**Surprising behaviour:**

- `container.querySelector(".btn-primary")` returns `null` rather than throwing, so the failure surfaces one line later at the assertion instead of at the query — and it matches on the class names and nesting a refactor is free to change, which is the whole thing the query hierarchy exists to avoid
- `queryBy*` returns `null` instead of throwing, which is what makes it right for absence assertions and wrong for everything else
- `findBy*` defaults to a 1000ms timeout, and its third argument — not its second — is where that is raised
- `result.current` is re-read each time it is touched, so a value captured into a local goes stale after the next `act`
- `render`, `fireEvent` and `userEvent` already wrap in `act`; wrapping them again is noise that also hides genuine act warnings
- Cleanup runs automatically wherever the framework adapter is registered, so a manual `afterEach(cleanup)` is redundant
- Multiple assertions in one `waitFor` pay the full retry window before the first failure surfaces
- An empty `waitFor(() => {})` waits for the next poll tick and nothing else — a sleep wearing a matcher's clothes
- A large DOM snapshot fails with noise rather than with a reason; keep snapshots for small, stable output such as an icon or a breadcrumb
- `screen.debug()` truncates at 7000 characters, which is why a debugged form often appears to end mid-element

</red_flags>
