# Radix UI - Core Examples

> Essential patterns for Radix UI primitives: Dialog, asChild, and Slot.

---

## Pattern 1: Dialog with Accessibility

### Good Example - Complete Dialog with Accessibility

```typescript
import { forwardRef, useState } from "react";
import { Dialog, VisuallyHidden } from "radix-ui";

const ANIMATION_DURATION_MS = 150;

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

**Why good:** forwardRef enables ref forwarding, VisuallyHidden provides screen reader context when no visible description, named constant for animation duration, aria-label on close button for accessibility, compound component structure maintains Radix patterns

### Bad Example - Missing Accessibility and Structure

```typescript
// Missing accessibility labels and proper structure
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

**Why bad:** no ARIA attributes for screen readers, no focus trapping (users can Tab outside modal), no keyboard support (Escape to close), click outside dismissal breaks accessibility patterns, no Title/Description for announcements, no Portal (can be clipped by parent overflow)

---

## Pattern 2: asChild Pattern

The `asChild` prop allows Radix components to merge their behavior onto your custom components instead of rendering their default element.

### Good Example - Tooltip on Link

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

**Why good:** asChild allows tooltip on anchor element instead of button, sideOffset prevents content overlap with trigger, Arrow provides visual connection, Provider sets consistent delay

### Good Example - Dialog Trigger on Custom Button

```typescript
import { forwardRef } from "react";
import { Dialog } from "radix-ui";

// Custom button MUST use forwardRef and spread props
type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
};

const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-variant={variant}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CustomButton.displayName = "CustomButton";

export function DialogWithCustomTrigger() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <CustomButton variant="primary">
          Open Settings
        </CustomButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Description>Configure your preferences.</Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Why good:** CustomButton uses forwardRef so Radix can attach refs for focus management, props are spread so Radix can pass event handlers and ARIA attributes, variant prop enables styling while maintaining Radix behavior

### Bad Example - asChild Without forwardRef

```typescript
// This breaks Radix functionality
const BadButton = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};

<Dialog.Trigger asChild>
  <BadButton>Open</BadButton>  {/* Radix can't attach ref! */}
</Dialog.Trigger>
```

**Why bad:** no forwardRef means Radix can't attach refs for positioning and focus management, props not spread means ARIA attributes and event handlers are lost, breaks accessibility and keyboard navigation

---

## Pattern 3: Slot Component

The `Slot` component from `@radix-ui/react-slot` enables building your own components with `asChild` support.

### Good Example - Building Button with asChild Support

```typescript
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

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

// Usage examples:

// Renders as button
<Button variant="outline">Click me</Button>

// Renders as anchor with Button behavior
<Button asChild variant="ghost">
  <a href="/page">Navigate</a>
</Button>

// Renders as Next.js Link
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

**Why good:** Slot merges props onto child when asChild is true, eliminates wrapper div nesting, preserves semantic HTML elements, works with any child component

### Good Example - Button with Icon Slots

```typescript
import { forwardRef } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";

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

// Usage
<IconButton leftIcon={<SearchIcon />} rightIcon={<ChevronIcon />}>
  Search
</IconButton>
```

**Why good:** Slottable marks where children should be placed when using asChild, allows fixed icon positions with flexible child content
