# Composable Components - State Contract

> The controlled/uncontrolled hook, the change-details object with reason and cancelation, and publishing state to the DOM as `data-*` attributes. See [SKILL.md](../SKILL.md) for decision frameworks and [core.md](core.md) for the compound parts these hook into.

**Prerequisites**: Understand compound parts and context scoping from [core.md](core.md) first -- the state contract is what the `Root` publishes through that context.

---

## The Triple

Every piece of state a component owns is exposed three ways at once:

| Prop            | Role                       | Present when                             |
| --------------- | -------------------------- | ---------------------------------------- |
| `value`         | Controlled value           | The consumer owns the state              |
| `defaultValue`  | Uncontrolled initial value | The component owns the state (read once) |
| `onValueChange` | Change notification        | Always -- fires in both modes            |

The names follow the state: `open` / `defaultOpen` / `onOpenChange`, `checked` / `defaultChecked` / `onCheckedChange`, `value` / `defaultValue` / `onValueChange`. The mode is decided by whether the controlled prop is `undefined`, not by a separate `controlled` flag.

---

## `useControllableState`

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

interface ChangeEventDetails<TReason extends string> {
  /** Why the change happened -- lets consumers run side effects conditionally. */
  readonly reason: TReason;
  /** The DOM event that caused the change, when there was one. */
  readonly event: Event | undefined;
  /** Stops the component from applying the change. */
  cancel: () => void;
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

**Why good:** One resolved value is returned, so no call site ever has to ask which mode it is in. `onChange` fires before the internal update and in both modes, so consumer side effects are mode-independent. When controlled, the internal state is never written, so there is no second copy to drift. The callback is read from a ref, so a consumer passing an inline arrow function does not invalidate `setValue` on every render.

### The Mode-Change Warning

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

**Why good:** Mode switching is a real bug with a confusing symptom -- the value appears to freeze or to jump backwards -- and it usually comes from a `value={data?.selected}` that is `undefined` on the first render. The warning names the transition and the fix. Keep the check out of render so it does not fire twice under StrictMode.

### The `useLatest` Helper

```tsx
function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
```

---

## Building and Consuming Change Details

```tsx
type DialogChangeReason =
  | "trigger-press"
  | "close-press"
  | "backdrop-press"
  | "escape-key"
  | "outside-press";

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

The closure variable behind a getter is deliberate: a plain `isCanceled: false` field that `cancel()` reassigns on `this` breaks the moment a consumer destructures (`const { cancel } = details`), which is exactly how it will be used.

Inside the component, every state change names its cause:

```tsx
const handleBackdropPress = (event: React.MouseEvent) => {
  setOpen(false, createChangeEventDetails("backdrop-press", event.nativeEvent));
};
```

And the consumer can branch on it, or refuse it, without hoisting the state:

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

**Why good:** The consumer keeps the component uncontrolled -- no `open` prop, no `useState` -- and still vetoes a specific dismissal path. Without `cancel()`, the only way to block one dismissal reason is to take full control of the state and reimplement every path that should still work.

**Why a bare callback is bad:**

```tsx
// BAD: no reason, no veto
onOpenChange?: (open: boolean) => void;
```

The consumer cannot tell a submit-close from an Escape-close, so "save on close" also fires when the user backs out. The only escape is controlled mode plus a reimplementation of dismissal, which is exactly the accessibility work the component existed to own.

### Cancelation Is Not Always Appropriate

`cancel()` fits changes the user initiated and a consumer might reasonably block: dismissal with unsaved work, selecting a locked row, a tab switch mid-validation. It does not fit changes that reflect reality rather than intent -- a positioner reporting `data-side` after measurement, or a controlled value echoing back. Ship it where a veto is meaningful; a `cancel()` the component ignores is worse than none.

---

## State as `data-*` Attributes

### Enumerated States Are Values, Boolean States Are Presence

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
/* The consumer's stylesheet -- the component knows none of this */
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
// BAD: boolean written as a value
<button data-disabled={disabled} data-open={open} />
```

**Why bad:** React renders `data-disabled="false"` for `false` -- the attribute is present, so `[data-disabled]` matches and every disabled style applies to enabled elements. (React omits the attribute for `undefined` and `null`, not for `false`, on `data-*` and `aria-*` attributes.) Either spread the attribute conditionally, or write `data-disabled={disabled ? "" : undefined}`.

### Two Valid Vocabularies

| Shape                                            | Reads as                          | Trade-off                                         |
| ------------------------------------------------ | --------------------------------- | ------------------------------------------------- |
| `data-state="open" \| "closed"`                  | One attribute, mutually exclusive | One selector per state; easy to enumerate         |
| `data-open` / `data-closed` as separate presence | One attribute per state           | Simpler selectors; more attributes on the element |

Both are current in shipping libraries. Pick one per library and never mix them -- a consumer who learns `[data-state="open"]` on one part and needs `[data-open]` on the next has to read the source of every part.

### State-Driven `className` and `style`

Exposing the state object to the styling props removes the last reason to lift state out:

```tsx
<Switch.Thumb className={(state) => (state.checked ? "thumb thumb--on" : "thumb")} />
<Switch.Thumb style={(state) => ({ transform: `translateX(${state.checked ? "100%" : "0"})` })} />
```

**Why good:** A consumer whose styling tool cannot express attribute selectors still gets the state, without the component publishing a `renderThumb` prop or the consumer mirroring `checked` in their own state. Support the function form _in addition to_ the data attributes, never instead of them -- the attributes are what make pure-CSS styling possible.

### Entry and Exit Animation

An exit animation needs the element to stay mounted after the state says "closed". Publish that as its own attributes rather than as a `isExiting` prop:

```tsx
// Mounted, closing: data-state="closed" plus an explicit ending-style marker
<div data-state="closed" data-ending-style="" />
```

**Why good:** The consumer writes the transition in CSS and the component unmounts when the transition ends. A `transitionDuration` prop, by contrast, duplicates a number that already exists in the stylesheet and drifts from it.

**Gotcha:** attributes written after measurement -- `data-side`, `data-align` -- can differ between first paint and the layout effect that positions the element. Drive entry animations off the explicit starting-style attribute, not off mount, or the animation plays from the wrong side.

---

## Alignment: Retrofitting the Triple

An existing component with `isOpen` + `onClose` becomes compliant in three steps, without breaking call sites in the same commit:

```tsx
// Step 1 -- add the missing pieces, keep the old ones working
interface DialogRootProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (
    open: boolean,
    details: ChangeEventDetails<DialogChangeReason>,
  ) => void;
}

// Step 2 -- route every internal close through setOpen(false, details),
//           so `onClose` becomes a thin adapter over onOpenChange

// Step 3 -- migrate call sites, then delete the adapter
```

**Why this order:** step 2 is where the behavior actually changes -- once every dismissal path produces a reason, the component is correct even for consumers still on the old props. Deleting the old props first forces every call site into one commit and hides the behavioral change inside a mechanical rename.
