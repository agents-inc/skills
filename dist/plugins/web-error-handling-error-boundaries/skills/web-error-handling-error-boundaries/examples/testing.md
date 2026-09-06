# Error Boundaries — Making a Boundary Testable

> The fixtures and affordances a boundary needs before any test can exercise it. See [core.md](core.md) for the boundary itself.

Assertions, queries and the runner's mocking API belong to whatever testing tools the project uses.
What is specific to boundaries is below: how to make one throw on demand, why the console needs
handling, and what a reset test has to change between renders.

---

## A component that throws on a prop

A boundary needs something to catch, and `throw` cannot appear in JSX. The fixture is a component
whose render throws when a prop says to, so one test file can drive both the success and the failure
path.

```typescript
export function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Content rendered successfully</div>;
}
```

**Why good:** the throw happens during render, which is the only phase a boundary sees; a component
that throws from an effect or a handler tests nothing about the boundary.

For a boundary reached through `showBoundary()`, the fixture throws from the async path instead and
the assertion has to wait, because the boundary re-renders a microtask after the promise settles.

---

## React logs every caught error

React writes caught errors to `console.error` even when a boundary handled them, so a suite covering
boundaries produces a wall of expected stack traces. Silence it for the duration and restore it
afterwards, so an unexpected error elsewhere is still visible.

```typescript
const originalConsoleError = console.error;

beforeAll(() => {
  console.error = () => {};
});

afterAll(() => {
  console.error = originalConsoleError;
});
```

**Why good:** restoring in `afterAll` keeps the silence scoped to the file — a global replacement
hides the next suite's real failures.

React 19 consolidates what it logs into a single message per error rather than several, so a test
counting `console.error` calls behaves differently across major versions. Assert on the rendered
fallback instead.

---

## Resetting needs the condition to change

Pressing the reset control re-renders the children. If the thing that threw still throws, the
boundary catches again immediately and the test sees no change at all — which reads as "reset is
broken" when reset worked perfectly.

```typescript
let shouldThrow = true;

// 1. render <Boundary><ThrowingComponent shouldThrow={shouldThrow} /></Boundary>
//    → the fallback appears
// 2. shouldThrow = false — flip the condition BEFORE resetting
// 3. click the reset control
// 4. re-render the same tree, so the child element carries the new condition
// 5. assert the children are back
```

**Why good:** it separates the two failures a reset test can have — the reset never fired, or it
fired and the subtree threw again — which otherwise look identical.

Step 4 is the one that is easy to miss, and leaving it out makes a working reset look broken.
Resetting clears the boundary's error state and renders `children` again — but `children` is the same
element object the boundary was handed, still carrying `shouldThrow={true}`. Flipping the variable
changes nothing until a re-render builds a new element from it.

---

## `resetKeys` is exercised by re-rendering

A `resetKeys` test needs no interaction. Render with a key value that makes the child throw, then
re-render with a different one; the boundary clears itself between the two.

```typescript
// first render:  resetKeys={["invalid"]}  with a child that throws for "invalid"
// second render: resetKeys={["valid"]}    with the same child
// the children render, with nothing clicked
```

**Why good:** it pins the automatic path rather than the manual one, and the two are separate
behaviours — a boundary can have a working reset button and broken `resetKeys`.

Give the array primitives. A fresh object or array literal on each render is a new reference every
time, so the shallow compare fires the reset continuously and the test passes for the wrong reason.

---

## What is worth asserting

- Children render when nothing throws — the boundary is transparent in the ordinary case.
- The fallback replaces them when something does, and the children are gone rather than merely hidden.
- `onError` received the error and an `errorInfo` carrying a component stack.
- Reset restores the children, once the throwing condition is gone.
- A `resetKeys` change resets without any interaction.

Queries that find the fallback by its `role="alert"` also check the accessibility contract the
fallback owes, so prefer them over a test id.
