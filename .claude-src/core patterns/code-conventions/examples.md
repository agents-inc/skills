# Code Conventions - Examples

---

## Component Architecture

### ✅ Example: Component with class-variance-authority (Actual Pattern)

```typescript
// packages/ui/src/components/button/button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import styles from "./button.module.scss";

// ✅ Define variants with cva for type-safe variant management
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: clsx(styles.btn, styles.btnDefault),
      ghost: clsx(styles.btn, styles.btnGhost),
      link: clsx(styles.btn, styles.btnLink),
    },
    size: {
      default: clsx(styles.btn, styles.btnSizeDefault),
      large: clsx(styles.btn, styles.btnSizeLarge),
      icon: clsx(styles.btn, styles.btnSizeIcon),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

// ✅ Use 'type' (not interface) for component props
// ✅ Extend React.ComponentProps for native HTML props
// ✅ Intersect with VariantProps for type-safe variants
export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

// ✅ Named export (no default export)
// ✅ Forward refs for all interactive components
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={clsx(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

// ✅ Export both component and variants
export { buttonVariants };
```

**Component directory structure:**

```
packages/ui/src/components/button/
├── button.tsx              # Component implementation
├── button.module.scss      # SCSS Module styles
└── button.stories.tsx      # Ladle stories
```

**Usage:**

```typescript
import { Button } from "@repo/ui/button";

<Button variant="ghost" size="large">Click me</Button>
```

**Why:** Type-safe variants with cva. Polymorphic with asChild. Native HTML props. Tree-shakeable named exports.

**Key Patterns:**

- ✅ Use `type` for component props (enables VariantProps intersection when needed)
- ✅ Use `cva` for variant definitions **ONLY when component has multiple variants**
- ✅ Use `clsx` for className merging
- ✅ Use `asChild` for polymorphic components (via Radix Slot) - design system components
- ✅ Named exports only
- ✅ kebab-case file names
- ✅ SCSS Modules for styles
- ✅ Forward refs

**When to use cva:**
- Component has multiple size options (sm, md, lg)
- Component has multiple visual variants (primary, secondary, ghost)
- Component has multiple state variations that combine (variant × size)

**When NOT to use cva:**
- Simple component with single styling
- No variants needed
- Just use `className` directly

---

### ✅ Example: Simple Component WITHOUT cva (Feature List)

```typescript
// packages/ui/src/patterns/feature/feature.tsx
import { useState } from "react";
import clsx from "clsx";
import { Switch } from "@radix-ui/react-switch";
import styles from "./feature.module.scss";

// ✅ Type definition co-located with component
export type FeatureProps = {
  id: string;
  title: string;
  status: string;
  description: string;
};

// ✅ Named export
// ✅ NO cva needed - this component has no variants
export const Feature = ({ id, title, status, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li
      className={clsx(styles.feature)}  // ✅ Simple className, no variants needed
      onClick={() => setIsExpanded((prev) => !prev)}
      data-expanded={isExpanded}
      data-testid="feature"
    >
      <Switch
        id={`${id}-switch`}
        className={styles.switch}
        checked={status === "done"}
        onClick={(event) => {
          event.stopPropagation();
        }}
      />
      <div>
        <strong>{title}</strong>
        {isExpanded && <p>{description}</p>}
      </div>
    </li>
  );
};
```

**Why:** Simple, focused component. No variants = no need for cva. Uses Radix UI primitives. Type-safe. data-attributes for state styling.

**Key Point:** Don't use cva when you don't have variants. Keep it simple!

---

## File and Directory Naming

### ✅ Example: Actual Codebase Structure

```
packages/ui/src/
├── components/
│   ├── button/
│   │   ├── button.tsx              # ✅ kebab-case
│   │   ├── button.module.scss      # ✅ SCSS Module
│   │   └── button.stories.tsx      # ✅ Ladle story
│   ├── switch/
│   │   ├── switch.tsx
│   │   ├── switch.module.scss
│   │   └── switch.stories.tsx
│   └── select/
│       ├── select.tsx
│       ├── select.module.scss
│       └── select.stories.tsx
├── patterns/
│   ├── feature/
│   │   ├── feature.tsx
│   │   ├── feature.module.scss
│   │   └── feature.stories.tsx
│   └── navigation/
│       ├── navigation.tsx
│       ├── navigation.module.scss
│       └── navigation.stories.tsx
└── templates/
    └── frame/
        ├── frame.tsx
        ├── frame.module.scss
        └── frame.stories.tsx
```

```
apps/
├── client-next/           # ✅ kebab-case directory
├── client-react/          # ✅ kebab-case directory
└── server/

packages/
├── api-mocks/             # ✅ kebab-case directory
├── eslint-config/         # ✅ kebab-case directory
└── typescript-config/     # ✅ kebab-case directory
```

### ❌ WRONG: PascalCase files

```
components/Button/
├── Button.tsx             # ❌ PascalCase
├── Button.module.css      # ❌ .css instead of .scss
└── Button.test.tsx
```

### ✅ CORRECT: kebab-case files

```
components/button/
├── button.tsx             # ✅ kebab-case
├── button.module.scss     # ✅ .scss
└── button.test.tsx
```

**Why:** Consistent across all platforms. Case-sensitive filesystems won't cause issues. Easier to type.

---

## Import/Export Patterns

### ✅ Example: Named Exports (Actual Pattern)

```typescript
// packages/ui/src/components/button/button.tsx

// ✅ Named exports ONLY (no default export)
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
export { buttonVariants };
```

```typescript
// ❌ WRONG: Default export
export default Button;  // ❌ Don't do this in libraries!
```

### ✅ Example: Package Exports Pattern

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "exports": {
    "./global.scss": "./src/styles/global.scss",
    "./skeleton": "./src/primitives/skeleton/skeleton.tsx",
    "./info": "./src/components/info/info.tsx",
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx",
    "./select": "./src/components/select/select.tsx",
    "./feature": "./src/patterns/feature/feature.tsx",
    "./navigation": "./src/patterns/navigation/navigation.tsx",
    "./frame": "./src/templates/frame/frame.tsx",
    "./hooks": "./src/hooks/index.ts"
  }
}
```

**Usage:**

```typescript
// ✅ Import from package exports
import { Button } from "@repo/ui/button";
import { Switch } from "@repo/ui/switch";
import { useIsMobile } from "@repo/ui/hooks";

// ❌ WRONG: Import from internal paths
import { Button } from "@repo/ui/src/components/button/button";
```

### Example: Import Organization

```typescript
// apps/client-next/app/features.tsx

// 1. React imports
import { useState, useEffect } from "react";

// 2. External dependencies
import { useQuery } from "@tanstack/react-query";

// 3. Internal workspace packages
import { getFeaturesOptions } from "@repo/api/reactQueries";
import { Feature } from "@repo/ui/feature";
import { Info } from "@repo/ui/info";
import { Skeleton } from "@repo/ui/skeleton";

// 4. Relative imports
import { Shell } from "./shell";
import styles from "./features.module.scss";
```

**Why:** Clear dependencies. Explicit API surface. Better tree-shaking. Named exports enable easier refactoring.

**Edge Cases:**

- Use package.json exports for granular imports
- Named exports enable tree-shaking
- No barrel files with all exports (use explicit package exports instead)

---

## Type Definitions

### ✅ Example: Component Props (Actual Pattern)

```typescript
// packages/ui/src/components/button/button.tsx
import { type VariantProps } from "class-variance-authority";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: clsx(styles.btn, styles.btnDefault),
      ghost: clsx(styles.btn, styles.btnGhost),
    },
    size: {
      default: clsx(styles.btn, styles.btnSizeDefault),
      large: clsx(styles.btn, styles.btnSizeLarge),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

// ✅ Use TYPE for component props (not interface)
// ✅ Enables intersection with VariantProps
export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

// ❌ WRONG: Using interface breaks VariantProps intersection
export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "ghost";  // ❌ Loses type inference from cva
  size?: "default" | "large";
  asChild?: boolean;
}
```

### ✅ Example: Data Model Types

```typescript
// packages/ui/src/patterns/feature/feature.tsx

// ✅ Type for component props (co-located)
export type FeatureProps = {
  id: string;
  title: string;
  status: string;
  description: string;
};

// ✅ Named export
export const Feature = ({ id, title, status, description }: FeatureProps) => {
  // ...
};
```

### ✅ Example: Data Types (Use Interface)

```typescript
// types/product.types.ts

// ✅ Interface for data models (can be extended)
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: ProductCategory;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ Type for unions
export type ProductCategory = "electronics" | "clothing" | "home" | "sports";

// ✅ Utility types
export type ProductId = Product["id"];
export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt">;
```

**Why:** Type allows intersection with VariantProps. Co-location makes types easier to find. No `I` prefix.

**Key Rules:**

- ✅ Use `type` for component props (enables VariantProps)
- ✅ Use `interface` for extendable data models
- ✅ Co-locate types with components
- ✅ Export prop types alongside components
- ❌ No `I` prefix (IProduct ❌, Product ✅)

---

## Constants and Magic Numbers

### Example: Constants and Magic Numbers

```typescript
// lib/constants.ts

// ✅ GOOD: Named constants
export const API_TIMEOUT_MS = 30000;
export const MAX_RETRY_ATTEMPTS = 3;
export const DEBOUNCE_DELAY_MS = 300;
export const PAGINATION_DEFAULT_LIMIT = 20;
export const CACHE_STALE_TIME_MS = 5 * 60 * 1000;

export const PRODUCT_CATEGORIES = ["electronics", "clothing", "home", "sports"] as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;

// Usage
import { API_TIMEOUT_MS, HTTP_STATUS } from "@/lib/constants";

const response = await fetch(url, {
  signal: AbortSignal.timeout(API_TIMEOUT_MS),
});

if (response.status === HTTP_STATUS.UNAUTHORIZED) {
  redirectToLogin();
}

// ❌ BAD: Magic numbers everywhere
setTimeout(() => {}, 300); // What's 300?
if (response.status === 401) {
  /* ... */
}
const limit = 20; // Why 20?
```

**Why:** Self-documenting. Easy to change. No magic numbers. Type-safe.

**Edge Cases:**

- Use UPPER_SNAKE_CASE for constants
- Group related constants in objects
- Make constants `as const` for literal types

---

## TypeScript Strictness

### Example: Required tsconfig.json Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## Error Handling Patterns

### Example: Custom Error Types and Consistent Handling

```typescript
// Custom error types
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Consistent error handling
try {
  const data = await apiClient.getUser(userId);
  return data;
} catch (error) {
  if (error instanceof APIError) {
    // Handle API errors
    logger.error("API Error", { endpoint: error.endpoint, status: error.statusCode });
    toast.error(getFriendlyErrorMessage(error));
  } else {
    // Handle unknown errors
    logger.error("Unexpected error", error);
    toast.error("Something went wrong. Please try again.");
  }
  throw error;
}
```

---

## Form Patterns and Validation

_Examples coming soon_

---

## Performance Optimization

_Examples coming soon_

---

## Event Handlers

### Example: Event Handlers and Callbacks

```typescript
// ✅ GOOD: Descriptive event handler names
function ProductForm() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // ...
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handlePriceBlur = () => {
    if (price < 0) {
      setPrice(0);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleNameChange} />
      <input onBlur={handlePriceBlur} />
    </form>
  );
}

// ❌ BAD: Generic names, unclear purpose
function ProductForm() {
  const submit = (e) => { /* ... */ };
  const change = (e) => { /* ... */ };
  const blur = () => { /* ... */ };

  return (
    <form onSubmit={submit}>
      <input onChange={change} />
      <input onBlur={blur} />
    </form>
  );
}
```

**Why:** Clear intent. Easy to trace. Searchable. Self-documenting.

**Edge Cases:**

- Use `handle` prefix for event handlers
- Use `on` prefix for prop callbacks
- Type events explicitly

---

## Component State Styling

### ✅ Example: Data Attributes for State (Actual Pattern)

**Pattern:** Use `data-*` attributes to represent component state, then style based on those attributes in CSS/SCSS.

```typescript
// Example: Feature list item component
import { useState } from "react";
import styles from "./feature.module.scss";

type FeatureProps = {
  id: string;
  title: string;
  status: string;
  description: string;
};

export const Feature = ({ id, title, status, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li
      className={styles.feature}
      onClick={() => setIsExpanded((prev) => !prev)}
      data-expanded={isExpanded}      // ✅ State as data-attribute
      data-testid="feature"
    >
      {/* content */}
    </li>
  );
};
```

```scss
// feature.module.scss
.feature {
  padding: var(--space-md);
  cursor: pointer;

  // ✅ Style based on data-attribute
  &[data-expanded="true"] {
    background-color: var(--color-surface-subtle);

    p {
      display: block;
    }
  }

  &[data-expanded="false"] {
    p {
      display: none;
    }
  }
}
```

### ✅ Example: Button Active State

```typescript
// packages/ui/src/components/button/button.tsx
<button
  data-active={isActive}
  className={styles.btn}
>
  {children}
</button>
```

```scss
// button.module.scss
.btn {
  background: var(--color-surface-base);
  color: var(--color-text-default);

  &[data-active="true"] {
    color: var(--color-text-muted);
    background: var(--color-surface-strong);
  }
}
```

### ❌ WRONG: className toggling

```typescript
// ❌ BAD: Conditional className strings
<div className={clsx(styles.feature, isExpanded && styles.expanded)}>
  {/* content */}
</div>
```

**Why:** Data-attributes make state visible in DevTools. Cleaner separation of concerns. No need for extra CSS classes.

---

## Component Documentation (Ladle Stories)

**NOTE: Stories are required for design system components only (packages/ui/), not app-specific features**

### ✅ Example: Design System Component Story (Required)

```typescript
// packages/ui/src/components/button/button.stories.tsx
// ✅ Stories REQUIRED for design system components
import type { Story } from "@ladle/react";
import { Button, type ButtonProps } from "./button";

export const Default: Story<ButtonProps> = () => (
  <Button>Default Button</Button>
);

export const Variants: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
    <Button variant="default">Default</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
  </div>
);

export const Sizes: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
    <Button size="default">Default Size</Button>
    <Button size="large">Large Size</Button>
    <Button size="icon">📌</Button>
  </div>
);

export const Disabled: Story<ButtonProps> = () => (
  <Button disabled>Disabled Button</Button>
);

export const AsChild: Story<ButtonProps> = () => (
  <Button asChild>
    <a href="/link">Link styled as Button</a>
  </Button>
);
```

### ✅ Example: Design System Pattern Story (Required)

```typescript
// packages/ui/src/patterns/feature/feature.stories.tsx
// ✅ Stories REQUIRED for design system patterns
import type { Story } from "@ladle/react";
import { Feature, type FeatureProps } from "./feature";

export const Default: Story<FeatureProps> = () => (
  <ul>
    <Feature
      id="1"
      title="Feature 1"
      status="done"
      description="This feature is complete"
    />
  </ul>
);

export const Multiple: Story<FeatureProps> = () => (
  <ul>
    <Feature
      id="1"
      title="Completed Feature"
      status="done"
      description="This feature is complete"
    />
    <Feature
      id="2"
      title="In Progress"
      status="pending"
      description="This feature is in progress"
    />
    <Feature
      id="3"
      title="Not Started"
      status="todo"
      description="This feature hasn't started yet"
    />
  </ul>
);
```

### ❌ Example: App-Specific Feature (NO Story Needed)

```typescript
// apps/client-next/app/features.tsx
// ❌ NO story needed - this is app-specific, not a design system component
export const FeaturesPage = () => {
  const { data } = useQuery(getFeaturesOptions());

  return (
    <Shell>
      {data?.features?.map((feature) => (
        <Feature key={feature.id} {...feature} />
      ))}
    </Shell>
  );
};
```

**Why:** Visual documentation for design system. Shows all variants. Easy to test visually. Helps designers understand reusable components.

**Key Patterns:**

- ✅ Stories required for: `packages/ui/src/` (primitives, components, patterns, templates)
- ❌ Stories NOT needed for: `apps/*/` (app-specific features, pages, layouts)
- ✅ One story per variant or use case
- ✅ Show all possible states
- ✅ Use descriptive story names
- ✅ Include edge cases (disabled, loading, error states)

---

## Icon Library

### ✅ Example: ACTUAL Icon Usage Pattern

**Pattern:** Import specific icons from `lucide-react` and use them as JSX components.

```typescript
// Example: Expandable feature component with conditional icons
import { ChevronDown, ChevronUp } from "lucide-react";  // ✅ Import specific icons
import { useState } from "react";
import { Button } from "@repo/ui/button";
import styles from "./feature.module.scss";

export const Feature = ({ title, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li onClick={() => setIsExpanded(!isExpanded)}>
      <h2>{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isExpanded ? "Collapse details" : "Expand details"}
      >
        {/* ✅ Use icon as JSX component */}
        {isExpanded ? (
          <ChevronUp className={styles.icon} />
        ) : (
          <ChevronDown className={styles.icon} />
        )}
      </Button>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
```

```scss
// packages/ui/src/patterns/feature/feature.module.scss

// ✅ Use design tokens for icon sizing
.icon {
  width: var(--text-size-icon);   // 16px
  height: var(--text-size-icon);
  // Color automatically inherits from parent
}
```

**Why:** Tree-shakeable imports, consistent styling with design tokens, automatic color inheritance.

---

### ✅ Example: Icon-Only Button with Accessibility

```typescript
// packages/ui/src/patterns/socials/socials.tsx
import { CircleUserRound, CodeXml } from "lucide-react";
import { Button } from "../../components/button/button";

export const Socials = () => {
  return (
    <ul>
      <li>
        {/* ✅ Icon-only button with proper accessibility */}
        <Button
          size="icon"
          title="View GitHub profile"        // Tooltip for sighted users
          aria-label="View GitHub profile"   // Screen reader label
          onClick={() => window.open("https://github.com/username", "_blank")}
        >
          <CodeXml />
        </Button>
      </li>
    </ul>
  );
};
```

**Why:** Icon-only buttons need both `title` (visual tooltip) and `aria-label` (screen reader).

---

### ✅ Example: Icon with Text

```typescript
import { Plus, Check, X } from "lucide-react";
import { Button } from "@repo/ui/button";

// ✅ Icon with descriptive text
<Button>
  <Plus />
  Add Item
</Button>

<Button variant="ghost">
  <Check />
  Save Changes
</Button>

<Button variant="ghost">
  <X />
  Cancel
</Button>
```

**Why:** Text labels make buttons clearer, especially for complex actions.

---

### ❌ WRONG: Common Mistakes

```typescript
// ❌ WRONG: Importing entire library
import * as LucideIcons from "lucide-react";
<LucideIcons.ChevronDown />  // Don't do this!

// ❌ WRONG: Icon-only button without aria-label
<Button size="icon">
  <Plus />  // No way for screen readers to know what this does
</Button>

// ❌ WRONG: Hardcoded icon size
.icon {
  width: 16px;  // Use var(--text-size-icon) instead!
  height: 16px;
}

// ❌ WRONG: Multiple icon libraries
import { Check } from "lucide-react";
import { FaCheck } from "react-icons/fa";  // Don't mix libraries!
```

---

### Example: Available Icons

```typescript
// Common lucide-react icons used in this codebase:
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  CircleUserRound,
  CodeXml,
  // ... and many more
} from "lucide-react";

// Full list: https://lucide.dev/icons/
```

**Why:** lucide-react provides 1000+ consistent, MIT-licensed icons.

**Key Patterns:**

- ✅ Import specific icons (tree-shakeable)
- ✅ Use as JSX components: `<IconName />`
- ✅ Style with className and design tokens
- ✅ Icons inherit `currentColor` automatically
- ✅ Always provide aria-label for icon-only buttons
- ❌ Never import entire library
- ❌ Never hardcode icon sizes
- ❌ Never mix multiple icon libraries
