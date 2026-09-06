# shadcn/ui - Dialog Examples

> Patterns for dialogs, sheets, and toast notifications. See [core.md](core.md) for setup basics.

---

## Confirmation Dialog (AlertDialog)

AlertDialog has no click-outside and no Escape. The user answers or stays — which is what makes it,
rather than Dialog, right for anything irreversible.

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDeleteProps {
  onConfirm: () => void;
  itemName: string;
}

export function ConfirmDelete({ onConfirm, itemName }: ConfirmDeleteProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            <span className="font-medium">{itemName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Why good:** the description names what is being deleted rather than asking "are you sure?", so the
dialog carries information the user does not already have. `AlertDialogAction` renders as a button by
default, so `asChild` on the _trigger_ is what keeps the caller's own `Button` from nesting inside
one. The destructive class list goes on `Action` rather than on `Cancel`, putting the visual weight
on the choice that cannot be undone.

---

## Sheet (Side Panel)

Sheet slides in from an edge and leaves the page visible behind it — the right shape when the thing
being edited is one row of something the user is still looking at.

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditUserSheet({ user }: { user: User }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Edit User</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit User</SheetTitle>
          <SheetDescription>Make changes to the user profile.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue={user.name} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              defaultValue={user.email}
              className="col-span-3"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">Save changes</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

**Why good:** `SheetClose asChild` around the submit button closes the panel without the component
holding open state or the caller wiring a handler. Every `Input` has a matching `Label` with
`htmlFor`, which is what makes the label clickable and gives the input an accessible name.

---

## Toasts

Non-blocking feedback. `npx shadcn@latest add sonner` writes the `Toaster`, which mounts once for the
whole application; anything can then raise a toast without a reference to it.

### Setup

```tsx
import { Toaster } from "@/components/ui/sonner";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

### Usage Patterns

```tsx
import { toast } from "sonner";

// Success
toast.success("Profile updated", {
  description: "Your changes have been saved.",
});

// Error
toast.error("Something went wrong", {
  description: "Please try again later.",
});

// Toast with undo action
toast("Event created", {
  description: "Your event has been scheduled.",
  action: {
    label: "Undo",
    onClick: () => handleUndo(),
  },
});

// Promise toast (loading → success/error)
toast.promise(saveSettings(), {
  loading: "Saving...",
  success: "Settings saved!",
  error: "Could not save settings.",
});
```

**Why good:** the promise form owns the whole lifecycle, so there is no loading toast to dismiss by
hand and no path where a rejection leaves one spinning. An `action` turns a notification into a
recovery route — "Event created / Undo" lets an accidental action be taken back, where a plain
confirmation only reports it.
