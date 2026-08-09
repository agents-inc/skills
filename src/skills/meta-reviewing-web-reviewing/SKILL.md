---
name: meta-reviewing-web-reviewing
description: UI component review patterns. Use when reviewing React components, hooks, props, state, styling, and accessibility. Covers rules of hooks, effect cleanup, render performance, list keys, keyboard and ARIA patterns.
---

# Web Code Review Patterns

> **Quick Guide:** When a diff touches UI components, verify hooks obey the rules of hooks with complete dependency arrays, effects clean up what they set up, list keys are stable, and interactive elements the diff adds are reachable by keyboard with accessible names. Judge performance concerns against evidence in the diff, not against a memoize-everything ideal.

---

<critical_requirements>

## CRITICAL: Before Reviewing Web Code

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST verify hooks are called unconditionally at top level, with dependency arrays that name every value the callback reads)**

**(You MUST verify every effect that subscribes, registers a listener, or starts a timer returns a cleanup function)**

**(You MUST check every interactive element the diff adds for keyboard reachability and an accessible name)**

**(You MUST verify list keys are stable identities, not array indexes on lists that can reorder)**

**(You MUST check memoization against evidence: flag a missing memo only for a demonstrable cost in the diff, and flag speculative memo/useCallback wrapping as churn)**

</critical_requirements>

---

**Auto-detection:** review component, React PR review, hooks review, JSX diff, component code review, accessibility review, a11y check, re-render review

**When to use:**

- Reviewing diffs containing React components (`.tsx`/`.jsx` with JSX)
- Reviewing custom hooks, effects, or state management inside components
- Checking accessibility of new or changed interactive UI
- Evaluating render-performance claims or concerns in a diff
- Reviewing controlled form inputs and event handling

**When NOT to use:**

- When implementing components (use the relevant web implementation skill)
- For server routes, configs, or build tooling in the same diff (use the API/infra reviewing skills)
- For visual design judgments a spec does not define

**Key patterns covered:**

- Rules of hooks and dependency-array completeness
- Effect cleanup for subscriptions, listeners, and timers
- Props and state typing
- Evidence-based render performance review
- List keys and reconciliation
- Controlled components and event handling
- Accessibility for diff-added interactive elements

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Good/bad component patterns to look for during review

---

<philosophy>

## Philosophy

**Review the component the diff builds, not the component you would have built.** React offers many valid shapes for the same UI; flag deviations from the codebase's established patterns and genuine defects, not alternatives.

**When reviewing web code:**

- Trace each hook's dependency array against what its callback actually reads
- Trace each effect to its cleanup - what it starts, something must stop
- Walk the keyboard path through any UI the diff adds: can you reach it, operate it, and see focus?
- Treat state as the source of truth: derived values should be computed, not mirrored into more state

**When NOT to flag:**

- Don't demand `React.memo`, `useMemo`, or `useCallback` without a demonstrable cost in the diff - speculative memoization is churn that obscures the data flow
- Don't demand component extraction for a component that is long but linear
- Don't flag inline styles or styling choices that follow the file's existing approach
- Don't request accessibility work on elements the diff did not touch

**Core principles:**

- **Correctness first**: stale closures and missing cleanup are bugs, not style
- **Accessibility is scoped to the diff**: everything added must be operable; everything untouched is not this review's job
- **Evidence over ideal**: performance feedback cites a cost the diff creates
- **State minimalism**: the fewer sources of truth, the fewer ways to disagree

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Rules of Hooks and Dependency Arrays

Hooks must be unconditional and their dependency arrays complete.

```markdown
## Hooks Review

For EACH hook call in the diff:

- [ ] Called at top level - not inside conditionals, loops, or early-return paths
- [ ] Dependency array names every prop, state value, and function the callback reads
- [ ] No dependency silenced with an eslint-disable that lacks a justifying comment
- [ ] Functions used as dependencies are stable (defined outside, or wrapped where identity matters)
```

```typescript
// Must Fix: stale closure - `filter` is read but not declared
useEffect(() => {
  fetchItems(filter).then(setItems);
}, []); // runs once, forever using the first render's filter

// Good: complete dependencies
useEffect(() => {
  fetchItems(filter).then(setItems);
}, [filter]);
```

**Why this matters:** An incomplete dependency array pins the callback to stale values. The bug is invisible until the value changes, then the UI silently shows old data.

---

### Pattern 2: Effect Cleanup

What an effect starts, its cleanup must stop.

```markdown
## Effect Cleanup Review

For EACH effect the diff adds or changes:

- [ ] Subscriptions are unsubscribed in the returned cleanup
- [ ] Event listeners added to window/document are removed
- [ ] Timers (setTimeout/setInterval) are cleared
- [ ] In-flight async work is guarded (AbortController or a cancelled flag) before setState
```

```typescript
// Must Fix: listener leaks on every unmount/remount
useEffect(() => {
  window.addEventListener("resize", onResize);
}, [onResize]);

// Good: symmetric cleanup
useEffect(() => {
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, [onResize]);
```

**Why this matters:** Missing cleanup leaks listeners and timers, and setState after unmount throws warnings and hides real errors under noise.

---

### Pattern 3: Props and State Typing

Types should describe the component's real contract.

```markdown
## Props and State Review

- [ ] Props interface/type is explicit - no `any`, no over-wide `object`/`Function`
- [ ] Optional props are genuinely optional (component behaves without them)
- [ ] State is minimal: values derivable from props/state are computed, not stored
- [ ] Derived state is not mirrored with an effect that copies props into state
```

```typescript
// Should Fix: mirrored state drifts from its source
const [name, setName] = useState(user.name);
useEffect(() => setName(user.name), [user.name]);

// Good: derive it
const name = user.name;
```

**Why this matters:** Every duplicated source of truth is a future inconsistency; effects that sync state are the classic source of render loops.

---

### Pattern 4: Render Performance - Evidence Before Memoization

Performance feedback must point at a cost the diff creates.

```markdown
## Performance Review

Flag ONLY with evidence in the diff:

- [ ] A genuinely expensive computation (large sort/filter/parse) running on every render → suggest useMemo
- [ ] A new object/array/function literal passed to a memoized child, defeating its memo → stabilize it
- [ ] State lifted so high that broad subtrees re-render on every keystroke → suggest lowering it

Do NOT flag:

- Plain components without React.memo - that is the default, not a defect
- Inline handlers passed to plain DOM elements or non-memoized children
- useMemo around cheap expressions
```

```typescript
// Don't Mention: cheap derivation, memo would be noise
const label = `${first} ${last}`;

// Should Fix: expensive work re-runs on every keystroke of an unrelated input
const ranked = rankResults(allResults); // 10k items, in render body
// → const ranked = useMemo(() => rankResults(allResults), [allResults]);
```

**Why this matters:** Blanket memoization advice rewards volume over insight and adds indirection with no measured benefit. The review should catch real costs and equally catch speculative wrapping.

---

### Pattern 5: List Keys and Reconciliation

Keys are identities, not positions.

```typescript
// Must Fix: index keys on a reorderable/filterable list
{items.map((item, i) => <Row key={i} item={item} />)}

// Good: stable identity
{items.map((item) => <Row key={item.id} item={item} />)}
```

**Why this matters:** Index keys make React reuse component state across different items when the list reorders - checkboxes stay checked on the wrong row.

---

### Pattern 6: Controlled Components and Event Handling

An input is controlled or uncontrolled - not both.

```markdown
## Controlled Input Review

- [ ] `value` is always paired with `onChange` (or the input is deliberately uncontrolled via defaultValue)
- [ ] The value passed is never undefined-then-defined across renders (controlled/uncontrolled flip)
- [ ] Handlers receive typed events, not `any`
- [ ] Form submission prevents default before async work
```

**Why this matters:** A controlled/uncontrolled flip throws warnings and drops user input; untyped handlers hide event misuse.

---

### Pattern 7: Accessibility

Everything interactive the diff adds must be operable without a mouse.

```markdown
## Accessibility Review (diff-added elements only)

- [ ] Semantic elements used: button for actions, a for navigation - not onClick on div/span
- [ ] Every form input has an associated label (htmlFor/id, wrapping label, or aria-label)
- [ ] Icon-only buttons carry an accessible name (aria-label)
- [ ] Custom interactive widgets are keyboard-operable and show focus
- [ ] Focus is managed where the diff moves it: dialogs trap and restore focus on close
- [ ] ARIA attributes added are valid and necessary - semantic HTML needs no aria-role restating
```

```tsx
// Must Fix: unreachable by keyboard, no accessible name
<div onClick={openSettings}><GearIcon /></div>

// Good: semantic, named, focusable for free
<button type="button" aria-label="Open settings" onClick={openSettings}>
  <GearIcon />
</button>
```

**Why this matters:** A `div` with onClick is invisible to keyboard and screen-reader users. Semantic elements deliver focus, activation, and naming for free - the review's job is to catch the places the diff opted out.

</patterns>

---

<decision_framework>

## Decision Framework

### Severity Classification for Web Issues

```
Is this a correctness or accessibility defect the diff introduces?
├─ Incomplete dependency array reading changing values → MUST FIX
├─ Effect without cleanup for listener/timer/subscription → MUST FIX
├─ Conditional hook call → MUST FIX
├─ Index keys on a reorderable list → MUST FIX
├─ Diff-added interactive element unreachable by keyboard or unnamed → MUST FIX
└─ NO → Does it degrade maintainability or real performance?
    ├─ Demonstrably expensive computation in render body → SHOULD FIX
    ├─ Fresh literal defeating an existing memoized child → SHOULD FIX
    ├─ Props mirrored into state with a sync effect → SHOULD FIX
    ├─ Untyped props or `any` in handlers → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Extracting a reusable hook two components now duplicate → NICE TO HAVE
        ├─ React.memo without a measured re-render cost → DON'T MENTION
        ├─ Component decomposition preference → DON'T MENTION
        └─ Styling taste within the file's existing approach → DON'T MENTION
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (Must Fix):**

- `useEffect`/`useMemo`/`useCallback` with an empty or incomplete dependency array reading values that change
- Listener, timer, or subscription started in an effect with no cleanup
- Hook called inside a conditional, loop, or after an early return
- `key={index}` on a list that can reorder, filter, or insert
- `onClick` on non-interactive elements with no keyboard path
- Form inputs with no associated label

**Medium Priority Issues (Should Fix):**

- setState after await with no unmount/abort guard
- Props copied into state and synced with an effect
- New object/array/function literal passed each render to a `React.memo` child
- `any`-typed props, events, or refs
- Controlled input whose value can be undefined on first render

**Common Mistakes:**

- Silencing exhaustive-deps instead of restructuring the dependency
- Deriving state in an effect when a plain expression would do
- Treating `useCallback` as free - it costs a dependency array to maintain
- Spreading unknown props onto DOM elements (leaks invalid attributes)

**Gotchas & Edge Cases:**

- A function dependency re-created each render makes the effect run each render - the fix may belong at the definition site, not the array
- Cleanup runs before every re-invocation, not only on unmount
- StrictMode double-invokes effects in dev - "runs twice" is not a bug report
- `aria-*` attributes on the wrong element are worse than none - verify against the pattern, don't just count them

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST verify hooks are called unconditionally at top level, with dependency arrays that name every value the callback reads)**

**(You MUST verify every effect that subscribes, registers a listener, or starts a timer returns a cleanup function)**

**(You MUST check every interactive element the diff adds for keyboard reachability and an accessible name)**

**(You MUST verify list keys are stable identities, not array indexes on lists that can reorder)**

**(You MUST check memoization against evidence: flag a missing memo only for a demonstrable cost in the diff, and flag speculative memo/useCallback wrapping as churn)**

**Failure to catch these issues will result in components that leak listeners, render stale data, lose user input on reorder, and lock out keyboard users.**

</critical_reminders>
