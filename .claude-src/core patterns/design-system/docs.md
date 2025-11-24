# Design System

> **Quick Guide:** Two-tier token system (Base primitives → Semantic tokens). Tiered components (Primitives → Components → Patterns → Templates). Foreground/background color pairs. Components use semantic tokens only. SCSS Modules + mixins. HSL format. Dark mode via `.dark` class. Data-attributes for state.

---

## Token Architecture

**Two-tier token system (self-contained)**

**Location:** `packages/ui/src/styles/design-tokens.scss`

**Tier 1: Base tokens** - Raw HSL values

```scss
--color-white: 0 0% 100%;
--color-gray-900: 222.2 84% 4.9%;
--color-blue-500: 221.2 83.2% 53.3%;
```

**Tier 2: Semantic tokens** - Reference base tokens

```scss
--color-background: var(--color-white);
--color-foreground: var(--color-gray-900);
--color-primary: var(--color-blue-500);
--color-primary-foreground: var(--color-white);
```

**Pattern:** Components use semantic tokens ONLY, never base tokens

### Token Organization

```scss
:root {
  // ============================================
  // TIER 1: BASE TOKENS (Raw HSL values)
  // ============================================

  // Colors
  --color-white: 0 0% 100%;
  --color-gray-900: 222.2 84% 4.9%;
  --color-blue-500: 221.2 83.2% 53.3%;
  --color-blue-50: 210 40% 98%;
  --color-red-500: 0 84.2% 60.2%;

  // Spacing
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;

  // Typography
  --font-size-12: 0.75rem;
  --font-size-14: 0.875rem;
  --font-weight-500: 500;

  // ============================================
  // TIER 2: SEMANTIC TOKENS (Reference Tier 1)
  // ============================================

  // Base colors (with foreground pairs)
  --color-background: var(--color-white);
  --color-foreground: var(--color-gray-900);

  // Interactive colors (with foreground pairs)
  --color-primary: var(--color-blue-500);
  --color-primary-foreground: var(--color-blue-50);
  --color-destructive: var(--color-red-500);
  --color-destructive-foreground: var(--color-white);

  --color-border: var(--color-gray-200);
  --color-ring: var(--color-blue-500);

  // Spacing
  --space-sm: var(--space-2);
  --space-md: var(--space-4);

  // Typography
  --font-size-sm: var(--font-size-14);
  --font-weight-medium: var(--font-weight-500);

  // Transitions
  --transition-colors: color 150ms ease, background-color 150ms ease;
}

// Dark mode overrides (Tier 2 semantic tokens only)
.dark {
  --color-background: var(--color-gray-900);
  --color-foreground: var(--color-white);
  --color-primary: var(--color-blue-400);
  --color-border: var(--color-gray-700);
}
```

**Pattern:** Components use design tokens ONLY - no Open Props, no external dependencies

**RED FLAGS:**

- ❌ Using external token libraries (creates dependency)
- ❌ Not using semantic tokens (makes theme changes difficult)
- ❌ Redeclaring design tokens as component variables (unnecessary)

---

## Color System

**Self-contained HSL color tokens**

**Location:** `packages/ui/src/styles/design-tokens.scss`

**Categories:**

- **Base colors:** `--color-background`, `--color-foreground`
- **Interactive colors:** `--color-primary`, `--color-destructive`, `--color-accent` (with foreground pairs)
- **Utility colors:** `--color-border`, `--color-ring`, `--color-input`

**Pattern:** Semantic naming (purpose-based, not value-based)

```scss
// ✅ Use semantic tokens directly
.button {
  background: hsl(var(--color-primary));
  color: hsl(var(--color-primary-foreground));
}

// ❌ Don't hardcode colors
.button {
  background: hsl(221.2 83.2% 53.3%);
  color: hsl(210 40% 98%);
}
```

### Color Format Requirements

**HSL format with CSS color functions**

**Rules:**

- **Store HSL values only in tokens:** `--primary: 221.2 83.2% 53.3%` (no `hsl()` wrapper)
- **Wrap with hsl() at usage site:** `background: hsl(var(--primary))`
- **Use CSS color functions for derived colors:**
  - Transparency: `hsl(var(--primary) / 0.5)` or `hsl(var(--primary) / var(--opacity-medium))`
  - Color mixing: `color-mix(in srgb, var(--color-primary), white 10%)`
- **Never use Sass color functions:** No `darken()`, `lighten()`, `transparentize()`, etc.
- **Avoid hard-coding color values directly** in component styles
- **Always use semantic color tokens** (not raw HSL values in components)

**Why HSL format:**

- Human-readable color values (hue, saturation, lightness)
- Easy to create color variations (adjust lightness for hover states)
- Space-separated syntax enables opacity modification via `/` operator
- Natural for design token systems and theming
- More intuitive than RGB for manual adjustments

**Usage Pattern:**

```scss
// ✅ CORRECT: HSL with wrapper at usage site
.button {
  background: hsl(var(--color-primary));
  color: hsl(var(--color-primary-foreground));

  // With opacity
  border: 1px solid hsl(var(--color-primary) / 0.5);

  &:hover {
    background: color-mix(in srgb, var(--color-primary), white 10%);
  }
}

// ❌ WRONG: Hex colors, Sass functions, or hsl() in tokens
:root {
  --color-primary: hsl(221.2 83.2% 53.3%); // ❌ Don't wrap in token
  --color-secondary: #3b82f6; // ❌ Don't use hex
}

.button {
  background: darken($primary-color, 10%); // ❌ Don't use Sass functions
  color: rgba(0, 0, 0, 0.8); // ❌ Don't use rgba
}
```

**RED FLAGS:**

- ❌ Using hex colors (`#FFFFFF`, `#000000`)
- ❌ Using Sass color functions (`darken`, `lighten`, `transparentize`)
- ❌ Hard-coding color values instead of using design tokens
- ❌ Using RGB format (we use HSL for consistency)

---

## Spacing System

**2px base unit with calculated multiples**

**Location:** `packages/ui/src/styles/variables.scss`

**Base unit:** `--core-space-unit: 0.2rem` (2px at default font size)

**Scale:**

- `--core-space-2`: 4px
- `--core-space-4`: 8px
- `--core-space-6`: 12px
- `--core-space-8`: 16px
- `--core-space-10`: 20px
- `--core-space-12`: 24px
- `--core-space-16`: 32px

**Semantic spacing tokens:**

- `--space-sm`: 4px
- `--space-md`: 8px
- `--space-lg`: 12px
- `--space-xlg`: 20px
- `--space-xxlg`: 24px
- `--space-xxxlg`: 32px

```scss
.button {
  padding: var(--space-md); // 8px
}

.container {
  gap: var(--space-lg); // 12px
}
```

---

## Typography

**REM-based with semantic naming**

**Location:** `packages/ui/src/styles/variables.scss`

**Core font sizes:**

- `--core-text-size-1`: 1.6rem (16px)
- `--core-text-size-2`: 1.8rem (18px)
- `--core-text-size-3`: 2rem (20px)

**Semantic typography tokens:**

- `--text-size-icon`: 16px
- `--text-size-body`: 16px
- `--text-size-body2`: 18px
- `--text-size-heading`: 20px

```scss
.button {
  font-size: var(--text-size-body);
}

h1 {
  font-size: var(--text-size-heading);
}
```

---

## Theme Implementation

**Class-based theming with `.dark` class**

### Dark Mode Pattern

**Implementation:** Use `.dark` class on root element to override all color tokens

```scss
// packages/ui/src/styles/variables.scss

// Light mode (default)
:root {
  --color-background: 0 0% 100%;
  --color-foreground: 222.2 84% 4.9%;

  --color-primary: 221.2 83.2% 53.3%;
  --color-primary-foreground: 210 40% 98%;

  --color-card: 0 0% 100%;
  --color-card-foreground: 222.2 84% 4.9%;

  --color-destructive: 0 84.2% 60.2%;
  --color-destructive-foreground: 210 40% 98%;

  --color-border: 214.3 31.8% 91.4%;
  --color-ring: 221.2 83.2% 53.3%;
}

// Dark mode (override)
.dark {
  --color-background: 222.2 84% 4.9%;
  --color-foreground: 210 40% 98%;

  --color-primary: 217.2 91.2% 59.8%;
  --color-primary-foreground: 222.2 47.4% 11.2%;

  --color-card: 222.2 84% 4.9%;
  --color-card-foreground: 210 40% 98%;

  --color-destructive: 0 62.8% 30.6%;
  --color-destructive-foreground: 210 40% 98%;

  --color-border: 217.2 32.6% 17.5%;
  --color-ring: 224.3 76.3% 48%;
}
```

**Theme Toggle:**

```typescript
// Toggle dark mode
const toggleDarkMode = () => {
  document.documentElement.classList.toggle("dark");
};

// Set dark mode
const setDarkMode = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

// Persist preference
const toggleDarkMode = () => {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
};

// Initialize from localStorage
const initTheme = () => {
  const theme = localStorage.getItem("theme");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  }
};
```

**Component Usage (theme-agnostic):**

```scss
// Component never references theme directly
.button {
  background: hsl(var(--color-primary));
  color: hsl(var(--color-primary-foreground));

  // Automatically adapts to light/dark mode
  // No conditional logic needed
}
```

**RED FLAGS:**

- ❌ Theme logic in components
- ❌ Conditional className based on theme
- ❌ JavaScript-based theme switching in components
- ❌ Not defining dark mode overrides for all color tokens

---

## SCSS Mixins Library

**Reusable SCSS mixins for common patterns**

**Location:** `packages/ui/src/styles/mixins.scss`

### Standard Mixins

```scss
// mixins.scss

// Focus ring styling
@mixin focus-ring {
  &:focus-visible {
    outline: 2px solid hsl(var(--color-ring));
    outline-offset: 2px;
  }
}

// Disabled state
@mixin disabled-state {
  &:disabled {
    pointer-events: none;
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Smooth transitions
@mixin transition-colors {
  transition: var(--transition-colors);
}

// Truncate text
@mixin truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Visually hidden (for screen readers)
@mixin sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### When to Create Mixins

**Create mixins for:**

- ✅ Patterns used in 3+ components
- ✅ Complex CSS that's hard to remember
- ✅ Accessibility patterns (focus, sr-only)
- ✅ Browser-specific workarounds

**Don't create mixins for:**

- ❌ Simple one-liners better as design tokens
- ❌ Component-specific styles
- ❌ One-off patterns

**RED FLAGS:**

- ❌ Not using mixins for focus states (inconsistent accessibility)
- ❌ Duplicating complex patterns across components
- ❌ Reinventing mixins that already exist

---

## Global Styles Organization

**File structure for global styles**

**Location:** `packages/ui/src/styles/`

```
packages/ui/src/styles/
├── design-tokens.scss   # All design tokens (colors, spacing, typography)
├── mixins.scss          # Reusable SCSS mixins
├── global.scss          # Global base styles with import order
├── reset.scss           # CSS reset
└── utility-classes.scss # Minimal utility classes
```

### Utility Classes (Minimal)

**Pattern:** Small set of utilities, not comprehensive like Tailwind

```scss
// utility-classes.scss

// Screen reader only
.sr-only {
  @include sr-only;
}

// Focus ring
.focus-ring {
  @include focus-ring;
}

// Truncate text
.truncate {
  @include truncate;
}
```

**Philosophy:**

- Minimal set (not comprehensive)
- Common patterns only
- Extracted from mixins
- Used sparingly in components

**RED FLAGS:**

- ❌ Creating comprehensive utility library (use Tailwind instead)
- ❌ Using utilities instead of component styles
- ❌ Not extracting utilities from mixins

---

## SCSS Modules Pattern

**100% of components use SCSS Modules**

**Pattern:** CSS Modules with SCSS for component styling

**File structure:**

```
components/button/
├── button.tsx              # Component implementation
├── button.module.scss      # SCSS Module styles
└── button.stories.tsx      # Ladle stories
```

```typescript
import styles from "./button.module.scss";

<Comp className={clsx(buttonVariants({ variant, size, className }))} />
```

---

## Component Architecture

**Tiered component hierarchy**

1. **Primitives** (`src/primitives/`) - Low-level building blocks (skeleton)
2. **Components** (`src/components/`) - Reusable UI (button, switch, select)
3. **Patterns** (`src/patterns/`) - Composed patterns (feature, navigation)
4. **Templates** (`src/templates/`) - Page layouts (frame)

**Key practices:**

- Use `cva` ONLY when component has multiple variants
- Ref forwarding with `forwardRef`
- Expose `className` prop
- Use `asChild` pattern for polymorphic components

---

## Component SCSS Module Structure

**Consistent structure across all components**

**Pattern:** Import → Base → Variants → Sizes

```scss
// button.module.scss

// ============================================
// IMPORTS
// ============================================
@import "../../styles/design-tokens.scss";
@import "../../styles/mixins.scss";

// ============================================
// BASE CLASS
// ============================================
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;

  // Use design tokens directly (no redeclaration)
  border-radius: var(--radius);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: var(--transition-colors);

  // Use mixins for common patterns
  @include focus-ring;
  @include disabled-state;
  @include transition-colors;
}

// ============================================
// VARIANT CLASSES
// ============================================
.default {
  background: hsl(var(--color-primary));
  color: hsl(var(--color-primary-foreground));

  &:hover {
    background: hsl(var(--color-primary) / 0.9);
  }
}

.destructive {
  background: hsl(var(--color-destructive));
  color: hsl(var(--color-destructive-foreground));

  &:hover {
    background: hsl(var(--color-destructive) / 0.9);
  }
}

.ghost {
  background: transparent;

  &:hover {
    background: hsl(var(--color-accent));
    color: hsl(var(--color-accent-foreground));
  }
}

// ============================================
// SIZE CLASSES
// ============================================
.sm {
  height: 2.25rem;
  padding: 0.5rem 0.75rem;
  font-size: var(--font-size-xs);
}

.lg {
  height: 2.75rem;
  padding: 0.5rem 2rem;
}

.icon {
  height: 2.5rem;
  width: 2.5rem;
  padding: 0;
}
```

**Key Principles:**

- **Import design tokens and mixins at top**
- **Use design tokens directly** - No redeclaration as component variables
- **Use mixins for common patterns** - focus-ring, disabled-state, etc.
- **Section comments for organization** - Clear visual hierarchy
- **Semantic class names** - Purpose, not appearance (`.submitButton` not `.blueButton`)
- **Data-attributes for state** - `&[data-state="open"]`, `&[data-active="true"]`
- **BEM-like naming within modules** - But scoped by CSS Modules

**Component Variables (Rarely Needed):**

Components should use design tokens directly. Only create component-specific variables for:

```scss
// ✅ RARE CASE: Variant-specific sizing that doesn't exist in design tokens
.avatar {
  // Only when variants need specific sizes not in design tokens
  --avatar-size-sm: 2rem;
  --avatar-size-md: 3rem;
  --avatar-size-lg: 4rem;
  --avatar-size-xl: 5rem;
}

.sizeSm {
  width: var(--avatar-size-sm);
  height: var(--avatar-size-sm);
}
.sizeMd {
  width: var(--avatar-size-md);
  height: var(--avatar-size-md);
}
```

**RED FLAGS:**

- ❌ Redeclaring design tokens as component variables (`--button-radius: var(--radius)`)
- ❌ Creating variables for values used once
- ❌ Not using mixins for common patterns (focus, disabled states)
- ❌ Missing import of design-tokens and mixins
- ❌ No section comments for organization

---

## Advanced CSS Features

**Modern CSS with :has(), :global(), and data-attributes**

**Supported patterns:**

- **`:has()` for conditional styling** - Style parent based on child state
- **`:global()` for handling global classes** - Escape CSS Modules scoping when needed
- **Proper nesting with `&`** - SCSS nesting for modifiers and states
- **CSS classes for variants** - Use `cva` for type-safe variant classes
- **Data-attributes for state** - `&[data-state="open"]`, `&[data-active="true"]`

**Examples:**

```scss
// :has() for parent styling based on children
.container:has(.error) {
  border-color: var(--color-error);
}

// :global() for global class handling
.component {
  :global(.dark-mode) & {
    background: var(--color-surface-strong);
  }
}

// Proper nesting with &
.button {
  &:hover {
    background: var(--color-surface-subtle);
  }

  &[data-active="true"] {
    color: var(--color-accent);
  }
}

// Variants using CSS classes (used with cva)
.btnDefault {
  background: var(--color-surface-base);
}

.btnGhost {
  background: transparent;
}
```

**Best Practices:**

- Use data-attributes for boolean states: `data-active`, `data-state`, `data-variant`
- Prefer `:has()` over JavaScript for simple parent-child relationships
- Use `:global()` sparingly, only when necessary for third-party integration
- Keep nesting shallow (max 3 levels) for maintainability

**RED FLAGS:**

- ❌ Deep nesting (4+ levels) - harder to maintain
- ❌ Overusing `:global()` - defeats CSS Modules purpose
- ❌ Using inline styles in JavaScript instead of CSS classes
- ❌ Mixing state management approaches (pick data-attributes OR classes, not both)

---

## Iconography

**lucide-react icon library**

**Library:** `lucide-react` (installed in `packages/ui`)

**Key Principles:**

- **Consistent sizing** - Icons should use design tokens for sizing
- **Color inheritance** - Icons use `currentColor` to inherit text color from parent
- **Accessibility** - Icon-only buttons require descriptive labels
- **Visual consistency** - Use lucide-react's consistent icon set

**Sizing Pattern:**

```scss
.icon {
  width: var(--text-size-icon); // 16px
  height: var(--text-size-icon);
}
```

**Color Pattern:**

Icons automatically inherit color from their parent element's text color. Use semantic color tokens on parent elements:

```scss
.button {
  color: var(--color-text-default); // Icon inherits this color
}
```

**Accessibility:**

Icon-only buttons must have accessible labels:

```tsx
<Button size="icon" title="Expand details" aria-label="Expand details">
  <ChevronDown />
</Button>
```
