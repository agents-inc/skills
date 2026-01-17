# SCSS Modules Theming Examples

> Dark mode and theming patterns for SCSS Modules. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

---

## Pattern 4: Dark Mode with `.dark` Class and Mixin

### Implementation

```scss
// Good Example

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
// Bad Example

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
