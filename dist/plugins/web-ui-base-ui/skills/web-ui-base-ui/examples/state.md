# Base UI - State Examples

> Controlled and uncontrolled components, `eventDetails`, cancelation, and imperative actions. See [core.md](core.md) for anatomy.

**Prerequisites**: Understand [Pattern 1: Part Anatomy](core.md#pattern-1-part-anatomy).

---

## Pattern 12: Uncontrolled by Default

### Good Example - Leave It Uncontrolled

```tsx
import { Dialog } from "@base-ui/react/dialog";

export function SettingsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Settings</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup className="popup">
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Description>Change your preferences.</Dialog.Description>
          <Dialog.Close>Done</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Why good:** no state, no re-renders in the parent when the dialog toggles, and the trigger/close wiring is already handled — controlling it would add code and remove nothing

### Good Example - Observe Without Owning

```tsx
<Select.Root
  defaultValue="all"
  onValueChange={(value) => {
    analytics.track("filter_changed", { value });
  }}
/>
```

**Why good:** the handler reads the change for a side effect while the component keeps owning its value, so there is no risk of the two disagreeing

### Bad Example - Controlling for No Reason

```tsx
const [open, setOpen] = useState(false);

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>Settings</Dialog.Trigger>
  {/* … */}
</Dialog.Root>;
```

**Why bad:** nothing else reads that state, so it buys a parent re-render on every open and close plus a new way for the dialog to get stuck if an edit ever drops the `setOpen`

---

## Pattern 13: Controlled When Something Outside Drives It

### Good Example - Opening From Elsewhere

```tsx
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

const ONBOARDING_DELAY_MS = 1000;

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setOpen(true), ONBOARDING_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Popup className="popup">
          <Dialog.Title>Welcome</Dialog.Title>
          <Dialog.Close>Get started</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Why good:** no trigger is needed when the open state comes from outside, `onOpenChange` is still supplied so dismissal (escape, outside press, `Close`) keeps your state in sync

### Bad Example - Controlled Without a Handler

```tsx
<Dialog.Root open={open}>
  <Dialog.Close>Done</Dialog.Close>
</Dialog.Root>
```

**Why bad:** with `open` supplied and no `onOpenChange`, the dialog can never close — escape, outside press and `Close` all request a change nobody listens for, so the user is trapped

### Good Example - defaultValue Is Read Once

```tsx
// The initial value, fixed at mount
<Select.Root defaultValue={savedFilter} />

// Changing the value later requires control
<Select.Root value={filter} onValueChange={setFilter} />
```

**Why good:** `defaultValue` is read once at mount, so an async fetch resolving later is silently ignored — changing it afterwards warns in development and does nothing

---

## Pattern 14: eventDetails and Cancelation

Every change handler receives `eventDetails` as its second argument:

```ts
interface BaseUIChangeEventDetails {
  reason: string;
  event: Event;
  trigger: Element | undefined;
  cancel: () => void;
  allowPropagation: () => void;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
}
```

### Good Example - Vetoing a Change on an Uncontrolled Component

```tsx
import { Tooltip } from "@base-ui/react/tooltip";

<Tooltip.Root
  onOpenChange={(open, eventDetails) => {
    // Hover and focus still open it; a press does not
    if (eventDetails.reason === "trigger-press") {
      eventDetails.cancel();
    }
  }}
>
  {/* … */}
</Tooltip.Root>;
```

**Why good:** `cancel()` prevents the component's internal state from updating, so conditional behaviour needs no lifted state at all

### Good Example - Guarding a Dialog With Unsaved Work

```tsx
import { Dialog } from "@base-ui/react/dialog";

export function EditorDialog({ isDirty }: { isDirty: boolean }) {
  return (
    <Dialog.Root
      onOpenChange={(open, eventDetails) => {
        const isDismissal =
          !open &&
          (eventDetails.reason === "outside-press" ||
            eventDetails.reason === "escape-key");

        if (isDismissal && isDirty) {
          eventDetails.cancel();
        }
      }}
    >
      {/* … */}
    </Dialog.Root>
  );
}
```

**Why good:** branching on `reason` lets accidental dismissals be blocked while an explicit `Close` button still works, which is impossible if you only look at the new value

**`reason` values are documented per component** — check the component's API page rather than assuming. Select, for instance, documents `trigger-press`, `outside-press`, `escape-key`, `window-resize`, `item-press`, `focus-out`, `list-navigation`, `cancel-open` and `none`. A handler that compares against a string the component never emits fails silently.

### Bad Example - Returning Early to "Block" a Change

```tsx
<Tooltip.Root
  onOpenChange={(open) => {
    if (shouldStayClosed) {
      return; // does nothing
    }
    setOpen(open);
  }}
/>
```

**Why bad:** the return value is ignored, so an uncontrolled tooltip opens anyway and the guard only appears to work in whichever mode you happened to test

### Bad Example - Treating isCanceled as the Cancel Switch

```tsx
onOpenChange={(open, eventDetails) => {
  eventDetails.isCanceled = true; // read-only report, not a control
}}
```

**Why bad:** `isCanceled` reports whether some handler in the chain already called `cancel()`; assigning to it cancels nothing — call `eventDetails.cancel()`

**On `allowPropagation()`:** Base UI stops the originating event from propagating by default so nested popups and outside-press detection do not fight each other. Call `allowPropagation()` only when an ancestor genuinely needs to see the same event, and expect to handle the double-handling that follows.

---

## Pattern 15: Imperative Actions and Completion

### Good Example - onOpenChangeComplete for Post-Animation Work

```tsx
<Dialog.Root
  onOpenChangeComplete={(open) => {
    if (!open) {
      resetForm(); // runs after the exit transition, not during it
    }
  }}
/>
```

**Why good:** resetting inside `onOpenChange` would blank the content while it is still visibly animating out; `onOpenChangeComplete` fires once the animation has settled

### Good Example - actionsRef for Imperative Close and Unmount

```tsx
import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";

export function SaveDialog() {
  const actionsRef = useRef<{ close: () => void; unmount: () => void }>(null);

  const handleSave = async () => {
    await save();
    actionsRef.current?.close();
  };

  return (
    <Dialog.Root actionsRef={actionsRef}>
      <Dialog.Trigger>Edit</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup className="popup">
          <Dialog.Title>Edit</Dialog.Title>
          <button type="button" onClick={handleSave}>
            Save
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Why good:** closing after an async operation no longer requires lifting the whole open state into React just to call `setOpen(false)` once

**When to use:** one-off imperative moments — close after save, unmount after an external animation finishes. If the parent needs to read the state as well, control it properly instead.
