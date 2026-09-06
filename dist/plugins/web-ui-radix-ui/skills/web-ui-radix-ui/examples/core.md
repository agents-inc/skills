# Radix UI - Core Examples

> Dialog, `asChild` and `Slot`. See [overlays.md](overlays.md) for AlertDialog and controlled state,
> [animation.md](animation.md) for enter and exit animation.

---

## Pattern 1: Dialog with Accessibility

### Good Example - Complete Dialog

```typescript
import { forwardRef } from "react";
import { Dialog, VisuallyHidden } from "radix-ui";

export type DialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export const CustomDialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ trigger, title, description, children }, ref) => {
    return (
      <Dialog.Root>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content ref={ref} className="dialog-content">
            <Dialog.Title>{title}</Dialog.Title>
            {description ? (
              <Dialog.Description>{description}</Dialog.Description>
            ) : (
              <VisuallyHidden asChild>
                <Dialog.Description>
                  {title} dialog content
                </Dialog.Description>
              </VisuallyHidden>
            )}
            {children}
            <Dialog.Close className="dialog-close" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);
CustomDialog.displayName = "CustomDialog";
```

**Why good:** `VisuallyHidden` keeps the `Description` in the accessibility tree when the design has
no room for it; `aria-label` gives the glyph-only close button a name; the ref reaches `Content`, so
a caller can measure or scroll it.

### Bad Example - A Dialog Rolled by Hand

```typescript
export const BadDialog = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose}>X</button>
      </div>
    </div>
  );
};
```

**Why bad:** no `role="dialog"` or accessible name, so a screen reader announces nothing; focus stays
in the page behind it and Tab walks straight out; Escape does nothing; and rendered in place, it is
clipped by any ancestor with `overflow: hidden`.

---

## Pattern 2: asChild Pattern

`asChild` makes a part render its child instead of its own element, merging behaviour onto it.

### Good Example - Tooltip on a Link

```typescript
import { Tooltip } from "radix-ui";

const TOOLTIP_DELAY_MS = 300;

export function LinkWithTooltip() {
  return (
    <Tooltip.Provider delayDuration={TOOLTIP_DELAY_MS}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a href="/documentation" className="nav-link">
            Docs
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" sideOffset={5}>
            View the documentation
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
```

**Why good:** the trigger stays a real anchor — navigable, right-clickable, crawlable — while
carrying the tooltip's hover and focus behaviour. `sideOffset` keeps the content clear of the
trigger; `Provider` sets one delay for every tooltip beneath it.

### Good Example - Custom Trigger, React 19

```typescript
import { Dialog } from "radix-ui";

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
  ref?: React.Ref<HTMLButtonElement>;
};

function CustomButton({ variant = "primary", className, ref, ...props }: ButtonProps) {
  return (
    <button
      ref={ref}
      data-variant={variant}
      className={className}
      {...props}
    />
  );
}

<Dialog.Trigger asChild>
  <CustomButton variant="primary">Open Settings</CustomButton>
</Dialog.Trigger>
```

**Why good:** `ref` arrives as an ordinary prop and reaches the DOM node; the rest spread carries
Radix's `onClick`, `aria-expanded` and `data-state` through; `variant` is consumed rather than
forwarded, so it never lands on the element as an unknown attribute.

### Good Example - Custom Trigger, React 18 and Below

```typescript
import { forwardRef } from "react";
import { Dialog } from "radix-ui";

const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, children, ...props }, ref) => (
    <button ref={ref} data-variant={variant} className={className} {...props}>
      {children}
    </button>
  )
);
CustomButton.displayName = "CustomButton";
```

**Why good:** the `forwardRef` wrapper is the only route a ref has to the element before React 19.

### Bad Example - Neither Ref Nor Spread

```typescript
const BadButton = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};

<Dialog.Trigger asChild>
  <BadButton>Open</BadButton>
</Dialog.Trigger>
```

**Why bad:** two failures at once. No ref, so Radix cannot focus or measure the trigger and focus
never returns to it on close. No spread, so the merged `onClick` is dropped and the button does
nothing at all — the component renders, looks correct, and is inert.

---

## Pattern 3: Slot Component

`Slot` is the merging machinery behind `asChild`, exposed so your own components can offer it.

### Good Example - A Button with asChild Support

```typescript
import { forwardRef } from "react";
import { Slot } from "radix-ui";

export type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, variant = "default", size = "md", className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-variant={variant}
        data-size={size}
        className={className}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Renders a <button>
<Button variant="outline">Click me</Button>

// Renders the <a>, carrying the Button's props and data attributes
<Button asChild variant="ghost">
  <a href="/page">Navigate</a>
</Button>

// Same, with a router's own link component as the child
<Button asChild>
  <RouterLink to="/dashboard">Dashboard</RouterLink>
</Button>
```

**Why good:** one component covers button, anchor and router link with no wrapper element and no
duplicated prop plumbing. `data-variant` and `data-size` land on whichever element renders, so the
styling hook survives the swap.

### Good Example - Fixed Decoration Around Slotted Content

```typescript
import { forwardRef } from "react";
import { Slot, Slottable } from "radix-ui";

export type IconButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ asChild = false, leftIcon, rightIcon, children, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={className} {...props}>
        {leftIcon}
        <Slottable>{children}</Slottable>
        {rightIcon}
      </Comp>
    );
  }
);
IconButton.displayName = "IconButton";

<IconButton leftIcon={<SearchIcon />} rightIcon={<ChevronIcon />}>
  Search
</IconButton>
```

**Why good:** without `Slottable`, `Slot` treats the whole children array as the element to merge
onto and throws, because there is more than one child. `Slottable` marks which child is the merge
target and leaves the icons as ordinary siblings inside it.
