# Design System Best Practices Research

> **Purpose:** Comprehensive patterns for creating atomic skills related to design systems and component libraries.

---

## Table of Contents

1. [Component Library Patterns (Atomic Design)](#1-component-library-patterns-atomic-design)
2. [Radix UI Patterns (Headless Components)](#2-radix-ui-patterns-headless-components)
3. [shadcn/ui Patterns](#3-shadcnui-patterns)
4. [Design Tokens Patterns](#4-design-tokens-patterns)
5. [Theme Switching Patterns](#5-theme-switching-patterns)
6. [Component Documentation (Storybook)](#6-component-documentation-storybook)
7. [Component Testing Patterns](#7-component-testing-patterns)
8. [Compound Component Patterns](#8-compound-component-patterns)
9. [Polymorphic Component Patterns](#9-polymorphic-component-patterns)
10. [Accessibility-First Component Design](#10-accessibility-first-component-design)

---

## 1. Component Library Patterns (Atomic Design)

### Core Patterns

Atomic Design organizes components into a hierarchy based on complexity and reusability. The methodology, created by Brad Frost, uses chemistry as a metaphor.

#### Pattern 1.1: Five-Level Hierarchy

```
Atoms       → Basic building blocks (button, input, label, icon)
Molecules   → Simple component groups (search form = input + button)
Organisms   → Complex UI sections (header = logo + nav + search)
Templates   → Page-level layouts (content placeholders)
Pages       → Specific instances with real content
```

**TypeScript Implementation:**

```typescript
// atoms/button.tsx
import { forwardRef } from "react";

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
```

```typescript
// molecules/search-form.tsx
import { forwardRef } from "react";
import { Button } from "../atoms/button";
import { Input } from "../atoms/input";

export type SearchFormProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
};

export const SearchForm = forwardRef<HTMLFormElement, SearchFormProps>(
  ({ onSearch, placeholder = "Search...", className }, ref) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      onSearch(formData.get("query") as string);
    };

    return (
      <form ref={ref} className={className} onSubmit={handleSubmit}>
        <Input name="query" placeholder={placeholder} />
        <Button type="submit">Search</Button>
      </form>
    );
  }
);

SearchForm.displayName = "SearchForm";
```

```typescript
// organisms/header.tsx
import { Logo } from "../atoms/logo";
import { Navigation } from "../molecules/navigation";
import { SearchForm } from "../molecules/search-form";

export type HeaderProps = {
  onSearch: (query: string) => void;
  navItems: Array<{ label: string; href: string }>;
  className?: string;
};

export const Header = ({ onSearch, navItems, className }: HeaderProps) => {
  return (
    <header className={className}>
      <Logo />
      <Navigation items={navItems} />
      <SearchForm onSearch={onSearch} />
    </header>
  );
};
```

#### Pattern 1.2: Directory Structure

```
packages/ui/src/
├── atoms/
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.module.scss
│   │   ├── button.test.tsx
│   │   └── index.ts
│   ├── input/
│   └── label/
├── molecules/
│   ├── search-form/
│   ├── form-field/
│   └── dropdown-menu/
├── organisms/
│   ├── header/
│   ├── sidebar/
│   └── data-table/
├── templates/
│   ├── dashboard-layout/
│   └── auth-layout/
└── index.ts  // Barrel exports
```

**Barrel Export Pattern:**

```typescript
// packages/ui/src/index.ts
// Atoms
export { Button } from "./atoms/button";
export type { ButtonProps } from "./atoms/button";

// Molecules
export { SearchForm } from "./molecules/search-form";
export type { SearchFormProps } from "./molecules/search-form";

// Organisms
export { Header } from "./organisms/header";
export type { HeaderProps } from "./organisms/header";
```

### Anti-Patterns

```typescript
// BAD: Skipping hierarchy levels
// Atoms should not import from Organisms
import { Header } from "../organisms/header"; // Circular dependency risk

// BAD: God components that bypass atomic structure
export const EverythingComponent = () => {
  // 500+ lines combining atoms, molecules, organisms
  // No separation of concerns
};

// BAD: Inconsistent naming between levels
// atoms/MyButton.tsx    <- PascalCase file
// molecules/search-form <- kebab-case file
// Mixed conventions break predictability
```

### When to Use

**Use Atomic Design when:**
- Building a design system for multiple applications
- Team has 3+ frontend developers needing shared vocabulary
- Product has complex, recurring UI patterns
- Long-term maintainability is priority

**Do NOT use when:**
- Building a simple landing page or prototype
- Single-developer project with limited UI complexity
- External component library provides sufficient abstraction (MUI, Chakra)
- Tight deadline where atomic structure adds overhead

---

## 2. Radix UI Patterns (Headless Components)

### Core Patterns

Radix UI provides unstyled, accessible primitives. You own the styling; Radix handles behavior, accessibility, and keyboard interactions.

#### Pattern 2.1: Wrapping Radix Primitives

```typescript
// components/dialog.tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import { X } from "lucide-react";
import styles from "./dialog.module.scss";

// Root - pass through
export const Dialog = DialogPrimitive.Root;

// Trigger - pass through with optional styling
export const DialogTrigger = DialogPrimitive.Trigger;

// Portal - typically pass through
export const DialogPortal = DialogPrimitive.Portal;

// Overlay - add styling
export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`${styles.overlay} ${className ?? ""}`}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

// Content - compose with overlay and close button
export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={`${styles.content} ${className ?? ""}`}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className={styles.closeButton}>
        <X />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

// Title and Description - styled pass-throughs
export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`${styles.title} ${className ?? ""}`}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`${styles.description} ${className ?? ""}`}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
```

**Usage:**

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";

export const ConfirmDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogDescription>
          This action cannot be undone. Are you sure?
        </DialogDescription>
        <div>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### Pattern 2.2: Controlled vs Uncontrolled

```typescript
// Uncontrolled (internal state)
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>

// Controlled (external state)
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

#### Pattern 2.3: Slot Pattern with asChild

```typescript
// The asChild prop merges behavior onto child element
import { Slot } from "@radix-ui/react-slot";

export type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} {...props} />;
  }
);

// Usage - button behavior on anchor
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>
```

### Anti-Patterns

```typescript
// BAD: Re-implementing Radix behavior
export const Dialog = ({ open, onClose, children }) => {
  // Manual focus trap implementation
  // Manual escape key handling
  // Manual click-outside handling
  // All of this is already in Radix!
};

// BAD: Ignoring accessibility props
<DialogPrimitive.Content>
  {/* Missing DialogTitle - screen readers won't announce dialog */}
  <p>Some content</p>
</DialogPrimitive.Content>

// BAD: Breaking compound component contract
// Radix components expect specific children hierarchy
<Dialog>
  <div> {/* Extra wrapper breaks context */}
    <DialogTrigger>Open</DialogTrigger>
  </div>
  <DialogContent>...</DialogContent>
</Dialog>
```

### When to Use

**Use Radix UI when:**
- Building a custom design system with unique styling
- Need accessible primitives without styling opinions
- Want full control over appearance while maintaining a11y
- Building complex interactive components (dialogs, dropdowns, tabs)

**Do NOT use when:**
- Need rapid prototyping with pre-styled components
- Team lacks CSS expertise for styling primitives
- Using a complete design system like MUI or Chakra
- Simple UI without complex interactions

---

## 3. shadcn/ui Patterns

### Core Patterns

shadcn/ui is not a component library - it is a collection of reusable components you copy into your project. Components are built on Radix UI + Tailwind CSS.

#### Pattern 3.1: Copy-Paste Philosophy

```bash
# Add components to your project (they become YOUR code)
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
```

**Result:** Components are copied to `components/ui/` and can be modified freely.

#### Pattern 3.2: cn() Utility for Class Merging

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage in components:**

```typescript
// components/ui/button.tsx
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

#### Pattern 3.3: SCSS Modules Adaptation (Non-Tailwind)

When not using Tailwind, adapt shadcn/ui patterns with SCSS Modules + cva:

```typescript
// components/ui/button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import styles from "./button.module.scss";

const buttonVariants = cva(styles.base, {
  variants: {
    variant: {
      default: styles.variantDefault,
      destructive: styles.variantDestructive,
      outline: styles.variantOutline,
      ghost: styles.variantGhost,
    },
    size: {
      default: styles.sizeDefault,
      sm: styles.sizeSm,
      lg: styles.sizeLg,
      icon: styles.sizeIcon,
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={`${buttonVariants({ variant, size })} ${className ?? ""}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
```

```scss
// button.module.scss
@layer components {
  .base {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    transition: color 150ms, background-color 150ms;

    &:focus-visible {
      outline: none;
      ring: 2px solid var(--color-ring);
    }

    &:disabled {
      pointer-events: none;
      opacity: 0.5;
    }
  }

  .variantDefault {
    background-color: hsl(var(--color-primary));
    color: hsl(var(--color-primary-foreground));

    &:hover {
      background-color: hsl(var(--color-primary) / 0.9);
    }
  }

  .variantDestructive {
    background-color: hsl(var(--color-destructive));
    color: hsl(var(--color-destructive-foreground));
  }

  .variantOutline {
    border: 1px solid hsl(var(--color-border));
    background-color: hsl(var(--color-background));
  }

  .variantGhost {
    &:hover {
      background-color: hsl(var(--color-accent));
      color: hsl(var(--color-accent-foreground));
    }
  }

  .sizeDefault {
    height: calc(var(--space-unit) * 20);
    padding: calc(var(--space-unit) * 4) calc(var(--space-unit) * 8);
  }

  .sizeSm {
    height: calc(var(--space-unit) * 18);
    padding: calc(var(--space-unit) * 2) calc(var(--space-unit) * 6);
  }

  .sizeLg {
    height: calc(var(--space-unit) * 22);
    padding: calc(var(--space-unit) * 4) calc(var(--space-unit) * 16);
  }

  .sizeIcon {
    height: calc(var(--space-unit) * 20);
    width: calc(var(--space-unit) * 20);
  }
}
```

### Anti-Patterns

```typescript
// BAD: Treating shadcn as an npm dependency
// There is no "import from shadcn" - components live in your codebase
import { Button } from "shadcn/ui"; // Does not exist

// BAD: Never modifying copied components
// The whole point is customization - modify freely!

// BAD: Using cn() without twMerge when using Tailwind
// cn() MUST use twMerge to handle Tailwind class conflicts
export function cn(...inputs) {
  return clsx(inputs); // Missing twMerge - classes won't merge properly
}
```

### When to Use

**Use shadcn/ui patterns when:**
- Want full ownership and customization of components
- Building on Radix UI primitives
- Need consistent patterns across team
- Prefer copy-paste over npm dependencies for UI

**Do NOT use when:**
- Need components that auto-update with security patches
- Team prefers npm-managed component library
- Building library consumed by external teams (npm package better)

---

## 4. Design Tokens Patterns

### Core Patterns

Design tokens are the single source of truth for design decisions - colors, spacing, typography, shadows, etc.

#### Pattern 4.1: Two-Tier Token Architecture

```scss
// tokens/core.scss - Tier 1: Raw Values
:root {
  // Color Palette (HSL without wrapper)
  --color-white: 0 0% 100%;
  --color-black: 0 0% 0%;
  --color-gray-50: 210 40% 98%;
  --color-gray-100: 210 40% 96%;
  --color-gray-200: 214 32% 91%;
  --color-gray-300: 213 27% 84%;
  --color-gray-400: 215 20% 65%;
  --color-gray-500: 215 16% 47%;
  --color-gray-600: 215 19% 35%;
  --color-gray-700: 215 25% 27%;
  --color-gray-800: 217 33% 17%;
  --color-gray-900: 222 47% 11%;

  --color-blue-500: 217 91% 60%;
  --color-red-500: 0 84% 60%;
  --color-green-500: 142 71% 45%;
  --color-yellow-500: 45 93% 47%;

  // Spacing Scale
  --space-unit: 0.25rem; // 4px base
  --space-1: calc(var(--space-unit) * 1);  // 4px
  --space-2: calc(var(--space-unit) * 2);  // 8px
  --space-3: calc(var(--space-unit) * 3);  // 12px
  --space-4: calc(var(--space-unit) * 4);  // 16px
  --space-5: calc(var(--space-unit) * 5);  // 20px
  --space-6: calc(var(--space-unit) * 6);  // 24px
  --space-8: calc(var(--space-unit) * 8);  // 32px
  --space-10: calc(var(--space-unit) * 10); // 40px
  --space-12: calc(var(--space-unit) * 12); // 48px
  --space-16: calc(var(--space-unit) * 16); // 64px

  // Typography
  --font-family-sans: system-ui, -apple-system, sans-serif;
  --font-family-mono: ui-monospace, monospace;

  --font-size-xs: 0.75rem;   // 12px
  --font-size-sm: 0.875rem;  // 14px
  --font-size-base: 1rem;    // 16px
  --font-size-lg: 1.125rem;  // 18px
  --font-size-xl: 1.25rem;   // 20px
  --font-size-2xl: 1.5rem;   // 24px
  --font-size-3xl: 1.875rem; // 30px
  --font-size-4xl: 2.25rem;  // 36px

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;

  // Border Radius
  --radius-sm: 0.125rem;  // 2px
  --radius-md: 0.375rem;  // 6px
  --radius-lg: 0.5rem;    // 8px
  --radius-xl: 0.75rem;   // 12px
  --radius-full: 9999px;

  // Shadows
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  // Transitions
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

```scss
// tokens/semantic.scss - Tier 2: Purpose-Driven
:root {
  // Backgrounds
  --color-background: var(--color-white);
  --color-background-subtle: var(--color-gray-50);
  --color-background-muted: var(--color-gray-100);

  // Foregrounds (Text)
  --color-foreground: var(--color-gray-900);
  --color-foreground-muted: var(--color-gray-500);
  --color-foreground-subtle: var(--color-gray-400);

  // Primary Action
  --color-primary: var(--color-gray-900);
  --color-primary-foreground: var(--color-white);

  // Secondary Action
  --color-secondary: var(--color-gray-100);
  --color-secondary-foreground: var(--color-gray-900);

  // Destructive Action
  --color-destructive: var(--color-red-500);
  --color-destructive-foreground: var(--color-white);

  // Borders
  --color-border: var(--color-gray-200);
  --color-border-muted: var(--color-gray-100);

  // Focus Ring
  --color-ring: var(--color-blue-500);

  // Accent (Hover states)
  --color-accent: var(--color-gray-100);
  --color-accent-foreground: var(--color-gray-900);

  // Card
  --color-card: var(--color-white);
  --color-card-foreground: var(--color-gray-900);

  // Input
  --color-input: var(--color-gray-200);
  --color-input-foreground: var(--color-gray-900);

  // Component Spacing
  --component-padding-sm: var(--space-2);
  --component-padding-md: var(--space-4);
  --component-padding-lg: var(--space-6);

  // Layout Spacing
  --layout-gap-sm: var(--space-4);
  --layout-gap-md: var(--space-6);
  --layout-gap-lg: var(--space-8);
}
```

#### Pattern 4.2: TypeScript Token Types

```typescript
// tokens/types.ts
export type ColorToken =
  | "background"
  | "background-subtle"
  | "background-muted"
  | "foreground"
  | "foreground-muted"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "destructive"
  | "destructive-foreground"
  | "border"
  | "ring"
  | "accent"
  | "accent-foreground";

export type SpaceToken =
  | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12" | "16";

export type RadiusToken = "sm" | "md" | "lg" | "xl" | "full";

export type FontSizeToken =
  | "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

// Utility to get CSS variable
export function getToken(category: string, name: string): string {
  return `var(--${category}-${name})`;
}

// Usage
// getToken("color", "primary") -> "var(--color-primary)"
// getToken("space", "4") -> "var(--space-4)"
```

#### Pattern 4.3: Foreground/Background Pairs

Every background color needs a paired foreground for text contrast:

```scss
// Always define pairs
--color-primary: var(--color-gray-900);
--color-primary-foreground: var(--color-white);

--color-destructive: var(--color-red-500);
--color-destructive-foreground: var(--color-white);

--color-card: var(--color-white);
--color-card-foreground: var(--color-gray-900);
```

**Usage in components:**

```scss
.button[data-variant="primary"] {
  background-color: hsl(var(--color-primary));
  color: hsl(var(--color-primary-foreground));
}

.card {
  background-color: hsl(var(--color-card));
  color: hsl(var(--color-card-foreground));
}
```

### Anti-Patterns

```scss
// BAD: Hardcoded values in components
.button {
  background-color: #1a1a1a; // Magic color
  padding: 12px 24px;        // Magic numbers
  font-size: 14px;           // Magic number
}

// BAD: Using core tokens directly in components
.button {
  background-color: hsl(var(--color-gray-900)); // Should be --color-primary
}

// BAD: Missing foreground pair
.card {
  background-color: hsl(var(--color-card));
  color: hsl(var(--color-gray-900)); // Should be --color-card-foreground
}

// BAD: Inconsistent naming
--primary-color: ...;    // Should be --color-primary
--colorPrimary: ...;     // Should be --color-primary
--button-background: ...; // Should be semantic, not component-specific
```

### When to Use

**Use design tokens when:**
- Building a design system used across multiple apps
- Need theme switching (light/dark mode)
- Want consistent visual language across products
- Team includes designers who need to reference values

**Do NOT use when:**
- One-off prototype or throwaway code
- Using component library that manages its own tokens (MUI, Chakra)
- Extremely simple UI with no theming needs

---

## 5. Theme Switching Patterns

### Core Patterns

#### Pattern 5.1: CSS Class-Based Theming

```scss
// tokens/themes.scss
:root {
  // Light theme (default)
  --color-background: var(--color-white);
  --color-foreground: var(--color-gray-900);
  --color-primary: var(--color-gray-900);
  --color-primary-foreground: var(--color-white);
  --color-border: var(--color-gray-200);
  --color-card: var(--color-white);
  --color-card-foreground: var(--color-gray-900);
}

.dark {
  --color-background: var(--color-gray-900);
  --color-foreground: var(--color-gray-50);
  --color-primary: var(--color-white);
  --color-primary-foreground: var(--color-gray-900);
  --color-border: var(--color-gray-800);
  --color-card: var(--color-gray-800);
  --color-card-foreground: var(--color-gray-50);
}
```

#### Pattern 5.2: Theme Provider with Context

```typescript
// providers/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
};

const STORAGE_KEY_DEFAULT = "ui-theme";

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = STORAGE_KEY_DEFAULT,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let resolved: "light" | "dark";

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      resolved = systemTheme;
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    setResolvedTheme(resolved);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      const newTheme = e.matches ? "dark" : "light";
      root.classList.add(newTheme);
      setResolvedTheme(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    resolvedTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
```

#### Pattern 5.3: Theme Toggle Component

```typescript
// components/theme-toggle.tsx
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "../providers/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={`Current theme: ${theme}`}
      aria-label={`Switch theme, current: ${theme}`}
    >
      {theme === "light" && <Sun />}
      {theme === "dark" && <Moon />}
      {theme === "system" && <Monitor />}
    </Button>
  );
}
```

#### Pattern 5.4: Preventing Flash of Incorrect Theme (FOIT)

```html
<!-- Add to <head> before any CSS -->
<script>
  (function() {
    const storageKey = 'ui-theme';
    const theme = localStorage.getItem(storageKey) || 'system';
    let resolved;

    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      resolved = theme;
    }

    document.documentElement.classList.add(resolved);
  })();
</script>
```

### Anti-Patterns

```typescript
// BAD: Inline theme conditionals in components
const Button = ({ theme }) => (
  <button
    style={{
      backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
      color: theme === "dark" ? "#ffffff" : "#1a1a1a",
    }}
  >
    Click me
  </button>
);

// BAD: Storing theme state in multiple places
// Theme should be single source of truth (localStorage + context)

// BAD: Forgetting system preference
type Theme = "light" | "dark"; // Missing "system" option

// BAD: Not preventing flash of incorrect theme
// Users see light theme flash before dark theme applies
```

### When to Use

**Use theme switching when:**
- Users expect light/dark mode toggle
- Need to respect system preferences
- Building user-facing application
- Design system supports multiple themes

**Do NOT use when:**
- Internal tool where theming adds complexity
- Single-theme product by design decision
- Prototype or MVP where theming is out of scope

---

## 6. Component Documentation (Storybook)

### Core Patterns

#### Pattern 6.1: Story Structure (CSF 3.0)

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Primary UI button component with multiple variants and sizes.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      description: "Visual style variant",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
      description: "Size variant",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "default" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    asChild: {
      control: "boolean",
      description: "Render as child element (polymorphic)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Primary story
export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

// Variants
export const Destructive: Story = {
  args: {
    children: "Delete",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    children: "Ghost",
    variant: "ghost",
  },
};

// Sizes
export const Small: Story = {
  args: {
    children: "Small",
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    children: "Large",
    size: "lg",
  },
};

// States
export const Disabled: Story = {
  args: {
    children: "Disabled",
    disabled: true,
  },
};

// With Icon
export const WithIcon: Story = {
  render: () => (
    <Button>
      <Mail className="mr-2 h-4 w-4" />
      Login with Email
    </Button>
  ),
};

// All Variants Grid
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
      </div>
    </div>
  ),
};
```

#### Pattern 6.2: Interaction Tests

```typescript
// button.stories.tsx (continued)
import { within, userEvent, expect } from "@storybook/test";

export const ClickTest: Story = {
  args: {
    children: "Click me",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    // Verify initial state
    await expect(button).toBeEnabled();

    // Click and verify
    await userEvent.click(button);

    // If there's an onClick handler, verify it was called
    // (requires mocking in args)
  },
};

export const KeyboardNavigation: Story = {
  args: {
    children: "Focus me",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    // Tab to focus
    await userEvent.tab();
    await expect(button).toHaveFocus();

    // Enter to activate
    await userEvent.keyboard("{Enter}");
  },
};
```

#### Pattern 6.3: Documentation Pages (MDX)

```mdx
{/* Button.mdx */}
import { Meta, Canvas, Controls, Stories } from "@storybook/blocks";
import * as ButtonStories from "./button.stories";

<Meta of={ButtonStories} />

# Button

Buttons trigger actions and events. They should clearly communicate the action
that will occur when clicked.

## Usage Guidelines

- Use **Default** for primary actions
- Use **Secondary** for less prominent actions
- Use **Destructive** for dangerous/irreversible actions
- Use **Ghost** for tertiary actions in toolbars
- Use **Link** when navigation is the action

## Accessibility

- Always provide meaningful text or `aria-label` for icon-only buttons
- Ensure sufficient color contrast (4.5:1 for text)
- Button focus states are visible for keyboard navigation

<Canvas of={ButtonStories.Default} />
<Controls />

## All Variants

<Canvas of={ButtonStories.AllVariants} />

## API Reference

<Stories />
```

#### Pattern 6.4: Storybook Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)", "../src/**/*.mdx"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
```

```typescript
// .storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/styles/globals.scss";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0a0a0a" },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.backgrounds?.value === "#0a0a0a";
      return (
        <div className={isDark ? "dark" : ""}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
```

### Anti-Patterns

```typescript
// BAD: No stories for component states
// Only showing default - missing variants, sizes, disabled, loading

// BAD: Stories without descriptions
export const Button: Story = {
  args: { children: "Click" },
  // No parameters.docs.description
};

// BAD: Not using play functions for interaction testing
// Stories should test keyboard navigation, focus, clicks

// BAD: Inconsistent story naming
export const button: Story = {}; // Should be PascalCase
export const PRIMARY: Story = {}; // Should be PascalCase
```

### When to Use

**Use Storybook when:**
- Building a component library or design system
- Team needs visual documentation of components
- Need to test components in isolation
- Want to catch visual regressions

**Do NOT use when:**
- Building application logic, not UI components
- Single-use components that don't need documentation
- Tight deadline where documentation can be deferred

---

## 7. Component Testing Patterns

### Core Patterns

#### Pattern 7.1: React Testing Library + Vitest

```typescript
// button.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies variant data attribute", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "destructive");
  });

  it("applies size data attribute", () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-size", "lg");
  });

  it("forwards ref to button element", () => {
    const ref = { current: null };
    render(<Button ref={ref}>Click</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>
    );
    await user.click(screen.getByRole("button"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Go to Dashboard</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Go to Dashboard" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("merges className prop", () => {
    render(<Button className="custom-class">Click</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });
});
```

#### Pattern 7.2: Accessibility Testing

```typescript
// button.test.tsx (continued)
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

describe("Button Accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("is focusable via keyboard", async () => {
    const user = userEvent.setup();
    render(<Button>Click me</Button>);

    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("can be activated with Enter key", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.tab();
    await user.keyboard("{Enter}");

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("can be activated with Space key", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.tab();
    await user.keyboard(" ");

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is not focusable when disabled", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button disabled>Disabled</Button>
        <Button>Enabled</Button>
      </>
    );

    await user.tab();
    // Should skip disabled button
    expect(screen.getByRole("button", { name: "Enabled" })).toHaveFocus();
  });
});
```

#### Pattern 7.3: Visual Regression Testing (Playwright)

```typescript
// button.spec.ts (Playwright)
import { test, expect } from "@playwright/test";

test.describe("Button Visual Tests", () => {
  test("default variant matches snapshot", async ({ page }) => {
    await page.goto("/storybook-iframe?id=components-button--default");
    await expect(page.locator("button")).toHaveScreenshot("button-default.png");
  });

  test("all variants match snapshot", async ({ page }) => {
    await page.goto("/storybook-iframe?id=components-button--all-variants");
    await expect(page.locator(".sb-main-padded")).toHaveScreenshot(
      "button-all-variants.png"
    );
  });

  test("hover state", async ({ page }) => {
    await page.goto("/storybook-iframe?id=components-button--default");
    const button = page.locator("button");
    await button.hover();
    await expect(button).toHaveScreenshot("button-hover.png");
  });

  test("focus state", async ({ page }) => {
    await page.goto("/storybook-iframe?id=components-button--default");
    const button = page.locator("button");
    await button.focus();
    await expect(button).toHaveScreenshot("button-focus.png");
  });
});
```

#### Pattern 7.4: Testing Compound Components

```typescript
// dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./dialog";

describe("Dialog", () => {
  const renderDialog = () => {
    return render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    );
  };

  it("opens when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("closes when close button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes when Escape key is pressed", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("traps focus within dialog", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));

    // Focus should be trapped within dialog
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.tab();
    // Focus cycles within dialog elements
  });

  it("returns focus to trigger on close", async () => {
    const user = userEvent.setup();
    renderDialog();

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
```

### Anti-Patterns

```typescript
// BAD: Testing implementation details
it("has correct className", () => {
  render(<Button />);
  const button = screen.getByRole("button");
  expect(button).toHaveClass("Button_base__xyz123"); // Implementation detail
});

// BAD: Using querySelector instead of Testing Library queries
it("renders button", () => {
  const { container } = render(<Button>Click</Button>);
  const button = container.querySelector("button"); // Avoid this
  // Use: screen.getByRole("button")
});

// BAD: Not using userEvent for interactions
it("handles click", () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click</Button>);
  screen.getByRole("button").click(); // Use userEvent.click() instead
});

// BAD: Forgetting async/await with userEvent
it("clicks button", () => {
  const user = userEvent.setup();
  render(<Button>Click</Button>);
  user.click(screen.getByRole("button")); // Missing await
});
```

### When to Use

**Use React Testing Library when:**
- Testing user-facing behavior (what user sees/does)
- Testing component interactions
- Need fast unit-style tests

**Use Playwright visual tests when:**
- Need to catch visual regressions
- Testing complex animations or transitions
- Verifying responsive layouts

**Do NOT over-test when:**
- Testing third-party library behavior (trust Radix)
- Writing tests for trivial getters/setters
- Every prop permutation (test meaningful combinations)

---

## 8. Compound Component Patterns

### Core Patterns

Compound components share implicit state through React Context, allowing flexible composition while maintaining connected behavior.

#### Pattern 8.1: Context-Based State Sharing

```typescript
// components/accordion.tsx
import {
  createContext,
  useContext,
  useState,
  forwardRef,
  useId,
} from "react";

// Context for accordion state
type AccordionContextValue = {
  expandedItems: Set<string>;
  toggleItem: (value: string) => void;
  type: "single" | "multiple";
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within <Accordion>");
  }
  return context;
}

// Context for individual item
type AccordionItemContextValue = {
  value: string;
  isExpanded: boolean;
  triggerId: string;
  contentId: string;
};

const AccordionItemContext = createContext<AccordionItemContextValue | null>(
  null
);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error(
      "AccordionTrigger/Content must be used within <AccordionItem>"
    );
  }
  return context;
}

// Root component
export type AccordionProps = {
  type?: "single" | "multiple";
  defaultValue?: string[];
  children: React.ReactNode;
  className?: string;
};

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ type = "single", defaultValue = [], children, className }, ref) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(
      new Set(defaultValue)
    );

    const toggleItem = (value: string) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
        } else {
          if (type === "single") {
            next.clear();
          }
          next.add(value);
        }
        return next;
      });
    };

    return (
      <AccordionContext.Provider value={{ expandedItems, toggleItem, type }}>
        <div ref={ref} className={className} data-accordion-root>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);

Accordion.displayName = "Accordion";

// Item component
export type AccordionItemProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, children, className }, ref) => {
    const { expandedItems } = useAccordionContext();
    const triggerId = useId();
    const contentId = useId();
    const isExpanded = expandedItems.has(value);

    return (
      <AccordionItemContext.Provider
        value={{ value, isExpanded, triggerId, contentId }}
      >
        <div
          ref={ref}
          className={className}
          data-state={isExpanded ? "open" : "closed"}
          data-accordion-item
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);

AccordionItem.displayName = "AccordionItem";

// Trigger component
export type AccordionTriggerProps = React.ComponentProps<"button">;

export const AccordionTrigger = forwardRef<
  HTMLButtonElement,
  AccordionTriggerProps
>(({ children, className, ...props }, ref) => {
  const { toggleItem } = useAccordionContext();
  const { value, isExpanded, triggerId, contentId } = useAccordionItemContext();

  return (
    <button
      ref={ref}
      id={triggerId}
      className={className}
      type="button"
      aria-expanded={isExpanded}
      aria-controls={contentId}
      data-state={isExpanded ? "open" : "closed"}
      onClick={() => toggleItem(value)}
      {...props}
    >
      {children}
    </button>
  );
});

AccordionTrigger.displayName = "AccordionTrigger";

// Content component
export type AccordionContentProps = {
  children: React.ReactNode;
  className?: string;
};

export const AccordionContent = forwardRef<
  HTMLDivElement,
  AccordionContentProps
>(({ children, className }, ref) => {
  const { isExpanded, triggerId, contentId } = useAccordionItemContext();

  return (
    <div
      ref={ref}
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      className={className}
      data-state={isExpanded ? "open" : "closed"}
      hidden={!isExpanded}
    >
      {children}
    </div>
  );
});

AccordionContent.displayName = "AccordionContent";
```

**Usage:**

```tsx
<Accordion type="single" defaultValue={["item-1"]}>
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>
      Yes! It follows WAI-ARIA Accordion pattern.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Is it styled?</AccordionTrigger>
    <AccordionContent>
      It has no default styles - bring your own CSS.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

#### Pattern 8.2: Controlled and Uncontrolled Modes

```typescript
// Extended Accordion with controlled mode
export type AccordionRootProps = {
  type?: "single" | "multiple";
  // Uncontrolled
  defaultValue?: string[];
  // Controlled
  value?: string[];
  onValueChange?: (value: string[]) => void;
  children: React.ReactNode;
  className?: string;
};

export const Accordion = forwardRef<HTMLDivElement, AccordionRootProps>(
  (
    {
      type = "single",
      defaultValue = [],
      value: controlledValue,
      onValueChange,
      children,
      className,
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState<string[]>(
      defaultValue
    );

    const currentValue = isControlled ? controlledValue : uncontrolledValue;
    const expandedItems = new Set(currentValue);

    const toggleItem = (itemValue: string) => {
      const newValue = [...currentValue];
      const index = newValue.indexOf(itemValue);

      if (index > -1) {
        newValue.splice(index, 1);
      } else {
        if (type === "single") {
          newValue.length = 0;
        }
        newValue.push(itemValue);
      }

      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <AccordionContext.Provider value={{ expandedItems, toggleItem, type }}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
```

#### Pattern 8.3: Compound Component with Subcomponent Pattern

```typescript
// Alternative: Attach subcomponents to main component
// This provides better discoverability and IDE autocomplete

const AccordionRoot = forwardRef<HTMLDivElement, AccordionProps>(
  // ... implementation
);

AccordionRoot.displayName = "Accordion";

// Attach subcomponents
export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});

// Usage becomes:
<Accordion>
  <Accordion.Item value="1">
    <Accordion.Trigger>Title</Accordion.Trigger>
    <Accordion.Content>Content</Accordion.Content>
  </Accordion.Item>
</Accordion>
```

### Anti-Patterns

```typescript
// BAD: Requiring specific children order via array index
const Tabs = ({ children }) => {
  const triggers = children[0]; // Fragile
  const panels = children[1];   // Will break if order changes
};

// BAD: Passing state through props drilling
<Accordion expanded={expanded} setExpanded={setExpanded}>
  <AccordionItem expanded={expanded} setExpanded={setExpanded} value="1">
    <AccordionTrigger expanded={expanded} setExpanded={setExpanded}>
      {/* Every level needs the props */}
    </AccordionTrigger>
  </AccordionItem>
</Accordion>

// BAD: Not providing context error boundaries
const useAccordionContext = () => {
  const context = useContext(AccordionContext);
  return context; // Returns null if used outside provider - no error
};

// BAD: Leaking internal IDs
<AccordionTrigger id="custom-id" /> // Should not override internal accessibility IDs
```

### When to Use

**Use compound components when:**
- Components have strong parent-child relationships
- Flexible composition is needed (order can vary)
- State needs to be shared implicitly
- Building complex interactive widgets (accordion, tabs, menu)

**Do NOT use when:**
- Simple component with no subcomponents
- State sharing is not needed
- Props drilling is minimal (1-2 levels)

---

## 9. Polymorphic Component Patterns

### Core Patterns

Polymorphic components can render as different HTML elements or other components while maintaining type safety.

#### Pattern 9.1: Basic Polymorphic Component

```typescript
// components/box.tsx
import { forwardRef } from "react";

// Generic type for polymorphic component
type BoxOwnProps<E extends React.ElementType = React.ElementType> = {
  as?: E;
};

type BoxProps<E extends React.ElementType> = BoxOwnProps<E> &
  Omit<React.ComponentProps<E>, keyof BoxOwnProps>;

// Default element type
type BoxComponent = <E extends React.ElementType = "div">(
  props: BoxProps<E> & { ref?: React.Ref<React.ElementRef<E>> }
) => React.ReactNode;

export const Box: BoxComponent = forwardRef(
  <E extends React.ElementType = "div">(
    { as, ...props }: BoxProps<E>,
    ref: React.Ref<React.ElementRef<E>>
  ) => {
    const Component = as || "div";
    return <Component ref={ref} {...props} />;
  }
);

// Usage
<Box>Default div</Box>
<Box as="span">Span element</Box>
<Box as="section">Section element</Box>
<Box as="a" href="/home">Anchor with href prop</Box>
```

#### Pattern 9.2: Radix Slot Pattern (Simpler Alternative)

```typescript
// Using Radix Slot for polymorphism
import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";

export type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline";
  size?: "default" | "sm" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, variant = "default", size = "default", className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

// Usage
// As button (default)
<Button onClick={handleClick}>Click me</Button>

// As anchor (using asChild)
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// As Next.js Link
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

// As custom component
<Button asChild variant="destructive">
  <MyCustomLink to="/delete">Delete</MyCustomLink>
</Button>
```

#### Pattern 9.3: Type-Safe Polymorphic with Discriminated Union

```typescript
// components/text.tsx
import { forwardRef, type ComponentPropsWithRef, type ElementType } from "react";

type TextOwnProps<E extends ElementType> = {
  as?: E;
  size?: "sm" | "base" | "lg" | "xl";
  weight?: "normal" | "medium" | "bold";
};

type TextProps<E extends ElementType> = TextOwnProps<E> &
  Omit<ComponentPropsWithRef<E>, keyof TextOwnProps<E>>;

type TextComponent = <E extends ElementType = "span">(
  props: TextProps<E>
) => JSX.Element | null;

export const Text: TextComponent = forwardRef(function Text<
  E extends ElementType = "span",
>(
  { as, size = "base", weight = "normal", className, ...props }: TextProps<E>,
  ref: ComponentPropsWithRef<E>["ref"]
) {
  const Component = as || "span";

  return (
    <Component
      ref={ref}
      className={className}
      data-size={size}
      data-weight={weight}
      {...props}
    />
  );
}) as TextComponent;

// Usage with full type safety
<Text>Default span</Text>
<Text as="p" size="lg">Paragraph</Text>
<Text as="h1" size="xl" weight="bold">Heading</Text>
<Text as="label" htmlFor="email">Label with htmlFor</Text>
<Text as="a" href="/home">Anchor with href</Text>
```

#### Pattern 9.4: Constrained Polymorphism

```typescript
// Only allow specific elements
type AllowedTextElements = "p" | "span" | "h1" | "h2" | "h3" | "h4" | "label";

type TextProps<E extends AllowedTextElements = "span"> = {
  as?: E;
} & Omit<React.ComponentProps<E>, "as">;

export const Text = <E extends AllowedTextElements = "span">({
  as,
  ...props
}: TextProps<E>) => {
  const Component = as || "span";
  return <Component {...props} />;
};

// Usage
<Text as="h1">Allowed</Text>
<Text as="div">Error - div not in AllowedTextElements</Text>
```

### Anti-Patterns

```typescript
// BAD: Losing type safety with 'any'
type BoxProps = {
  as?: any; // Loses all type checking
  children: React.ReactNode;
};

// BAD: Not forwarding ref correctly
const Box = ({ as: Component = "div", ...props }) => {
  return <Component {...props} />; // Missing ref forwarding
};

// BAD: Not handling conflicting props
// When 'as' changes, some props become invalid
<Button as="a" type="submit" /> // type="submit" invalid on anchor

// BAD: Overcomplicating simple cases
// If you only need button OR anchor, use discriminated union instead
type ButtonProps =
  | { variant: "button"; onClick: () => void }
  | { variant: "link"; href: string };
```

### When to Use

**Use polymorphic components when:**
- Component can semantically be multiple elements (Text as p/span/h1)
- Need button that can be anchor for navigation
- Building low-level primitives like Box, Text, Flex

**Use `asChild` pattern when:**
- Simpler implementation is sufficient
- Using Radix UI already
- Don't need complex type inference

**Do NOT use when:**
- Component has single semantic purpose
- Would add complexity without benefit
- Simple prop like `href` can conditionally render anchor

---

## 10. Accessibility-First Component Design

### Core Patterns

#### Pattern 10.1: Semantic HTML Foundation

```typescript
// components/card.tsx
import { forwardRef } from "react";

export type CardProps = React.ComponentProps<"article"> & {
  as?: "article" | "section" | "div";
};

export const Card = forwardRef<HTMLElement, CardProps>(
  ({ as: Component = "article", children, ...props }, ref) => {
    return (
      <Component ref={ref} {...props}>
        {children}
      </Component>
    );
  }
);

Card.displayName = "Card";

// Use article for self-contained content (blog post, product card)
// Use section for thematic grouping
// Use div only when no semantic meaning

// components/navigation.tsx
export const Navigation = ({ children, label }: NavigationProps) => {
  return (
    <nav aria-label={label}>
      <ul role="list">{children}</ul>
    </nav>
  );
};
```

#### Pattern 10.2: ARIA Attributes

```typescript
// components/alert.tsx
import { forwardRef } from "react";

export type AlertProps = React.ComponentProps<"div"> & {
  variant: "info" | "warning" | "error" | "success";
  /** Use 'assertive' for errors, 'polite' for info */
  politeness?: "polite" | "assertive";
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant, politeness = "polite", children, ...props }, ref) => {
    // Error alerts should interrupt screen reader
    const ariaLive = variant === "error" ? "assertive" : politeness;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live={ariaLive}
        data-variant={variant}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = "Alert";
```

#### Pattern 10.3: Keyboard Navigation

```typescript
// components/tabs.tsx
import { forwardRef, useRef, useState, useId, useCallback } from "react";

export type TabsProps = {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  defaultTab?: string;
};

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, defaultTab }, ref) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const baseId = useId();

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const currentIndex = tabs.findIndex((t) => t.id === activeTab);
        let nextIndex: number;

        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            nextIndex =
              currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
            break;
          case "ArrowRight":
            e.preventDefault();
            nextIndex =
              currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
            break;
          case "Home":
            e.preventDefault();
            nextIndex = 0;
            break;
          case "End":
            e.preventDefault();
            nextIndex = tabs.length - 1;
            break;
          default:
            return;
        }

        const nextTab = tabs[nextIndex];
        setActiveTab(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      },
      [activeTab, tabs]
    );

    return (
      <div ref={ref}>
        <div role="tablist" aria-label="Content tabs" onKeyDown={handleKeyDown}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            tabIndex={0}
          >
            {tab.content}
          </div>
        ))}
      </div>
    );
  }
);

Tabs.displayName = "Tabs";
```

#### Pattern 10.4: Focus Management

```typescript
// hooks/use-focus-trap.ts
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}

// Usage in Dialog
export const Dialog = ({ open, children }: DialogProps) => {
  const contentRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  return (
    <div ref={contentRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
};
```

#### Pattern 10.5: Screen Reader Announcements

```typescript
// components/visually-hidden.tsx
import { forwardRef } from "react";

export type VisuallyHiddenProps = React.ComponentProps<"span">;

/**
 * Visually hides content while keeping it accessible to screen readers.
 * Use for providing context that sighted users get from visual cues.
 */
export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

VisuallyHidden.displayName = "VisuallyHidden";

// Usage
<button>
  <TrashIcon />
  <VisuallyHidden>Delete item</VisuallyHidden>
</button>

// components/live-region.tsx
export const LiveRegion = ({
  children,
  politeness = "polite",
}: {
  children: React.ReactNode;
  politeness?: "polite" | "assertive";
}) => {
  return (
    <div aria-live={politeness} aria-atomic="true">
      {children}
    </div>
  );
};

// Usage for dynamic announcements
const [message, setMessage] = useState("");

<LiveRegion>{message}</LiveRegion>

// When action completes:
setMessage("Item deleted successfully");
```

#### Pattern 10.6: Color Contrast and Visual Indicators

```scss
// Never rely on color alone
.status {
  // BAD: Color only
  &[data-status="error"] {
    color: hsl(var(--color-destructive));
  }

  // GOOD: Color + icon + text
  &[data-status="error"] {
    color: hsl(var(--color-destructive));

    &::before {
      content: "Error: "; // Text indicator
    }
  }
}

// Ensure sufficient contrast
.button {
  // Primary button: dark background, light text
  background-color: hsl(var(--color-primary)); // gray-900
  color: hsl(var(--color-primary-foreground)); // white
  // Contrast ratio: > 7:1 (WCAG AAA)

  // Focus indicator must be visible
  &:focus-visible {
    outline: 2px solid hsl(var(--color-ring));
    outline-offset: 2px;
  }
}
```

#### Pattern 10.7: Reduced Motion Support

```scss
// Respect user preference for reduced motion
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// Or selectively disable animations
.accordion-content {
  transition: height var(--duration-normal) var(--ease-default);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
```

```typescript
// Hook for motion preference
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReduced;
}

// Usage
const prefersReducedMotion = usePrefersReducedMotion();

const animationDuration = prefersReducedMotion ? 0 : 200;
```

### Anti-Patterns

```typescript
// BAD: Using div for interactive elements
<div onClick={handleClick}>Click me</div>
// Should be: <button onClick={handleClick}>Click me</button>

// BAD: Missing form labels
<input type="email" placeholder="Email" />
// Should have: <label htmlFor="email">Email</label>

// BAD: Icon-only button without accessible name
<button><TrashIcon /></button>
// Should have: aria-label="Delete" or <VisuallyHidden>Delete</VisuallyHidden>

// BAD: Using tabIndex > 0
<div tabIndex={5}>Focusable</div>
// tabIndex should only be -1, 0, or omitted

// BAD: Removing focus outlines without replacement
button:focus {
  outline: none; // Breaks keyboard navigation
}

// BAD: Auto-playing media without controls
<video autoPlay />
// Should have: controls, or be pausable

// BAD: Missing skip links for long navigation
// First focusable element should be "Skip to main content"
```

### WCAG Quick Reference

| Criterion | Level | Requirement |
|-----------|-------|-------------|
| 1.1.1 Non-text Content | A | Alt text for images, icons |
| 1.4.3 Contrast | AA | 4.5:1 for text, 3:1 for large text |
| 1.4.11 Non-text Contrast | AA | 3:1 for UI components, graphics |
| 2.1.1 Keyboard | A | All functionality via keyboard |
| 2.4.3 Focus Order | A | Logical tab order |
| 2.4.7 Focus Visible | AA | Visible focus indicator |
| 4.1.2 Name, Role, Value | A | Accessible names for all controls |

### When to Use

**Always use accessibility patterns:**
- Accessibility is not optional - it is a legal requirement (ADA, EAA)
- Every interactive component needs keyboard support
- Every image needs alt text (or `alt=""` for decorative)
- Every form control needs a label

**Prioritize:**
1. Semantic HTML (most impact, least effort)
2. Keyboard navigation (critical for many users)
3. Focus management (especially for modals, menus)
4. Screen reader support (ARIA when HTML insufficient)
5. Color contrast (4.5:1 minimum)
6. Motion preferences (respect `prefers-reduced-motion`)

---

## Summary: Quick Reference by Pattern

| Pattern | Primary Use Case | Key Benefit |
|---------|-----------------|-------------|
| Atomic Design | Component library organization | Consistent vocabulary, scalable architecture |
| Radix UI | Accessible primitives | Handles a11y, you own styling |
| shadcn/ui | Copy-paste components | Full ownership, customization |
| Design Tokens | Theming foundation | Single source of truth, theme switching |
| Theme Switching | Light/dark mode | User preference, system respect |
| Storybook | Component documentation | Visual testing, team alignment |
| Testing (RTL) | Component behavior | User-centric tests, confidence |
| Compound Components | Complex widgets | Implicit state sharing, flexible composition |
| Polymorphic | Element flexibility | One component, many elements |
| Accessibility | Universal usability | Legal compliance, inclusive design |

---

## Decision Framework: Which Pattern to Use

```
Building component library?
├─ YES → Atomic Design + Storybook + Design Tokens
└─ NO → Skip full atomic structure

Need accessible primitives?
├─ YES → Radix UI (unstyled) OR MUI/Chakra (styled)
└─ NO → Simple HTML elements

Want full component ownership?
├─ YES → shadcn/ui patterns (copy to your code)
└─ NO → npm package (MUI, Chakra, Radix Themes)

Component has multiple variants?
├─ YES → cva for variant management
└─ NO → Simple props

Component can be multiple elements?
├─ YES → Polymorphic (asChild or full generic)
└─ NO → Single element type

Components share implicit state?
├─ YES → Compound component with Context
└─ NO → Simple props drilling

Every component:
└─ MUST have keyboard navigation
└─ MUST have accessible name
└─ MUST have visible focus state
└─ MUST meet color contrast requirements
```

---

_Last updated: 2026-01-15_
