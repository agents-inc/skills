# Radix UI - Overlay Examples

> AlertDialog and controlled Dialog patterns for modal interactions.

---

## Pattern 1: AlertDialog for Destructive Actions

AlertDialog is Dialog without the escape hatches: no click-outside, no Escape. The user leaves
through `Cancel` or `Action` and nowhere else.

### Good Example - Destructive Action Confirmation

```typescript
import { useRef } from "react";
import { AlertDialog } from "radix-ui";

type DeleteConfirmDialogProps = {
  itemName: string;
  onConfirm: () => void;
  trigger: React.ReactNode;
};

export function DeleteConfirmDialog({
  itemName,
  onConfirm,
  trigger,
}: DeleteConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="alert-overlay" />
        <AlertDialog.Content
          className="alert-content"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus(); // Focus safe action first
          }}
        >
          <AlertDialog.Title>Delete {itemName}?</AlertDialog.Title>
          <AlertDialog.Description>
            This action cannot be undone. This will permanently delete{" "}
            <strong>{itemName}</strong> and all associated data.
          </AlertDialog.Description>
          <div className="alert-actions">
            <AlertDialog.Cancel ref={cancelRef} className="alert-cancel">
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className="alert-action alert-action-danger"
              onClick={onConfirm}
            >
              Delete
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

// Usage
<DeleteConfirmDialog
  itemName="Project Alpha"
  onConfirm={() => deleteProject(projectId)}
  trigger={<button>Delete Project</button>}
/>
```

**Why good:** `onOpenAutoFocus` moves the initial focus to Cancel, so Enter on an unread dialog does
the safe thing rather than the destructive one. The `Description` names the consequence — "cannot be
undone" — rather than asking "are you sure?", which tells the user nothing.

---

## Pattern 2: Controlled Dialog with Async Operations

### Good Example - Async Operation with Controlled State

```typescript
import { useState } from "react";
import { Dialog } from "radix-ui";

export function EditProfileDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      await saveProfile(formData);
      setOpen(false); // Close dialog on success
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="edit-button">Edit Profile</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onInteractOutside={(e) => {
            if (isSubmitting) e.preventDefault(); // Prevent close while submitting
          }}
          onEscapeKeyDown={(e) => {
            if (isSubmitting) e.preventDefault(); // Prevent Escape while submitting
          }}
        >
          <Dialog.Title>Edit Profile</Dialog.Title>
          <Dialog.Description>
            Update your profile information below.
          </Dialog.Description>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}>
            <input name="name" placeholder="Name" required />
            <input name="email" type="email" placeholder="Email" required />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Why good:** closing after a successful save needs the state in the component, which is what
controlled mode buys. `onInteractOutside` and `onEscapeKeyDown` both need blocking during
submission — Radix routes the two dismissal gestures through separate callbacks, so guarding one
leaves the other open.
