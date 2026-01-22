# SCSS Modules Core Examples

> Complete code examples for SCSS Modules core patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**For additional patterns**: See topic-specific files in this folder:

- [tokens.md](tokens.md) - Spacing and typography systems
- [theming.md](theming.md) - Dark mode implementation
- [cva.md](cva.md) - cva integration with SCSS Modules
- [patterns.md](patterns.md) - SCSS Module structure, data-attributes, mixins, global styles, icons
- [advanced.md](advanced.md) - Advanced CSS features (:has(), :global(), nesting)

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
  --color-primary-hover: color-mix(
    in srgb,
    hsl(var(--color-primary)),
    black 5%
  );

  --color-destructive: var(--color-red-500);
  --color-destructive-foreground: var(--color-white);
  --color-destructive-hover: color-mix(
    in srgb,
    hsl(var(--color-destructive)),
    black 5%
  );

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
// Good Example
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
// Bad Example

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
// Good Example - Semantic tokens with CSS color functions

.button {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);

  // Transparency using HSL with alpha (matches token storage format)
  border: 1px solid hsl(var(--color-primary) / 0.5);

  &:hover {
    background-color: color-mix(in srgb, hsl(var(--color-primary)), black 5%);
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
// Bad Example

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
// Good Example - UI package component

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
// Good Example - App-specific override

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
// Bad Example

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
