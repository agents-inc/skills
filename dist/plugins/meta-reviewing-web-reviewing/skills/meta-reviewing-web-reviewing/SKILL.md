---
name: meta-reviewing-web-reviewing
description: React component review — hook rules, effect cleanup, derived state, keys, memoization evidence and keyboard access. Load when reviewing a diff that adds or changes React components or hooks.
---

# React Component Review Patterns

> **Quick Guide:** Trace what changes between renders — dependency arrays, cleanups, keys, component identity — before judging what one render shows. Accessibility is checked for the elements the diff adds. A performance finding names a cost the diff creates, and where React Compiler is on, memoization is the compiler's job. Three version facts change a finding: `use()` may be called conditionally (React 19), `useEffectEvent` takes event logic out of an effect's dependencies (React 19.2), and since React 18 setting state after unmount is silent.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — each pattern's defect and its fix, as a reviewer meets them in a diff

---

<critical_requirements>

## Before reviewing a React diff

**Trace each hook's dependency array against what its callback reads.** A value read but not listed stays pinned to the render that created the callback, so the UI shows stale data once that value changes, and nothing errors.

**Pair everything an effect or ref callback starts with a cleanup that stops it.** Without one, each re-run adds another listener, timer or subscription, and the last one outlives the component.

**Check that every interactive element the diff adds is reachable and operable by keyboard, shows where focus is, and has an accessible name.** A native `<button>` or `<a href>` brings focus, keyboard activation and a role, and an `onClick` on a `<div>` brings none of them; a style that removes the focus outline leaves a keyboard user unable to see where they are.

**Check that list keys come from the data's identity.** React matches children across renders by key, so an index key hands one row's state to another when the list reorders, filters or inserts.

**Ask for memoization only where the diff creates a cost you can name.** Re-rendering is React's default rather than a defect, and a finding with no measured cost is one the author has no way to verify.

</critical_requirements>

---

**Auto-detection:** `useEffect`, `useLayoutEffect`, `useEffectEvent`, `useMemo`, `useCallback`, `React.memo`, `use()`, `react-hooks/exhaustive-deps`, `react-hooks/rules-of-hooks`, `key={index}`, `onClick` on a `div`, `htmlFor`, `aria-label`, `showModal`, `defaultValue`, `preventDefault`, `.tsx` diff, `.jsx` diff, React PR review, component review

**Applies to:**

- Diffs that add or change React components or custom hooks
- Hook call order, dependency arrays, and suppressions of the hooks lint rules
- Cleanup for effects and ref callbacks, and async results that arrive out of order
- Props typing, and derived versus mirrored state
- List keys and component identity
- Controlled inputs and form submission handlers
- Whether a render-performance finding has evidence behind it
- Keyboard and screen-reader access for the elements the diff adds

**Handled elsewhere:**

- The severity scale, the approval decision and how a finding is written — the general review discipline; this skill only places React defects on that scale
- Server routes, build configuration and CI changes in the same diff — each is reviewed against its own domain's checks
- A full accessibility audit — contrast, live regions and the complete keyboard contract of complex widgets; this review covers what the diff adds
- Visual design the spec does not define
- The choice of styling approach — the file's existing one is the yardstick

---

<philosophy>

## Philosophy

**Review the component the diff builds, not the one you would have built.** React allows many valid shapes for the same UI, so a finding is a defect or a departure from the codebase's own pattern — never an alternative.

React's defects live in time rather than in one render. A callback closing over an old value, a resource outliving its effect, state following a slot instead of an item: each reads correctly on the page in front of you and fails on the next render. That is why the checks below trace what changes between renders, and why a diff that looks right can still be wrong.

</philosophy>

---

<decision_framework>

## Where React findings land

These place React defects on the general severity scale. Nice to Have — tests beyond adequate, documentation, a labelled idea — has no React-specific case.

```
Would leaving it break behaviour — a stale read, a leak, lost state or input,
a control some users cannot operate?
├─ A hook callback reads a changing value its array omits → MUST FIX
├─ A hook called in a condition, loop or after an early return (use() excepted) → MUST FIX
├─ A listener, timer, subscription or observer started with no cleanup → MUST FIX
├─ An index or render-generated key on a list that reorders, filters or inserts → MUST FIX
├─ A component defined inside another component's body → MUST FIX
├─ value on an input with neither onChange nor readOnly → MUST FIX
├─ An added control no keyboard reaches or no screen reader names → MUST FIX
└─ NO → Is the cost concrete in this diff?
    ├─ An async result set in an effect with no ignore flag or abort — a race → SHOULD FIX
    ├─ Props copied into state by an effect — a stale render, then drift → SHOULD FIX
    ├─ An input value that starts undefined or null — a mode switch React warns about → SHOULD FIX
    ├─ Work measured near 1ms or more, re-run by updates unrelated to its inputs → SHOULD FIX
    ├─ A fresh literal defeating a memo child the codebase placed (compiler off) → SHOULD FIX
    ├─ A react-hooks suppression with no stated reason — a deviation in the changed lines → SHOULD FIX
    ├─ any on props, events or refs — a wrong field access now compiles → SHOULD FIX
    ├─ useMemo/useCallback the diff adds with no demonstrable cost to avoid — churn → SHOULD FIX
    ├─ Hook logic two components in the diff now duplicate — the copies drift; extract a custom hook → SHOULD FIX
    └─ NO → don't write it
        ├─ No memoization, and no measured cost
        ├─ Splitting a long component that reads top to bottom
        ├─ Styling that follows the file's existing approach
        └─ Accessibility of elements the diff did not touch
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Rules of hooks and dependency arrays

React identifies each hook by its call order, so a hook skipped on one render shifts every later hook onto another's state, or changes the count and makes React throw. The dependency array is the only way React learns what a callback reads.

- Hooks run at the top level of a component or custom hook — never in a condition, loop, nested function or `try`/`catch`, or after an early `return`. `use()` is the exception: it may sit in a condition or loop, though not in `try`/`catch`.
- Every prop, state value and function a hook's callback reads is in its array.
- A suppressed `react-hooks/exhaustive-deps` or `react-hooks/rules-of-hooks` needs a stated reason. The linter can no longer check the next edit to that hook, and React Compiler skips the whole function. Where the project runs these rules, unsuppressed violations are already caught, so the suppressions are where review earns its time.
- A value an effect reads but should not re-run for — the theme in a "connected" notice — moves into `useEffectEvent` (React 19.2+), not out of the array. An Effect Event is called only from effects and listed in no array, and using one to drop a dependency that should re-run the effect hides the stale read instead of fixing it.

```typescript
useEffect(() => {
  fetchItems(filter).then(setItems);
}, []); // Must Fix: reads `filter`, lists nothing, keeps the first render's value
```

Full code: [examples/core.md](examples/core.md#pattern-1-rules-of-hooks-and-dependency-arrays)

### Pattern 2: Effect and ref cleanup

React runs an effect's cleanup with the old values before each re-run and once on unmount, and Strict Mode adds one setup-and-cleanup cycle in development to expose a missing one.

- Subscriptions unsubscribe, listeners on `window` or `document` are removed, timers are cleared and observers disconnect.
- A ref callback that sets something up returns the cleanup that tears it down (React 19).
- An async result set from an effect is guarded with an ignore flag or an `AbortController`. Responses arrive out of order, so a slow early one overwrites a fast later one — and React 18 removed the warning about setting state after unmount, so the console no longer hints at it.

```typescript
useEffect(() => {
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, [onResize]);
```

Full code: [examples/core.md](examples/core.md#pattern-2-effect-and-ref-cleanup)

### Pattern 3: Props and state

Types state the component's real contract, and every value has one source of truth.

- Props are typed explicitly — no `any`, no over-wide `object` or `Function` — and an optional prop is one the component works without.
- A value computable from props or state is computed during render. Copied into state by an effect, it renders once stale and again corrected, and the copies can drift; the `react-hooks/set-state-in-effect` lint rule flags the synchronous form.
- State seeded from a prop and then edited — a draft — resets through a `key` on the component when the prop names a different item, not through an effect.

```typescript
// Should Fix: a second source of truth, corrected one render late
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${user.first} ${user.last}`);
}, [user.first, user.last]);
```

Full code: [examples/core.md](examples/core.md#pattern-3-props-and-state)

### Pattern 4: Evidence before memoization

A performance finding names a cost the diff creates, and which costs count depends on whether React Compiler is on — `babel-plugin-react-compiler` in the dependencies, or a framework's compiler option enabled.

- **Compiler off.** Flag slow work in the render body — measured near 1ms or more, or looping over thousands of items — that updates unrelated to its inputs keep re-running; a fresh object, array or function passed to a `memo` child, which compares props by reference and so never skips; state lifted so high that a keystroke re-renders broad subtrees.
- **Compiler on.** A missing `memo`, `useMemo` or `useCallback` is never a finding, because the compiler memoizes components and values itself. Manual memoization the diff adds is an escape hatch, earned where an effect dependency's identity has to hold still. Removing existing memoization can change the compiled output, so it needs evidence the behaviour held.
- **Either way.** A component without `memo` and an inline handler on a DOM element or a non-memoized child are not findings. Flag a missing memo only for a demonstrable cost in the diff, and flag speculative `memo`/`useMemo`/`useCallback` wrapping the diff adds — `useMemo` around a cheap expression included — as churn, Should Fix: each wrapper adds a dependency array to keep correct and noise to read, for no measured gain.

```typescript
// Should Fix: a measured 10k-row sort, re-run by every keystroke in an unrelated input
const ranked = rankResults(allResults);

// Don't write it: cheap, so memoizing it buys nothing
const label = `${first} ${last}`;
```

Full code: [examples/core.md](examples/core.md#pattern-4-evidence-before-memoization)

### Pattern 5: List keys and component identity

React keeps state by position and component type; a key replaces position with identity.

- Keys come from the data — `item.id`, not the index. On a list that reorders, filters or inserts, an index key gives one row's checkbox or half-typed input to the item that moves into its slot. An index is safe on a list whose order never changes.
- Keys are never generated during render. `key={Math.random()}` matches nothing on the next render, so every row remounts and drops its input.
- Components are defined at module level. One defined inside another's body is a new type on every render, so React discards its state and DOM whenever the parent renders; the `react-hooks/static-components` lint rule flags it.

```typescript
{items.map((item, i) => <Row key={i} item={item} />)} // Must Fix where the list reorders
{items.map((item) => <Row key={item.id} item={item} />)}
```

Full code: [examples/core.md](examples/core.md#pattern-5-list-keys-and-component-identity)

### Pattern 6: Controlled inputs and form submission

An input is controlled or uncontrolled for its whole life.

- `value` comes with `onChange` or `readOnly`; without either React renders a field nobody can type into. An uncontrolled input takes `defaultValue`.
- `value` is a string from the first render. One that starts `undefined` or `null` leaves the input uncontrolled until it becomes a string, and React warns at the switch; `value={draft ?? ""}` keeps it controlled.
- `onChange` sets state synchronously — a deferred update makes the caret jump.
- An `onSubmit` handler calls `preventDefault()` before its first `await`; by the time the await resumes, the browser has submitted. A function passed to `<form action>` needs no `preventDefault`, because React runs it in a transition (React 19).
- Handlers take typed events rather than `any`. Current `@types/react` deprecates `FormEvent`: `onChange` takes `ChangeEvent` and `onSubmit` takes `SubmitEvent`.

```typescript
async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
  event.preventDefault(); // before any await, or the browser has already submitted
  await save(new FormData(event.currentTarget));
}
```

Full code: [examples/core.md](examples/core.md#pattern-6-controlled-inputs-and-form-submission)

### Pattern 7: Accessibility of what the diff adds

Everything interactive the diff adds works without a mouse and announces a name.

- Actions are `<button type="button">` and navigation is `<a href>`. An `onClick` on a `<div>` or `<span>` cannot take focus, ignores Enter and Space, and announces nothing.
- Every input has an associated label — `htmlFor` and `id`, a wrapping `<label>`, or `aria-label`. A placeholder is not a label.
- An icon-only button has an accessible name, and its icon is `aria-hidden`.
- A custom widget handles its own keys and shows focus; an ARIA role supplies the word, never the behaviour.
- Where the diff moves focus or removes the focused element — deleting a row, opening a menu, swapping a view — focus lands somewhere deliberate. A removed element drops focus to the document body, and a keyboard user starts again from the top.
- A modal moves focus in on open, keeps it inside, closes on Escape and returns focus to its trigger. A native `<dialog>` opened with `showModal()` gets all four from the browser; a hand-built `role="dialog"` owes each one.
- ARIA the diff adds is valid and necessary. A role restating the element's own semantics adds nothing, and a wrong one misdescribes the UI to a screen reader.

```tsx
// Must Fix: unreachable by keyboard, announced as nothing
<div onClick={openSettings}><GearIcon /></div>

// A native control brings focus, Enter and Space, and a role; the label brings the name
<button type="button" aria-label="Open settings" onClick={openSettings}>
  <GearIcon aria-hidden="true" />
</button>
```

Full code: [examples/core.md](examples/core.md#pattern-7-accessibility-of-what-the-diff-adds)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `use()` inside `try`/`catch` — it throws to suspend, so the catch intercepts the suspension; a rejected promise belongs to an error boundary.
- An Effect Event in a dependency array, passed to a child or called during render — its identity changes every render, so in an array it re-runs the effect each time; the hooks linter rejects all three.
- An effect that sets state its own dependency array depends on — the update re-renders, the dependency changes and the effect runs again, without end. Effects that sync one piece of state into another are the usual source.
- A `useRef` flag added so an effect "runs once" — it silences the missing cleanup Strict Mode exposed, and the resource still piles up across remounts. The cleanup is the fix.
- A `<button>` inside a `<form>` without `type="button"` — the default type is `submit`, so clicking it submits the form.
- `<dialog open>` — a dialog rendered open is non-modal: Tab still reaches the page behind it and Escape does nothing. Modal behaviour comes only from `showModal()`.
- A whole props object spread onto a DOM element — props meant for the component reach the DOM, and React warns about each one it does not recognise.

**Surprising behaviour:**

- Cleanup runs before every re-run, not only on unmount, so a cleanup written as an unmount handler fires on each dependency change.
- Strict Mode runs one extra setup and cleanup for every effect and ref callback in development. "Runs twice" is that check working, not a bug report.
- A function recreated each render and listed as a dependency re-runs the effect each render. The fix sits at the definition — inside the effect, or outside the component — not in the array.
- A native `<dialog>` closed by Escape closes without asking React, so state that tracks it as open has to follow its `close` event.
- A suppressed `react-hooks` rule makes React Compiler skip the whole component or hook, so it loses automatic memoization along with the lint check.
- `aria-*` on the wrong element misdescribes the UI, which is worse than leaving it off — check each attribute against the pattern it claims rather than counting them.

</red_flags>
