# Styling Examples

All code examples for the Styling & Design System skill.

---

## Pattern 1: Two-Tier Token System

### Implementation

```scss
:root {
  // TIER 1: CORE TOKENS (Raw values - building blocks)

  // Colors - Raw HSL values
  --color-white: 0 0% 100%;
  --color-gray-50: 210 40% 98%;
  --color-gray-100: 214 32% 91%;
  --color-gray-500: 215 16% 47%;
  --color-gray-900: 222 47% 11%;
  --color-red-500: 0 84% 60%;

  // Spacing - Calculated multiples
  --space-unit: 0.2rem; // 2px
  --space-1: calc(var(--space-unit) * 1); // 2px
  --space-2: calc(var(--space-unit) * 2); // 4px
  --space-6: calc(var(--space-unit) * 6); // 12px

  // Typography - Core sizes
  --font-size-0-1: 1.6rem; // 16px
  --font-size-1: 2.56rem; // 25.6px

  // Opacity
  --opacity-subtle: 0.2;
  --opacity-medium: 0.5;

  // TIER 2: SEMANTIC TOKENS (Purpose-driven - use these in components)

  // Background colors
  --color-background-base: var(--color-white);
  --color-background-surface: var(--color-gray-50);
  --color-background-muted: var(--color-gray-100);

  // Text colors
  --color-text-default: var(--color-gray-500);
  --color-text-inverted: var(--color-white);
  --color-text-subtle: var(--color-gray-400);

  // Border colors
  --color-border-default: var(--color-gray-200);
  --color-border-strong: var(--color-gray-300);

  // Interactive colors (with foreground pairs)
  --color-primary: var(--color-gray-900);
  --color-primary-foreground: var(--color-white);
  --color-primary-hover: color-mix(in srgb, var(--color-primary), black 5%);

  --color-destructive: var(--color-red-500);
  --color-destructive-foreground: var(--color-white);
  --color-destructive-hover: color-mix(in srgb, var(--color-destructive), black 5%);

  // Input colors
  --color-input: var(--color-gray-200);
  --color-ring: var(--color-accent);

  // Spacing - Semantic names
  --space-sm: var(--space-2); // 4px
  --space-md: var(--space-4); // 8px

  // Typography - Semantic names
  --font-size-body: var(--font-size-0-1);
  --font-size-icon: var(--font-size-0-1);

  // Transitions
  --transition-default: all var(--duration-normal) ease;
}

// Dark mode overrides (Tier 2 semantic tokens only)
.dark {
  --color-background-base: var(--color-gray-600);
  --color-text-default: var(--color-gray-200);
  --color-primary: var(--color-gray-50);
  --color-primary-foreground: var(--color-gray-950);
}
```

### Usage in Components

```scss
// ✅ Good Example
// packages/ui/src/components/button/button.module.scss

.btn {
  // Use semantic tokens
  font-size: var(--text-size-body);
  padding: var(--space-md);
  border-radius: var(--radius-sm);
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

**Why good:** Semantic tokens make purpose clear (what the token is for), theme changes only update token values (not component code), components remain theme-agnostic

```scss
// ❌ Bad Example

.btn {
  // BAD: Using core tokens directly
  padding: var(--core-space-4);
  color: var(--gray-7);

  // BAD: Hardcoded values
  font-size: 16px;
  border-radius: 4px;
}

// BAD: Default export
export default Button;
```

**Why bad:** Core tokens bypass semantic layer = theme changes require component edits, hardcoded values break design system consistency, default exports violate project conventions and prevent tree-shaking

---

## Pattern 2: HSL Color Format with CSS Color Functions

### Constants

```typescript
const COLOR_OPACITY_SUBTLE = 0.5;
const COLOR_MIX_HOVER_PERCENTAGE = 5;
```

### Implementation

```scss
// ✅ Good Example - Semantic tokens with CSS color functions

.button {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);

  // Transparency using relative color syntax
  border: 1px solid rgb(from var(--color-primary) r g b / 0.5);

  &:hover {
    background-color: color-mix(in srgb, var(--color-primary), black 5%);
  }
}

// Semantic color categories
.heading {
  color: var(--color-text-default); // Primary text
}

.description {
  color: var(--color-text-muted); // Secondary text
}

.label {
  color: var(--color-text-subtle); // Tertiary text
}

.card {
  background: var(--color-surface-base); // Default background
}

.card-hover {
  background: var(--color-surface-subtle); // Subtle variation
}

.button-primary {
  background: var(--color-primary); // Primary brand color
}
```

**Why good:** HSL format eliminates Sass dependencies, CSS color functions work natively in browsers, semantic naming clarifies purpose (not just value), theme changes update token values without touching components

```scss
// ❌ Bad Example

:root {
  // BAD: Hex colors
  --color-primary: #0f172a;

  // BAD: HSL with wrapper
  --color-secondary: hsl(222.2 84% 4.9%);
}

.button {
  // BAD: Sass color functions
  background: darken($primary-color, 10%);

  // BAD: Hardcoded rgba
  color: rgba(0, 0, 0, 0.8);

  // BAD: Hex colors
  border: 1px solid #ffffff;
}
```

**Why bad:** Hex colors harder to manipulate with CSS functions, Sass functions require build-time processing and create dependencies, hardcoded values break design system consistency, can't theme dynamically at runtime

---

## Pattern 3: CSS Cascade Layers for Predictable Precedence

### Layer Declaration

```scss
// packages/ui/src/styles/layers.scss
@layer reset, components;
```

### Reset Layer

```scss
// packages/ui/src/styles/reset.scss
@layer reset {
  * {
    margin: unset;
    padding: unset;
    border: unset;
    background: unset;
  }

  html {
    box-sizing: border-box;
    font-size: 62.5%;
  }

  button {
    all: unset;
  }
}
```

### Component Layer

```scss
// ✅ Good Example - UI package component

// packages/ui/src/components/button/button.module.scss
@layer components {
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }

  .destructive {
    background-color: var(--color-destructive);
    color: var(--color-destructive-foreground);
  }
}
```

**Why good:** Wrapping in `@layer components {}` ensures app styles can override without specificity wars, loading order becomes irrelevant, predictable precedence across monorepo

### App Override Pattern

```scss
// ✅ Good Example - App-specific override

// apps/web/src/styles/custom.scss
// NO @layer wrapper - unlayered = highest priority
.my-custom-button {
  // This overrides component layer styles automatically
  background-color: var(--color-accent);
  padding: var(--space-12);
}
```

**Why good:** Unlayered app styles automatically override layered component styles, no specificity hacks needed, works regardless of CSS loading order

```scss
// ❌ Bad Example

// BAD: Component styles not layered
.button {
  background: var(--color-primary); // Loading order determines precedence
}

// BAD: App styles wrapped in layer
@layer components {
  .my-custom-button {
    // Stuck at component priority, can't override easily
    background-color: var(--color-accent);
  }
}
```

**Why bad:** Unlayered component styles create loading order dependency, app styles in layers can't override component styles without specificity wars, defeats the purpose of cascade layers

---

## Pattern 4: Dark Mode with `.dark` Class and Mixin

### Implementation

```scss
// ✅ Good Example

// packages/ui/src/styles/design-tokens.scss
:root {
  // Light mode (default) - Semantic tokens
  --color-background-base: var(--color-white);
  --color-background-muted: var(--color-gray-100);
  --color-text-default: var(--color-gray-500);
  --color-text-inverted: var(--color-white);
  --color-primary: var(--color-gray-900);
  --color-primary-foreground: var(--color-white);
}

// Dark mode overrides (mixin from mixins.scss)
.dark {
  @include dark-theme;
}
```

```scss
// packages/ui/src/styles/mixins.scss
@mixin dark-theme {
  // Override semantic tokens for dark mode
  --color-background-base: var(--color-gray-600);
  --color-background-muted: var(--color-gray-800);
  --color-text-default: var(--color-gray-200);
  --color-text-inverted: var(--color-gray-950);
  --color-primary: var(--color-gray-50);
  --color-primary-foreground: var(--color-gray-950);
  --color-primary-hover: color-mix(in srgb, var(--color-primary), white 5%);
}
```

### Constants

```typescript
const THEME_STORAGE_KEY = "theme";
const THEME_CLASS_NAME = "dark";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
```

### Theme Toggle

```typescript
// Toggle dark mode
const toggleDarkMode = () => {
  document.documentElement.classList.toggle(THEME_CLASS_NAME);
};

// Set dark mode
const setDarkMode = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add(THEME_CLASS_NAME);
  } else {
    document.documentElement.classList.remove(THEME_CLASS_NAME);
  }
};

// Persist preference
const toggleDarkModeWithPersistence = () => {
  const isDark = document.documentElement.classList.toggle(THEME_CLASS_NAME);
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? THEME_DARK : THEME_LIGHT);
};

// Initialize from localStorage
const initTheme = () => {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  if (theme === THEME_DARK) {
    document.documentElement.classList.add(THEME_CLASS_NAME);
  }
};
```

### Component Usage (Theme-Agnostic)

```scss
@layer components {
  .button {
    // Use semantic tokens - automatically adapts to light/dark mode
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);

    &:hover {
      background-color: var(--color-primary-hover);
    }

    // No conditional logic needed
    // No theme checks required
    // Just use semantic tokens and they adapt automatically
  }
}
```

**Why good:** Components remain theme-agnostic (no theme logic), theme switching is instant (just CSS variable changes), semantic tokens provide indirection between theme and components, mixin keeps dark mode overrides organized

```scss
// ❌ Bad Example

.button {
  // BAD: Theme logic in component
  background: var(--color-primary);

  .dark & {
    background: var(--color-dark-primary); // Don't do this
  }
}
```

```typescript
// BAD: Conditional className based on theme
const Button = () => {
  const isDark = useTheme();
  return <button className={isDark ? styles.dark : styles.light} />;
};
```

**Why bad:** Theme logic in components couples them to theme implementation, conditional classNames add complexity and re-render overhead, defeats purpose of semantic tokens, harder to add new themes

---

## Pattern 5: SCSS Module Structure with Cascade Layers

### Structure Pattern

```scss
// ✅ Good Example
// button.module.scss

@layer components {
  // BASE CLASS
  .button {
    // Component-specific variables (if needed)
    --button-accent-bg: transparent;
    --button-focus-ring-width: 3px;
    --button-border-width: 1px;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;

    // Use design tokens directly
    border-radius: var(--space-3);
    font-size: var(--font-size-body);
    font-weight: 500;
    color: var(--color-text-default);

    &:disabled {
      pointer-events: none;
      opacity: 0.5;
    }

    &:focus-visible {
      border-color: var(--color-ring);
    }

    &[aria-invalid="true"] {
      border-color: var(--color-destructive);
    }
  }

  // VARIANT CLASSES
  .default {
    background-color: var(--color-background-dark);
    color: var(--color-text-light);

    &:hover {
      background-color: var(--color-primary-hover);
    }
  }

  .destructive {
    background-color: var(--color-destructive);
    color: var(--color-destructive-foreground);

    &:hover {
      background-color: var(--color-destructive-hover);
    }
  }

  .ghost {
    background-color: transparent;

    &:hover {
      background-color: var(--color-background-muted);
      color: var(--color-text-default);
    }
  }

  .outline {
    border: var(--button-border-width-hover) solid transparent;
    box-shadow: 0 0 0 var(--button-border-width) var(--color-border-default);
    background-color: var(--color-background-base);

    &[data-state="open"],
    &:hover {
      background-color: var(--button-accent-bg);
      box-shadow: none;
      border: var(--button-border-width-hover) solid var(--color-border-darkish);
      font-weight: bold;
    }
  }

  // SIZE CLASSES
  .sizeDefault {
    height: var(--space-18);
    padding: var(--space-6) var(--space-6);
  }

  .sizeSm {
    height: var(--space-14);
    padding: var(--space-1) var(--space-6);
  }

  .sizeLg {
    height: var(--space-20);
    padding: var(--space-6) var(--space-10);
  }

  .sizeIcon {
    width: var(--space-18);
    height: var(--space-18);
  }
}
```

**Why good:** Layer wrapper ensures predictable precedence, semantic tokens enable theming, data-attributes handle state cleanly, component variables only when needed for variant logic, consistent structure across all components

```scss
// ❌ Bad Example

// BAD: No layer wrapper
.button {
  display: inline-flex;
}

// BAD: Redeclaring design tokens unnecessarily
.card {
  --card-border-width: 1px; // Used only once
  --card-border-radius: 0.5rem; // Already have --radius-sm!

  border: var(--card-border-width) solid var(--color-surface-subtle);
  border-radius: var(--card-border-radius);
}

// BAD: Non-semantic class names
.blueButton {
  background: var(--color-primary); // What if primary isn't blue?
}

.bigText {
  font-size: var(--text-size-heading); // Purpose unclear
}
```

**Why bad:** Missing layer wrapper creates loading order dependency, redeclaring tokens wastes variables, non-semantic names become inaccurate when design changes (blueButton stops making sense if color changes to green)

---

## Pattern 6: Spacing System with Semantic Tokens

### Base Unit and Scale

**Location:** `packages/ui/src/styles/variables.scss`

**Base unit:** `--core-space-unit: 0.2rem` (2px at default font size)

**Core scale:**

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

### Implementation

```scss
// ✅ Good Example - Consistent spacing

.button {
  padding: var(--space-md); // 8px
}

.container {
  gap: var(--space-lg); // 12px
}

.compact-list {
  gap: var(--space-sm); // 4px
}

.section {
  margin-bottom: var(--space-xlg); // 20px
}

.card {
  padding: var(--space-lg); // 12px all sides
  margin-bottom: var(--space-xxlg); // 24px bottom
}
```

**Why good:** Consistent spacing scale creates visual rhythm, semantic names clarify usage intent, design token changes update all components automatically

```scss
// ❌ Bad Example

.button {
  // BAD: Hardcoded values
  padding: 8px;
  margin: 12px;

  // BAD: Using core tokens directly
  gap: var(--core-space-4);
}
```

**Why bad:** Hardcoded values break design system consistency and can't be themed, using core tokens bypasses semantic layer and makes purpose unclear

---

## Pattern 7: Typography System with REM-Based Sizing

### Core and Semantic Sizes

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

### Implementation

```scss
// ✅ Good Example

.button {
  font-size: var(--text-size-body); // 16px
}

h1,
h2,
h3 {
  font-size: var(--text-size-heading); // 20px
}

.text {
  font-size: var(--text-size-body); // 16px
}

.intro {
  font-size: var(--text-size-body2); // 18px
}

.icon {
  font-size: var(--text-size-icon); // 16px
  width: var(--text-size-icon);
  height: var(--text-size-icon);
}
```

**Why good:** REM-based sizing respects user browser preferences for accessibility, semantic names clarify usage (body vs heading vs icon), consistent scale across UI

```scss
// ❌ Bad Example

.button {
  // BAD: Hardcoded px values
  font-size: 16px;
}

.heading {
  // BAD: Using core tokens directly
  font-size: var(--core-text-size-3);
}
```

**Why bad:** Hardcoded px values ignore user preferences and break accessibility, using core tokens bypasses semantic layer and obscures purpose

---

## Pattern 8: Data-Attributes for State Styling

### Implementation

```scss
// ✅ Good Example

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

.button {
  &[data-active="true"] {
    color: var(--color-accent);
  }

  &[aria-invalid="true"] {
    border-color: var(--color-destructive);
  }
}

.form:has(.inputError) {
  border-color: var(--color-error);
}

.formGroup:has(input:focus) {
  background: var(--color-surface-subtle);
}
```

**Why good:** Data-attributes separate state from styling concerns, easier to debug in DevTools, works with :has() for parent-child relationships, no className concatenation in JSX

```scss
// ❌ Bad Example

.dropdownOpen {
  display: block;
}

.dropdownClosed {
  display: none;
}
```

```typescript
// BAD: Conditional className in JSX
<Dropdown className={isOpen ? styles.dropdownOpen : styles.dropdownClosed} />
```

**Why bad:** Requires separate classes for every state variation, className concatenation adds complexity, harder to combine multiple states, more JavaScript logic for what should be CSS

---

## Pattern 9: SCSS Mixins for Reusable Patterns

### Standard Mixins

**Location:** `packages/ui/src/styles/mixins.scss`

```scss
// ✅ Good Example

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

### Usage

```scss
.button {
  @include focus-ring;
  @include disabled-state;
  @include transition-colors;
}

.long-text {
  @include truncate;
}
```

**Why good:** Mixins ensure consistency for accessibility patterns (focus, sr-only), reduce duplication across components, easier to maintain and update centrally

---

## Pattern 10: Global Styles Organization

### File Structure

**Location:** `packages/ui/src/styles/`

```
packages/ui/src/styles/
├── design-tokens.scss   # All design tokens (colors, spacing, typography)
├── mixins.scss          # Reusable SCSS mixins
├── global.scss          # Global base styles with import order
├── reset.scss           # CSS reset
├── layers.scss          # Layer declarations
└── utility-classes.scss # Minimal utility classes
```

### Import Order

```scss
// packages/ui/src/styles/global.scss
@use "layers"; // Declare layers FIRST
@use "reset"; // Uses @layer reset
@use "design-tokens"; // Unlayered (highest priority)
@use "utility-classes"; // Unlayered (highest priority)
```

### Minimal Utility Classes

```scss
// ✅ Good Example - utility-classes.scss

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

**Why good:** Minimal set (not comprehensive like Tailwind), extracted from mixins for consistency, used sparingly in components

---

## Pattern 11: Icon Styling

### Key Principles

- **Consistent sizing:** Icons use design tokens
- **Color inheritance:** Icons use `currentColor` to inherit parent text color

### Implementation

```scss
// ✅ Good Example

.icon {
  width: var(--text-size-icon); // 16px
  height: var(--text-size-icon);
}

// Icons automatically inherit currentColor
.successButton {
  color: var(--color-text-default); // Icon inherits this

  &:hover {
    color: var(--color-accent); // Icon color changes on hover
  }
}

.errorButton {
  color: var(--color-text-muted); // Different icon color
}

.button {
  color: var(--color-text-default); // Icon inherits this color
}
```

**Why good:** Using `currentColor` keeps icon colors in sync with text without duplication, design tokens ensure consistent sizing, fewer CSS rules needed

```scss
// ❌ Bad Example

.icon {
  // BAD: Hardcoded size
  width: 16px;
  height: 16px;

  // BAD: Explicit color instead of inheritance
  color: var(--color-text-default);
}

.button .icon {
  // BAD: Duplicating parent color
  color: var(--color-primary);
}
```

**Why bad:** Hardcoded sizes break consistency, explicit icon colors create duplication and get out of sync with parent text color

---

## Pattern 12: cva (Class Variance Authority) Integration

### Implementation

cva provides type-safe variant management for components with multiple variants. It works seamlessly with SCSS Modules.

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import styles from "./alert.module.scss";

const ANIMATION_DURATION_MS = 200;

const alertVariants = cva("alert", {
  variants: {
    variant: {
      info: clsx(styles.alert, styles.alertInfo),
      warning: clsx(styles.alert, styles.alertWarning),
      error: clsx(styles.alert, styles.alertError),
      success: clsx(styles.alert, styles.alertSuccess),
    },
    size: {
      sm: clsx(styles.alert, styles.alertSm),
      md: clsx(styles.alert, styles.alertMd),
      lg: clsx(styles.alert, styles.alertLg),
    },
  },
  defaultVariants: {
    variant: "info",
    size: "md",
  },
});

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants>;

export const Alert = ({ variant, size, className, ...props }: AlertProps) => {
  return (
    <div
      className={clsx(alertVariants({ variant, size, className }))}
      style={{ transition: `all ${ANIMATION_DURATION_MS}ms ease` }}
      {...props}
    />
  );
};
```

**Why good:** cva provides type-safe variant props with autocomplete, defaultVariants prevent undefined behavior, named constant for animation duration prevents magic numbers, VariantProps extracts correct TypeScript types from cva definition

### Button Example with Full States

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

**Why good:** design tokens ensure consistency across components, data-attributes for state styling separate state from presentation, scoped styles prevent global namespace pollution, disabled and hover states properly handled

### Bad Example - Hardcoded Values

```scss
.button {
  padding: 12px 24px; // Magic numbers
  background: #3b82f6; // Hardcoded color
  border-radius: 8px; // Magic number
}

.button.active {
  background: #2563eb; // className toggling for state
}
```

**Why bad:** hardcoded values prevent theme switching and break design system consistency, magic numbers are unmaintainable and inconsistent across components, className toggling for state is harder to manage than data-attributes

---

## Pattern 13: Advanced CSS Features

### Supported Patterns

- **`:has()` for conditional styling:** Style parent based on child state
- **`:global()` for handling global classes:** Escape CSS Modules scoping when needed
- **Proper nesting with `&`:** SCSS nesting for modifiers and states
- **CSS classes for variants:** Use `cva` for type-safe variant classes
- **Data-attributes for state:** `&[data-state="open"]`, `&[data-active="true"]`

### Implementation

```scss
// ✅ Good Example

// :has() for parent styling based on children
.form:has(.inputError) {
  border-color: var(--color-error);
}

.formGroup:has(input:focus) {
  background: var(--color-surface-subtle);
}

// :global() for global class handling (minimal use)
.component {
  padding: var(--space-md);

  :global(.dark-mode) & {
    background: var(--color-surface-strong);
  }
}

// Proper nesting with & (max 3 levels)
.nav {
  .navItem {
    &:hover {
      background: var(--color-surface-subtle);
    }
  }
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

// Variants using CSS classes (used with cva)
.btnDefault {
  background: var(--color-surface-base);
}

.btnGhost {
  background: transparent;
}
```

**Why good:** `:has()` eliminates JavaScript for parent-child styling, `:global()` enables third-party integration when needed, shallow nesting maintains readability, data-attributes separate state from style concerns

```scss
// ❌ Bad Example

// BAD: Deep nesting (4+ levels)
.nav .navList .navItem .navLink .navIcon {
  color: var(--color-primary);
}

// BAD: Overusing :global()
.component {
  :global {
    .everything {
      .is {
        .global {
          // Defeats CSS Modules purpose
        }
      }
    }
  }
}

// BAD: Inline styles in JavaScript instead of CSS classes
<div style={{ color: isActive ? 'blue' : 'gray' }} />
```

**Why bad:** Deep nesting harder to maintain and increases specificity, overusing `:global()` defeats CSS Modules scoping purpose, inline styles in JavaScript bypass design system and theming

### Best Practices

- Use data-attributes for boolean states: `data-active`, `data-state`, `data-variant`
- Prefer `:has()` over JavaScript for simple parent-child relationships
- Use `:global()` sparingly, only when necessary for third-party integration
- Keep nesting shallow (max 3 levels) for maintainability
