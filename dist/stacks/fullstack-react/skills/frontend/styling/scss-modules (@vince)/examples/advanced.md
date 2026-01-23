# SCSS Modules Advanced CSS Examples

> Advanced CSS features for SCSS Modules including :has(), :global(), and nesting patterns. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

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
// Good Example

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
// Bad Example

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
