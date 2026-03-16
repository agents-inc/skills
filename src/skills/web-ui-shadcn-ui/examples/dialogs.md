# shadcn/ui - Dialog Examples

> Patterns for dialogs, sheets, and toast notifications. See [core.md](core.md) for setup basics.

---

## Confirmation Dialog (AlertDialog)

Use AlertDialog for destructive actions that need explicit confirmation. It blocks interaction until the user responds.

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

**Why good:** AlertDialog blocks interaction for destructive actions, destructive styling on confirm button reinforces severity, `asChild` on trigger prevents nested buttons

---

## Sheet (Side Panel)

Use Sheet for contextual editing without leaving the current page (settings, user details, filters).

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

**Why good:** Sheet keeps context visible, consistent header/footer pattern, SheetClose auto-closes on action

---

## Toast Examples (Sonner)

Toasts provide non-blocking feedback. shadcn/ui uses Sonner for its toast system.

### Setup

```tsx
// Add sonner: npx shadcn@latest add sonner

// In your layout - add Toaster component once
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

**Why good:** Promise toast handles loading/success/error in one call, action button enables undo patterns, non-blocking feedback
