# Base UI - Styling Examples

> State functions, data-attribute selectors, CSS variables and animation. See [core.md](core.md) for anatomy and positioning.

**Prerequisites**: Understand [Pattern 1: Part Anatomy](core.md#pattern-1-part-anatomy).

---

## Pattern 8: State Functions vs Data Attributes

### Good Example - CSS Attribute Selectors (Preferred)

```tsx
import { Switch } from "@base-ui/react/switch";

<Switch.Root className="switch">
  <Switch.Thumb className="thumb" />
</Switch.Root>;
```

```css
.switch {
  background: var(--color-neutral);
}
.switch[data-checked] {
  background: var(--color-accent);
}
.switch[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}

.thumb {
  transform: translateX(0);
  transition: transform 120ms;
}
.thumb[data-checked] {
  transform: translateX(100%);
}
```

**Why good:** the state never enters JavaScript, so a visual change costs no re-render and no per-transition string allocation, and the selectors stay editable by anyone working in the CSS alone

### Good Example - The className Function, Where a Selector Cannot Reach

```tsx
<Switch.Thumb className={(state) => (state.checked ? "thumb thumb--on" : "thumb")} />
<Switch.Thumb style={(state) => ({ color: state.checked ? "red" : "blue" })} />
```

**Why good:** the function form is the escape hatch for class names that must be computed — a lookup into a generated class map, or a set of classes with no attribute-selector equivalent

**When to use:** only when the class name genuinely cannot be expressed as an attribute selector. The function re-runs on every state change; an attribute selector costs nothing.

### Bad Example - Mirroring State into React to Drive Styles

```tsx
import { useState } from "react";
import { Popover } from "@base-ui/react/popover";

function BadPopover() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root onOpenChange={setOpen}>
      <Popover.Trigger className={open ? "trigger trigger--open" : "trigger"}>
        Menu
      </Popover.Trigger>
      {/* … */}
    </Popover.Root>
  );
}
```

**Why bad:** the trigger already publishes `data-popup-open`; the copy re-renders the whole subtree for a purely visual change and lands a frame later than the attribute, so the two disagree mid-transition — write `.trigger[data-popup-open] { … }` instead

---

## Pattern 9: Common Data Attributes

Data attributes are per-part; each component's API page lists its own. These recur across the library.

```css
/* Open state — two attributes, not one value */
.popup[data-open] {
}
.popup[data-closed] {
}

/* Trigger state */
.trigger[data-popup-open] {
}
.trigger[data-pressed] {
}
.trigger[data-disabled] {
}

/* Positioning outcome */
.popup[data-side="top"] {
}
.popup[data-align="start"] {
}
.arrow[data-uncentered] {
}

/* Transition boundaries */
.popup[data-starting-style] {
}
.popup[data-ending-style] {
}

/* Animation was skipped deliberately */
.popup[data-instant] {
}

/* Selection and navigation */
.item[data-selected] {
}
.item[data-highlighted] {
}

/* Field state, on Field.Root — style the whole group from one element */
.field[data-valid] {
}
.field[data-invalid] {
}
.field[data-dirty] {
}
.field[data-touched] {
}
.field[data-filled] {
}
.field[data-focused] {
}
```

**On `data-side` values:** `top | bottom | left | right | inline-start | inline-end`. The logical values appear when the positioner resolves against writing direction, so a rule written only for `left`/`right` will miss RTL layouts.

Utility-class CSS frameworks target these through their attribute-variant syntax; the attribute names above are the contract regardless of which styling layer consumes them.

---

## Pattern 10: CSS Variables from the Positioner

### Good Example - Sizing Against the Anchor and the Viewport

```css
.select-popup {
  /* Never wider than needed, never narrower than the trigger */
  min-width: var(--anchor-width);

  /* Scroll instead of overflowing when the viewport is short */
  max-height: var(--available-height);
  overflow-y: auto;
}

.arrow-aware-popup {
  /* The popup's own measured box, for rules that need it */
  --half-width: calc(var(--popup-width) / 2);
}
```

**Why good:** these values update as the anchor resizes and as the viewport changes without a `ResizeObserver`, a hard-coded `max-height` would clip content on a laptop or overflow on a phone

`--anchor-width`, `--available-height`, `--popup-width` and `--popup-height` are the ones you reach for most. Each component's API page lists the variables that part publishes — do not assume a variable exists on a part you have not checked.

---

## Pattern 11: Animation

### Good Example - CSS Transitions (Recommended)

```css
.popup {
  transition:
    transform 150ms,
    opacity 150ms;
}

.popup[data-starting-style],
.popup[data-ending-style] {
  opacity: 0;
  transform: scale(0.9);
}
```

**Why good:** one rule covers enter and exit because both boundary states are the same, and a transition can be cancelled smoothly mid-flight — reopening a closing popup reverses from wherever it is instead of jumping to the start

### Good Example - CSS Animations, When Keyframes Are Required

```css
.popup[data-open] {
  animation: scale-in 250ms ease-out;
}
.popup[data-closed] {
  animation: scale-out 250ms ease-in;
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
}
@keyframes scale-out {
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}
```

**When to use:** multi-step motion that a single transition cannot express. Accept that an interrupted exit restarts rather than reversing.

### Good Example - External Animation Library, Unmounted Popup

```tsx
// <Presence> and <AnimatedBox> stand in for your animation library's
// presence wrapper and its animatable element.
<Presence>
  {open && (
    <Popover.Portal keepMounted>
      <Popover.Popup
        render={
          <AnimatedBox
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          />
        }
      />
    </Popover.Portal>
  )}
</Presence>
```

**Why good:** `keepMounted` hands unmount timing to the animation library's presence machinery, the `render` prop merges the animated element in without a wrapper that would break the positioner's measurement

### Good Example - External Animation Library, Popup Kept in the DOM

```tsx
<Popover.Popup
  render={(props, state) => (
    <AnimatedBox
      {...props}
      animate={{ opacity: state.open ? 1 : 0, scale: state.open ? 1 : 0.8 }}
    />
  )}
/>
```

**Why good:** no presence wrapper is needed when the popup never unmounts; state drives the animation target directly

### Good Example - Manual Unmount Control

```tsx
import { useRef } from "react";
import { Popover } from "@base-ui/react/popover";

export function ManuallyUnmounted() {
  const actionsRef = useRef<{ unmount: () => void }>(null);

  return (
    <Popover.Root actionsRef={actionsRef}>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner>
          <Popover.Popup
            render={
              <AnimatedBox
                onAnimationComplete={() => actionsRef.current?.unmount()}
              />
            }
          />
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**Why good:** Base UI detects animations via `element.getAnimations()`, which does not see a library animating a child node or animating outside the Web Animations API — `actionsRef.unmount()` is the explicit signal that the exit has finished

### Bad Example - Animating a Child and Expecting Unmount to Wait

```tsx
<Popover.Popup>
  <AnimatedBox exit={{ opacity: 0 }}>Content</AnimatedBox>
</Popover.Popup>
```

**Why bad:** the animation runs on a descendant, so `Popup` reports no running animations and unmounts immediately, tearing the child out mid-exit — animate `Popup` itself through `render`, or drive unmount with `actionsRef`

### Bad Example - A Transition Without Boundary Attributes

```css
.popup {
  transition: opacity 150ms;
  opacity: 0;
}
.popup[data-open] {
  opacity: 1;
}
```

**Why bad:** without `[data-starting-style]` the popup has no distinct entering state, so the browser has nothing to transition from on mount, and the base `opacity: 0` leaks into any state you have not enumerated
