# Headless UI - Dialog & Modal Examples

> Complete code examples for Dialog patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Menu & Dropdowns](menu.md) - Dropdown action menus
- [Popover & Disclosure](popover-disclosure.md) - Floating panels, accordion patterns
- [Form Components](forms.md) - Field, Input, Label, Fieldset patterns

---

## Basic Confirmation Dialog

A simple dialog with controlled state, title, and description.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";

export function ConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open dialog</button>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel className="max-w-lg space-y-4 rounded-xl bg-white p-12">
            <DialogTitle className="text-lg font-bold">
              Confirm Action
            </DialogTitle>
            <Description>
              This will permanently delete your project.
            </Description>
            <div className="flex gap-4">
              <button onClick={() => setIsOpen(false)}>Cancel</button>
              <button onClick={() => setIsOpen(false)}>Confirm</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** Controlled state via `open`/`onClose`, DialogTitle provides aria-labelledby, Description provides aria-describedby, DialogBackdrop dims content, focus automatically trapped in panel

---

## Dialog with Enter/Exit Transitions

Add smooth fade and scale transitions using the `transition` prop and `data-[closed]` attributes.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export function AnimatedDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            transition
            className="max-w-lg rounded-xl bg-white p-12 duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <DialogTitle className="text-lg font-bold">
              Animated Dialog
            </DialogTitle>
            <p>Content with enter/exit transitions.</p>
            <button onClick={() => setIsOpen(false)}>Close</button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** `transition` prop enables CSS transitions, `data-[closed]:` defines both enter-from and leave-to states, no JavaScript animation library needed

---

## Dialog with Form and Submission Guard

A dialog containing a form that prevents dismissal during submission and closes on success.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
  Field,
  Input,
  Label,
  Textarea,
} from "@headlessui/react";

type FeedbackDialogProps = {
  onSubmit: (data: { name: string; message: string }) => Promise<void>;
};

export function FeedbackDialog({ onSubmit }: FeedbackDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit({
        name: formData.get("name") as string,
        message: formData.get("message") as string,
      });
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Send Feedback
      </button>

      <Dialog
        open={isOpen}
        onClose={() => {
          if (!isSubmitting) setIsOpen(false);
        }}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <DialogTitle className="text-lg font-semibold">
              Send Feedback
            </DialogTitle>
            <Description className="mt-1 text-sm text-gray-500">
              We appreciate your input. Your feedback helps us improve.
            </Description>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Field>
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  name="name"
                  required
                  autoFocus
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm data-[focus]:border-blue-500 data-[focus]:outline-none data-[focus]:ring-2 data-[focus]:ring-blue-500/20"
                />
              </Field>

              <Field>
                <Label className="text-sm font-medium">Message</Label>
                <Textarea
                  name="message"
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm data-[focus]:border-blue-500 data-[focus]:outline-none data-[focus]:ring-2 data-[focus]:ring-blue-500/20"
                />
              </Field>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** Dialog `onClose` prevented during submission, `autoFocus` on first field, Field/Label/Input auto-wire ARIA, DialogTitle and Description provide screen reader context, transitions on both backdrop and panel

---

## Coordinated Slide-Over Panel

A slide-over panel using Transition + TransitionChild for coordinated backdrop and panel animations.

```tsx
import { useState } from "react";
import { Transition, TransitionChild } from "@headlessui/react";

export function CoordinatedTransition() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Transition show={isOpen}>
        {/* Backdrop */}
        <TransitionChild>
          <div
            className="fixed inset-0 bg-black/30 transition duration-300 ease-out data-[closed]:opacity-0"
            onClick={() => setIsOpen(false)}
          />
        </TransitionChild>
        {/* Panel */}
        <TransitionChild>
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl transition duration-300 ease-out data-[closed]:translate-x-full">
            <button onClick={() => setIsOpen(false)}>Close</button>
            <p>Slide-over panel content</p>
          </div>
        </TransitionChild>
      </Transition>
    </>
  );
}
```

**Why good:** Parent Transition coordinates children, waits for all TransitionChild animations to complete before unmounting, backdrop and panel animate independently
