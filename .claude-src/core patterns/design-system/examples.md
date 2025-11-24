# Design System - Examples

---

## Token Architecture

### Example: ACTUAL Two-Tier Token System (From `packages/ui/src/styles/variables.scss`)

```scss
// packages/ui/src/styles/variables.scss
:root {
  // ============================================
  // TIER 1: CORE TOKENS (Base primitives)
  // ============================================

  // Spacing - Base unit system
  --core-space-unit: 0.2rem; // 2px
  --core-space-2: calc(var(--core-space-unit) * 2); // 4px
  --core-space-4: calc(var(--core-space-unit) * 4); // 8px
  --core-space-6: calc(var(--core-space-unit) * 6); // 12px
  --core-space-8: calc(var(--core-space-unit) * 8); // 16px
  --core-space-10: calc(var(--core-space-unit) * 10); // 20px
  --core-space-12: calc(var(--core-space-unit) * 12); // 24px
  --core-space-16: calc(var(--core-space-unit) * 16); // 32px

  // Typography - Core sizes
  --core-text-size-1: 1.6rem; // 16px
  --core-text-size-2: 1.8rem; // 18px
  --core-text-size-3: 2rem;   // 20px

  // ============================================
  // TIER 2: SEMANTIC TOKENS (Purpose-driven)
  // ============================================

  // Colors - Reference Open Props
  --color-primary: var(--blue-2);
  --color-accent: var(--cyan-4);
  --color-accent-brighter: var(--cyan-5);

  --color-text-default: var(--gray-7);
  --color-text-muted: var(--stone-2);
  --color-text-subtle: var(--gray-6);
  --color-text-inverted: var(--gray-0);

  --color-surface-base: var(--gray-0);
  --color-surface-subtle: var(--stone-3);
  --color-surface-strong: var(--gray-7);
  --color-surface-stronger: var(--gray-8);
  --color-surface-strongest: var(--gray-12);

  // Spacing - Semantic names
  --space-sm: var(--core-space-2);   // 4px
  --space-md: var(--core-space-4);   // 8px
  --space-lg: var(--core-space-6);   // 12px
  --space-xlg: var(--core-space-10);  // 20px
  --space-xxlg: var(--core-space-12); // 24px
  --space-xxxlg: var(--core-space-16); // 32px

  // Typography - Semantic names
  --text-size-icon: var(--core-text-size-1);    // 16px
  --text-size-body: var(--core-text-size-1);    // 16px
  --text-size-body2: var(--core-text-size-2);   // 18px
  --text-size-heading: var(--core-text-size-3); // 20px

  // Border radius - Reference Open Props or define locally
  --radius-sm: 0.4rem;
  --radius-full: 9999px;
  --radius-circle: 50%;

  // Shadows - Reference Open Props
  --shadow-md: var(--shadow-2);
  --shadow-lg: var(--shadow-3);
}
```

### Example: Using Tokens in Component SCSS Module

```scss
// packages/ui/src/components/button/button.module.scss

.btn {
  // ✅ Use semantic tokens
  font-size: var(--text-size-body);
  padding: var(--space-md);
  border-radius: var(--radius-sm);

  // ❌ Never use core tokens directly
  // padding: var(--core-space-4);  // WRONG!

  // ❌ Never use Open Props directly
  // color: var(--gray-7);  // WRONG!
}

.btnDefault {
  background-color: var(--color-surface-base);
  color: var(--color-text-default);
}

.btnSizeDefault {
  padding: var(--space-md);
}

.btnSizeLarge {
  padding: var(--space-xlg) var(--space-xxlg);
}
```

**Why:** Two-tier system keeps tokens simple. Open Props provides base values. Semantic tokens make purpose clear.

**Key Rules:**
- Components use ONLY semantic tokens (Tier 2)
- Never use core tokens or Open Props directly in components
- Core tokens are building blocks for semantic tokens

---

## Color System

### Example: Semantic Color Usage

```scss
// Text colors
.heading {
  color: var(--color-text-default);  // Primary text
}

.description {
  color: var(--color-text-muted);    // Secondary text
}

.label {
  color: var(--color-text-subtle);   // Tertiary text
}

// Surface colors
.card {
  background: var(--color-surface-base);      // Default background
}

.card-hover {
  background: var(--color-surface-subtle);    // Subtle variation
}

.card-active {
  background: var(--color-surface-strong);    // Strong emphasis
}

// Accent colors
.button-primary {
  background: var(--color-primary);   // Primary brand color
}

.link {
  color: var(--color-accent);         // Accent for links
}
```

**Why:** Semantic naming makes color purpose clear, not just the value.

### Example: RGB Format with CSS Color Functions

```scss
// ✅ CORRECT: RGB format
.card {
  background: rgb(255 255 255);
  color: rgb(0 0 0 / 0.8);  // Transparency with space-separated syntax
}

.button {
  background: var(--color-primary);

  &:hover {
    background: color-mix(in srgb, var(--color-primary), white 10%);  // Lighten
  }
}

// ❌ WRONG: Don't use hex or Sass functions
.card {
  background: #ffffff;                           // NO!
  background: rgba(0, 0, 0, 0.5);               // NO!
  background: darken($color-primary, 10%);      // NO!
}
```

**Why:** RGB format eliminates Sass dependencies and works better with design tokens.

---

## Spacing System

### Example: Consistent Spacing with Semantic Tokens

```scss
// Small spacing
.compact-list {
  gap: var(--space-sm);  // 4px
}

// Medium spacing (most common)
.button {
  padding: var(--space-md);  // 8px
}

// Large spacing
.section {
  margin-bottom: var(--space-xlg);  // 20px
}

// Mixed spacing for visual hierarchy
.card {
  padding: var(--space-lg);           // 12px all sides
  margin-bottom: var(--space-xxlg);   // 24px bottom
}
```

**Why:** Consistent spacing scale creates visual rhythm across the entire UI.

---

## Typography

### Example: Typography Scale Usage

```scss
// Body text
.text {
  font-size: var(--text-size-body);  // 16px
}

// Larger body text
.intro {
  font-size: var(--text-size-body2);  // 18px
}

// Headings
h1, h2, h3 {
  font-size: var(--text-size-heading);  // 20px
}

// Icons
.icon {
  font-size: var(--text-size-icon);  // 16px
  width: var(--text-size-icon);
  height: var(--text-size-icon);
}
```

**Why:** REM-based typography respects user preferences, semantic names clarify usage.

---

## Theme Implementation

### Example: NOT IMPLEMENTED (Future Reference)

**Current Status:** This codebase does NOT implement theme switching (light/dark mode).

**If you need to add theme switching in the future:**

```scss
// Define theme-specific values
:root {
  --color-text-default: var(--gray-7);
  --color-surface-base: var(--gray-0);
}

[data-theme="dark"] {
  --color-text-default: var(--gray-0);
  --color-surface-base: var(--gray-7);
}
```

**Note:** The ThemeProvider example has been removed as it doesn't exist in this codebase. If needed, implement theme switching with data-attributes as shown above.

---

## SCSS Modules Pattern

### Example: Complete Component with SCSS Module

```typescript
// packages/ui/src/components/button/button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import styles from "./button.module.scss";

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

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

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
```

```scss
// packages/ui/src/components/button/button.module.scss
.btn {
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: var(--text-size-body);
  font-weight: 600;

  border-radius: var(--radius-sm);
  border: 1px solid transparent;

  cursor: pointer;
  transition: all 0.2s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btnDefault {
  background-color: var(--color-surface-base);
  color: var(--color-text-default);
  border-color: var(--color-surface-subtle);

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }

  &[data-active="true"] {
    color: var(--color-text-muted);
    background: var(--color-surface-strong);
  }
}

.btnGhost {
  background-color: transparent;

  &:hover:not(:disabled) {
    background-color: var(--color-surface-subtle);
  }
}

.btnSizeDefault {
  padding: var(--space-md);
}

.btnSizeLarge {
  padding: var(--space-xlg) var(--space-xxlg);
}

.btnSizeIcon {
  padding: var(--space-md);
  aspect-ratio: 1;
}
```

**Why:** SCSS Modules provide scoped styles. cva provides type-safe variants. Design tokens ensure consistency.

### Example: File Naming and Organization

```
packages/ui/src/
├── components/
│   ├── button/
│   │   ├── button.tsx              # Component
│   │   ├── button.module.scss      # Styles (matches component name)
│   │   └── button.stories.tsx      # Stories
│   ├── dropdown-menu/
│   │   ├── dropdown-menu.tsx       # Use hyphens for multi-word names
│   │   ├── dropdown-menu.module.scss
│   │   └── dropdown-menu.stories.tsx
│   └── select/
│       ├── select.tsx
│       ├── select.module.scss
│       └── select.stories.tsx
├── patterns/
│   ├── feature/
│   │   ├── feature.tsx
│   │   └── feature.module.scss
│   └── navigation/
│       ├── navigation.tsx
│       └── navigation.module.scss
└── primitives/
    └── skeleton/
        ├── skeleton.tsx
        └── skeleton.module.scss
```

**Naming Rules:**

```
✅ CORRECT:
- button.tsx → button.module.scss
- dropdown-menu.tsx → dropdown-menu.module.scss
- user-profile.tsx → user-profile.module.scss

❌ WRONG:
- button.tsx → Button.module.scss     (Capital letter)
- button.tsx → button-styles.scss     (Wrong suffix)
- button.tsx → buttonStyles.scss      (camelCase instead of hyphens)
- button.tsx → button.scss            (Missing .module)
```

**Why:** Consistent naming makes files easy to find, matches component names exactly, and follows CSS Modules conventions.

---

## Component Architecture

See code-conventions/examples.md Component Architecture section for detailed component examples.

---

## Component Structure Standards

### Example: Well-Structured Component

```scss
// ✅ GOOD: Variables at top, semantic names, data-attributes for state
.card {
  // Component variables at top
  --card-padding: var(--space-lg);
  --card-gap: var(--space-md);

  display: flex;
  flex-direction: column;
  gap: var(--card-gap);
  padding: var(--card-padding);
  background: var(--color-surface-base);
  border: 1px solid var(--color-surface-subtle);

  // Semantic nested elements
  .cardTitle {
    font-size: var(--text-size-heading);
    color: var(--color-text-default);
  }

  // State with data-attributes
  &[data-state="selected"] {
    border-color: var(--color-primary);
  }
}

.cardCompact {
  --card-padding: var(--space-md);
}
```

**Why:** Variables at top, semantic names describe purpose, data-attributes handle state cleanly.

### Example: Semantic vs Non-Semantic Class Names

```scss
// ❌ BAD: Non-semantic class names (describe appearance, not purpose)
.blueButton {
  background: var(--color-primary);  // What if primary isn't blue?
}

.bigText {
  font-size: var(--text-size-heading);  // Purpose unclear
}

.leftSection {
  padding: var(--space-lg);  // Layout changes break naming
}

// ✅ GOOD: Semantic class names (describe purpose)
.submitButton {
  background: var(--color-primary);  // Purpose is clear
}

.pageTitle {
  font-size: var(--text-size-heading);  // Role is clear
}

.sidebarContent {
  padding: var(--space-lg);  // Purpose stays consistent
}
```

**Why:** Semantic names remain accurate when visual design changes. `.submitButton` makes sense even if you change its color from blue to green.

---

## Component-Specific Variables

### Example: When to Create Component Variables

```scss
// ✅ GOOD: Component with multiple size variants - variables add value
.modal {
  // Component-specific variables that change between variants
  --modal-width-sm: 400px;
  --modal-width-md: 600px;
  --modal-width-lg: 900px;

  width: var(--modal-width-md);  // Default
  padding: var(--space-lg);
  background: var(--color-surface-base);
}

.modal[data-size="sm"] {
  width: var(--modal-width-sm);
}

.modal[data-size="lg"] {
  width: var(--modal-width-lg);
}
```

### Example: When NOT to Create Component Variables

```scss
// ❌ BAD: Single-use values don't need variables
.card {
  --card-border-width: 1px;       // Used only once - unnecessary!
  --card-border-radius: 0.5rem;   // Already have --radius-sm!

  border: var(--card-border-width) solid var(--color-surface-subtle);
  border-radius: var(--card-border-radius);
}

// ✅ GOOD: Use design tokens directly
.card {
  border: 1px solid var(--color-surface-subtle);
  border-radius: var(--radius-sm);
}
```

### Example: Complex Calculated Values

```scss
// ✅ GOOD: Complex calculation used multiple times
.sidebar {
  --sidebar-width: 280px;
  --content-width: calc(100% - var(--sidebar-width));

  width: var(--sidebar-width);
}

.main-content {
  width: var(--content-width);  // Reuse the calculation
  margin-left: var(--sidebar-width);
}
```

**Key Principle:** Only create component variables when they provide real value through reuse, variation, or runtime modification.

---

## Advanced CSS Features

### Example: :has() and Data-Attributes

```scss
// :has() for parent styling based on child state
.form:has(.inputError) {
  border-color: var(--color-error);
}

.formGroup:has(input:focus) {
  background: var(--color-surface-subtle);
}

// Data-attributes for state management
.dropdown {
  &[data-open="true"] {
    display: block;
  }

  &[data-state="error"] {
    border-color: var(--color-error);
  }

  &[data-size="large"][data-variant="primary"] {
    padding: var(--space-xlg);
  }
}
```

### Example: :global() and Nesting

```scss
// ✅ GOOD: Minimal :global() use
.component {
  padding: var(--space-md);

  :global(.dark-mode) & {
    background: var(--color-surface-strong);
  }
}

// ✅ GOOD: Shallow nesting (max 3 levels)
.nav {
  .navItem {
    &:hover {
      background: var(--color-surface-subtle);
    }
  }
}

// ❌ BAD: Deep nesting
.nav .navList .navItem .navLink .navIcon { }  // Too deep!
```

**Why:** Modern CSS features reduce JavaScript complexity and improve performance.

---

## Iconography

### Example: ACTUAL Icon Usage with lucide-react

```typescript
// packages/ui/src/patterns/feature/feature.tsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/button/button";
import styles from "./feature.module.scss";

export const Feature = ({ id, title, description, status }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li onClick={() => setIsExpanded(!isExpanded)}>
      <h2>{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        className={styles.expandButton}
        aria-label={isExpanded ? "Collapse details" : "Expand details"}
      >
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
.expandButton {
  // Button already has proper sizing
  // Icon inherits color from button
}

.icon {
  // Use design token for consistent sizing
  width: var(--text-size-icon);   // 16px
  height: var(--text-size-icon);
}
```

**Why:** lucide-react provides consistent, tree-shakeable icons. Icons inherit color automatically.

### Example: Icon-Only Buttons with Accessibility

```typescript
// packages/ui/src/patterns/socials/socials.tsx
import { CircleUserRound, CodeXml } from "lucide-react";
import { Button } from "../../components/button/button";

export const Socials = () => {
  return (
    <ul>
      <li>
        <Button
          size="icon"
          title="View GitHub profile"
          aria-label="View GitHub profile"
          onClick={() => window.open("https://github.com/username", "_blank")}
        >
          <CodeXml />
        </Button>
      </li>
      <li>
        <Button
          size="icon"
          title="Visit blog"
          aria-label="Visit blog"
          onClick={() => window.open("https://blog.example.com", "_blank")}
        >
          <CircleUserRound />
        </Button>
      </li>
    </ul>
  );
};
```

**Why:** Icon-only buttons need both `title` (for tooltip) and `aria-label` (for screen readers).

### Example: Icon Color Inheritance

```scss
// Icons automatically inherit currentColor
.successButton {
  color: var(--color-text-default);  // Icon inherits this

  &:hover {
    color: var(--color-accent);      // Icon color changes on hover
  }
}

.errorButton {
  color: var(--color-text-muted);    // Different icon color
}
```

```tsx
<Button className={styles.successButton}>
  <CheckCircle />  {/* Icon inherits green color */}
  Save
</Button>

<Button className={styles.errorButton}>
  <XCircle />  {/* Icon inherits red color */}
  Delete
</Button>
```

**Why:** Using `currentColor` keeps icon colors in sync with text, reducing duplication.
