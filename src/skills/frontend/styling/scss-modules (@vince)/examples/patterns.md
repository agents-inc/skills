# SCSS Modules Architectural Patterns

> SCSS Module structure, data-attributes, mixins, global styles, and icon patterns. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

---

## Pattern 5: SCSS Module Structure with Cascade Layers

### Structure Pattern

```scss
// Good Example
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
// Bad Example

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

## Pattern 8: Data-Attributes for State Styling

### Implementation

```scss
// Good Example

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
// Bad Example

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
// Good Example

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
  design-tokens.scss   # All design tokens (colors, spacing, typography)
  mixins.scss          # Reusable SCSS mixins
  global.scss          # Global base styles with import order
  reset.scss           # CSS reset
  layers.scss          # Layer declarations
  utility-classes.scss # Minimal utility classes
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
// Good Example - utility-classes.scss

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
// Good Example

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
// Bad Example

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
