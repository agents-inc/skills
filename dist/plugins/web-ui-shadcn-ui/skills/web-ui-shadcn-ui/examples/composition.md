# shadcn/ui - Composition Examples

> Extending an owned component, and switching between two components on viewport width. See
> [core.md](core.md) for `cn()` and [dialogs.md](dialogs.md) for the overlays used here.

---

## Adding a Prop to an Owned Component

Behaviour every call site should get belongs in the component source. Here `isLoading` both shows a
spinner and disables the button, so no caller has to remember the pairing.

```tsx
// components/ui/button.tsx
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean; // added
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading,
  children,
  disabled,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || isLoading}
      data-slot="button"
      {...props}
    >
      {isLoading && <Spinner />}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
```

```tsx
<Button isLoading>Saving…</Button>
<Button isLoading={isSubmitting}>Submit</Button>
```

**Why good:** `disabled || isLoading` is the whole point — a loading button that stays clickable
submits twice, and leaving that to each call site guarantees one of them forgets. The variant map is
untouched, so the addition survives a later `--diff` against the registry as a readable change rather
than a rewrite. `buttonVariants` stays exported because other components compose the same classes
onto non-button elements.

---

## One Overlay on Wide Screens, Another on Narrow

A centred dialog is wrong on a phone and a bottom sheet is wrong on a desktop. Render whichever the
viewport calls for, with the same content in both.

```tsx
"use client";

import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function ResponsiveDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Edit Profile</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here.
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>
            Make changes to your profile here.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4">{children}</div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

```tsx
// hooks/use-media-query.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

**Why good:** `open` lives in the wrapper rather than in either branch, so a viewport crossing the
breakpoint while the overlay is open keeps it open in the other form. The hook starts at `false` and
corrects itself in the effect, which is what makes it safe to render on a server that has no
`matchMedia` — and why the first paint is always the narrow branch.
