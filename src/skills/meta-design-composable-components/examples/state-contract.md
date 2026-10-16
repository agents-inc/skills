# Composable Components — State Contract Examples

> Full code for Patterns 4–5 in [SKILL.md](../SKILL.md). See [core.md](core.md) for the parts these hook into, and [reference.md](../reference.md) for the triple naming table and the change-details fields.

**Prerequisites:** Pattern 1 in [core.md](core.md) — the state contract is what the `Root` publishes through context.

---

## Pattern 4: Controlled and Uncontrolled State

Every exposed state is three props named after it — `open` / `defaultOpen` / `onOpenChange`, `value` / `defaultValue` / `onValueChange` — and the mode is decided by whether the controlled prop is `undefined`, never by a separate `controlled` flag.

### `useControllableState`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

interface ChangeEventDetails<TReason extends string> {
  /** Why the change happened, so consumers can run side effects conditionally. */
  readonly reason: TReason;
  /** The DOM event that caused the change, when there was one. */
  readonly event: Event | undefined;
  /** Stops the component from applying the change. */
  readonly cancel: () => void;
  readonly isCanceled: boolean;
}

interface UseControllableStateParams<TValue, TReason extends string> {
  readonly value: TValue | undefined;
  readonly defaultValue: TValue;
  readonly onChange?: (
    value: TValue,
    details: ChangeEventDetails<TReason>,
  ) => void;
  readonly componentName: string;
}

type SetControllableState<TValue, TReason extends string> = (
  value: TValue,
  details: ChangeEventDetails<TReason>,
) => void;

function useControllableState<TValue, TReason extends string>({
  value,
  defaultValue,
  onChange,
  componentName,
}: UseControllableStateParams<TValue, TReason>): readonly [
  TValue,
  SetControllableState<TValue, TReason>,
] {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const resolvedValue = isControlled ? value : uncontrolledValue;

  useModeChangeWarning(isControlled, componentName);

  const onChangeRef = useLatest(onChange);

  const setValue = useCallback<SetControllableState<TValue, TReason>>(
    (nextValue, details) => {
      onChangeRef.current?.(nextValue, details);
      if (details.isCanceled) return;
      if (!isControlled) setUncontrolledValue(nextValue);
    },
    [isControlled, onChangeRef],
  );

  return [resolvedValue, setValue] as const;
}
```

**Why good:** One resolved value is returned, so no call site asks which mode it is in. `onChange` fires before the internal update and in both modes, so consumer side effects are mode-independent. When controlled, the internal state is never written, so there is no second copy to drift. The callback is read through a ref, so an inline arrow from the consumer does not give `setValue` a new identity every render.

### The mode-change warning

```tsx
function useModeChangeWarning(
  isControlled: boolean,
  componentName: string,
): void {
  const initialModeRef = useRef(isControlled);

  useEffect(() => {
    if (initialModeRef.current === isControlled) return;
    const from = initialModeRef.current ? "controlled" : "uncontrolled";
    const to = isControlled ? "controlled" : "uncontrolled";
    console.error(
      `${componentName} is changing from ${from} to ${to}. ` +
        `Decide the mode for the lifetime of the component: either always pass a value, or never pass one.`,
    );
  }, [isControlled, componentName]);
}
```

**Why good:** Mode switching has a confusing symptom — the value appears to freeze or jump backwards — and usually comes from a `value={data?.selected}` that is `undefined` on the first render. The warning names the transition and the fix, and runs in an effect rather than during render, so StrictMode's double render does not log it twice.

### `useLatest`

```tsx
function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
```

### Building and consuming change details

```tsx
function createChangeEventDetails<TReason extends string>(
  reason: TReason,
  event?: Event,
): ChangeEventDetails<TReason> {
  let isCanceled = false;

  return {
    reason,
    event,
    cancel() {
      isCanceled = true;
    },
    get isCanceled() {
      return isCanceled;
    },
  };
}
```

The closure variable behind a getter is deliberate: a plain `isCanceled: false` field that `cancel()` reassigns through `this` breaks the moment a consumer destructures (`const { cancel } = details`), which is how it will be used.

Inside the component, every state change names its cause:

```tsx
const handleBackdropPress = (event: React.MouseEvent) => {
  setOpen(false, createChangeEventDetails("outside-press", event.nativeEvent));
};
```

And the consumer branches on it, or refuses it, without hoisting the state:

```tsx
<Dialog.Root
  onOpenChange={(open, details) => {
    if (!open && details.reason === "outside-press" && form.isDirty) {
      details.cancel();
      setShowDiscardPrompt(true);
      return;
    }
    if (!open) analytics.track("dialog_dismissed", { reason: details.reason });
  }}
>
```

**Why good:** The consumer keeps the component uncontrolled — no `open` prop, no `useState` — and still vetoes one dismissal path. Without `cancel()`, blocking one reason means taking full control of the state and reimplementing every path that should still work.

**Why a bare callback is bad:**

```tsx
// BAD: no reason, no veto
onOpenChange?: (open: boolean) => void;
```

The consumer cannot tell a submit-close from an Escape-close, so "save on close" also fires when the user backs out. The only way out is controlled mode plus a reimplementation of dismissal — the accessibility work the component existed to own.

### When cancel fits

`cancel()` fits changes the user initiated and a consumer might reasonably block: dismissal with unsaved work, selecting a locked row, a tab switch mid-validation. It does not fit changes that report reality rather than intent — a positioner reporting the side it landed on, a controlled value echoing back. A `cancel()` the component ignores is worse than none.

### Retrofitting an existing component

A component with `isOpen` + `onClose` becomes compliant in three steps, without breaking call sites in one commit:

```tsx
// Step 1 — add the missing pieces beside the old ones
interface DialogRootProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (
    open: boolean,
    details: ChangeEventDetails<DialogChangeReason>,
  ) => void;
}

// Step 2 — route every internal close through setOpen(false, details),
//          so `onClose` becomes a thin adapter over onOpenChange

// Step 3 — migrate call sites, then delete the adapter
```

**Why this order:** step 2 is where behaviour changes — once every dismissal path produces a reason, the component is correct even for consumers still on the old props. Deleting the old props first forces every call site into one commit and hides the behavioural change inside a mechanical rename.

---

## Pattern 5: State as Data Attributes

### Enumerated states are values, boolean states are presence

```tsx
function toStateAttributes(state: TriggerState): Record<string, string> {
  return {
    "data-state": state.open ? "open" : "closed",
    "data-side": state.side,
    ...(state.disabled ? { "data-disabled": "" } : null),
    ...(state.pressed ? { "data-pressed": "" } : null),
  };
}
```

```css
/* The consumer's stylesheet — the component knows none of this */
[data-state="open"] {
  opacity: 1;
}
[data-state="closed"] {
  opacity: 0;
}
[data-disabled] {
  pointer-events: none;
}
[data-side="top"] {
  --arrow-rotation: 180deg;
}
```

**Why good:** Visual state lives entirely in CSS. Opening a popup does not re-render the consumer's tree, because nothing had to travel back out through props to reach a class name.

```tsx
// BAD: booleans written as values
<button data-disabled={disabled} data-open={open} />
```

**Why bad:** React writes a boolean on a `data-*` or `aria-*` attribute as the string `"true"` or `"false"`, and removes the attribute only for `null` and `undefined`. `data-disabled="false"` is present, so `[data-disabled]` matches and every disabled style applies to enabled elements. Spread the attribute conditionally, or write `data-disabled={disabled ? "" : undefined}`.

### Two vocabularies

| Shape                                   | Reads as                          | Trade-off                                         |
| --------------------------------------- | --------------------------------- | ------------------------------------------------- |
| `data-state="open" \| "closed"`         | One attribute, mutually exclusive | One selector per state; easy to enumerate         |
| `data-open` / `data-closed` as presence | One attribute per state           | Simpler selectors; more attributes on the element |

Both ship in current libraries. Pick one per library and never mix them — a consumer who learns `[data-state="open"]` on one part and needs `[data-open]` on the next has to read the source of every part.

### State-driven `className` and `style`

Handing the state object to the styling props removes the last reason to lift state out:

```tsx
<Switch.Thumb className={(state) => (state.checked ? "thumb thumb--on" : "thumb")} />
<Switch.Thumb style={(state) => ({ transform: `translateX(${state.checked ? "100%" : "0"})` })} />
```

**Why good:** A consumer whose styling tool cannot express attribute selectors still gets the state, without a `renderThumb` prop or a mirrored `checked` in their own state. Support the function form in addition to the attributes, never instead — the attributes are what make pure-CSS styling possible.

### Entry and exit animation

An exit animation needs the element mounted after the state says "closed". Publish that as attributes rather than an `isExiting` prop:

```tsx
// Mounted and closing: data-state="closed" plus an explicit ending-style marker
<div data-state="closed" data-ending-style="" />
```

**Why good:** The consumer writes the transition in CSS and the component unmounts when it ends. A `transitionDuration` prop duplicates a number that already lives in the stylesheet, and drifts from it.
