# Styling & Design System

> **Quick Guide:** Two-tier token system (Core primitives → Semantic tokens). Foreground/background color pairs. Components use semantic tokens only. SCSS Modules + CSS Cascade Layers. HSL format. Dark mode via `.dark` class with mixin. Data-attributes for state. Self-contained (no external dependencies).

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST wrap ALL UI package component styles in `@layer components {}` for proper cascade precedence)**

**(You MUST use semantic tokens ONLY in components - NEVER use core tokens directly)**

**(You MUST use HSL format for colors with CSS color functions - NO Sass color functions like darken/lighten)**

**(You MUST use data-attributes for state styling - NOT className toggling)**

**(You MUST use `#### SubsectionName` markdown headers within patterns - NOT separator comments)**

</critical_requirements>

---

**Auto-detection:** UI components, styling patterns, design tokens, SCSS modules, CSS Cascade Layers, dark mode theming

**When to use:**

- Implementing design tokens and theming
- Building component styles with SCSS Modules
- Ensuring visual consistency across applications
- Working with colors, spacing, typography
- Implementing dark mode with class-based theming
- Setting up CSS Cascade Layers for predictable style precedence

**Key patterns covered:**

- Two-tier token system (Core → Semantic)
- SCSS Module patterns with CSS Cascade Layers
- Color system (HSL format, semantic naming, foreground/background pairs)
- Spacing and typography systems
- Dark mode implementation (`.dark` class with mixin pattern)
- Component structure and organization

---

<philosophy>

## Philosophy

The design system follows a **self-contained, two-tier token architecture** where core primitives (raw HSL values, base sizes) map to semantic tokens (purpose-driven names). Components consume only semantic tokens, enabling theme changes without component modifications.

**Core Principles:**

- **Self-contained:** No external dependencies (no Open Props, no Tailwind for tokens)
- **Two-tier system:** Core tokens provide raw values, semantic tokens provide meaning
- **HSL-first:** Use modern CSS color functions, not Sass color manipulation
- **Layer-based:** CSS Cascade Layers ensure predictable style precedence across monorepo
- **Theme-agnostic components:** Components use semantic tokens and adapt automatically to light/dark mode

**When to use this design system:**

- Building UI components in the `packages/ui` workspace
- Implementing consistent spacing, colors, and typography across apps
- Creating theme-aware components (light/dark mode)
- Styling with SCSS Modules and CSS Cascade Layers
- Needing predictable CSS precedence in a monorepo

**When NOT to use:**

- One-off prototypes without design system needs (use inline styles or basic CSS)
- External component libraries with their own theming (Material-UI, Chakra)
- Projects requiring comprehensive utility classes (use Tailwind CSS instead)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Two-Tier Token System

The design system uses a two-tier token architecture: **Tier 1 (Core tokens)** provides raw values, **Tier 2 (Semantic tokens)** references core tokens with purpose-driven names.

#### Token Architecture

**Location:** `packages/ui/src/styles/design-tokens.scss`

**Tier 1: Core tokens** - Raw HSL values, base sizes, primitives

```scss
--color-white: 0 0% 100%;
--color-gray-900: 222 47% 11%;
--color-red-500: 0 84% 60%;
--space-unit: 0.2rem;
```

**Tier 2: Semantic tokens** - Reference core tokens with purpose-driven names

```scss
--color-background-base: var(--color-white);
--color-text-default: var(--color-gray-500);
--color-primary: var(--color-gray-900);
--color-primary-foreground: var(--color-white);
--color-destructive: var(--color-red-500);
```

#### Implementation

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

#### Usage in Components

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

**When to use:** Always use semantic tokens in components for any design-related values (colors, spacing, typography).

**When not to use:** Never use core tokens directly in components - they're building blocks for semantic tokens only.

---

### Pattern 2: HSL Color Format with CSS Color Functions

Store HSL values without the `hsl()` wrapper in tokens, apply `hsl()` wrapper when using tokens, and use modern CSS color functions for transparency and color mixing.

#### Color Format Rules

**Rules:**

- Store HSL values without `hsl()` wrapper: `--color-gray-900: 222 47% 11%;`
- Use `hsl()` wrapper when applying: `background-color: hsl(var(--color-primary))`
- Use CSS color functions for derived colors:
  - Transparency: `hsl(var(--color-primary) / 0.5)` or `hsl(from var(--color-primary) h s l / 0.5)`
  - Color mixing: `color-mix(in srgb, hsl(var(--color-primary)), white 10%)`
- **NEVER use Sass color functions:** No `darken()`, `lighten()`, `transparentize()`
- Always use semantic color tokens (not raw HSL in components)

#### Constants

```typescript
const COLOR_OPACITY_SUBTLE = 0.5;
const COLOR_MIX_HOVER_PERCENTAGE = 5;
```

#### Implementation

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

### Pattern 3: CSS Cascade Layers for Predictable Precedence

Use CSS Cascade Layers to control style precedence across the monorepo, ensuring UI package components have lower priority than app-specific overrides.

#### Layer Hierarchy (lowest → highest priority)

1. `@layer reset` - Browser resets and normalizations
2. `@layer components` - Design system component styles (UI package)
3. Unlayered styles - App-specific overrides (highest priority)

#### Layer Declaration

```scss
// packages/ui/src/styles/layers.scss
@layer reset, components;
```

#### Reset Layer

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

#### Component Layer

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

#### App Override Pattern

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

**When to use:** Always wrap UI package component styles in `@layer components {}`, never wrap app-specific styles in layers.

---

### Pattern 4: Dark Mode with `.dark` Class and Mixin

Implement dark mode by adding `.dark` class to root element, which overrides semantic tokens. Use mixin pattern for organization.

#### Implementation

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

#### Constants

```typescript
const THEME_STORAGE_KEY = "theme";
const THEME_CLASS_NAME = "dark";
const THEME_LIGHT = "light";
const THEME_DARK = "dark";
```

#### Theme Toggle

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

#### Component Usage (Theme-Agnostic)

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

**When to use:** Always for dark mode implementation - keep components theme-agnostic by using semantic tokens only.

---

### Pattern 5: SCSS Module Structure with Cascade Layers

Structure component SCSS modules consistently: Layer Wrapper → Base → Variants → Sizes. All UI package components must wrap in `@layer components {}`.

#### Structure Pattern

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

**When to use:** Every SCSS module in the `packages/ui` workspace must use this structure with layer wrapper.

---

### Pattern 6: Spacing System with Semantic Tokens

Use a 2px base unit with calculated multiples for core spacing, mapped to semantic tokens with purpose-driven names.

#### Base Unit and Scale

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

#### Implementation

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

### Pattern 7: Typography System with REM-Based Sizing

Use REM-based typography with semantic naming to respect user preferences and clarify usage.

#### Core and Semantic Sizes

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

#### Implementation

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

### Pattern 8: Data-Attributes for State Styling

Use data-attributes instead of className toggling for state-based styling. Cleaner than conditional classes, works naturally with CSS.

#### Implementation

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

**When to use:** Always prefer data-attributes for boolean states and enum-like states (open/closed, active/inactive, error/success).

---

### Pattern 9: SCSS Mixins for Reusable Patterns

Create mixins for patterns used in 3+ components, complex CSS that's hard to remember, accessibility patterns, and browser-specific workarounds.

#### Standard Mixins

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

#### Usage

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

**When to use:** Create mixins for patterns used in 3+ components, complex CSS that's hard to remember, accessibility patterns, browser-specific workarounds.

**When not to use:** Don't create mixins for simple one-liners better as design tokens, component-specific styles, or one-off patterns.

---

### Pattern 10: Global Styles Organization

Organize global styles in a consistent file structure with proper import order.

#### File Structure

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

#### Import Order

```scss
// packages/ui/src/styles/global.scss
@use "layers"; // Declare layers FIRST
@use "reset"; // Uses @layer reset
@use "design-tokens"; // Unlayered (highest priority)
@use "utility-classes"; // Unlayered (highest priority)
```

#### Minimal Utility Classes

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

**Philosophy:**

- Minimal set (not comprehensive)
- Common patterns only
- Extracted from mixins
- Used sparingly in components

**When not to use:** Don't create comprehensive utility library (use Tailwind instead), don't use utilities instead of component styles, don't create utilities without corresponding mixins.

---

### Pattern 11: Icon Styling with lucide-react

Style icons consistently using design tokens for sizing and `currentColor` for color inheritance.

#### Library

`lucide-react` (installed in `packages/ui`)

#### Key Principles

- **Consistent sizing:** Icons use design tokens
- **Color inheritance:** Icons use `currentColor` to inherit parent text color

#### Implementation

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

### Pattern 12: Advanced CSS Features

Use modern CSS features like `:has()`, `:global()`, proper nesting, and data-attributes for cleaner, more powerful styling.

#### Supported Patterns

- **`:has()` for conditional styling:** Style parent based on child state
- **`:global()` for handling global classes:** Escape CSS Modules scoping when needed
- **Proper nesting with `&`:** SCSS nesting for modifiers and states
- **CSS classes for variants:** Use `cva` for type-safe variant classes
- **Data-attributes for state:** `&[data-state="open"]`, `&[data-active="true"]`

#### Implementation

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

**Best Practices:**

- Use data-attributes for boolean states: `data-active`, `data-state`, `data-variant`
- Prefer `:has()` over JavaScript for simple parent-child relationships
- Use `:global()` sparingly, only when necessary for third-party integration
- Keep nesting shallow (max 3 levels) for maintainability

</patterns>

---

<decision_framework>

## Decision Framework

```
Need to style a component?
├─ Is it in packages/ui (design system)?
│   ├─ YES → Wrap in @layer components {}
│   │        Use semantic tokens only
│   │        Use SCSS Modules
│   │        Use data-attributes for state
│   └─ NO → Is it in apps/* (application)?
│       └─ YES → Don't wrap in layers (unlayered)
│                Use semantic tokens
│                Can override UI package styles
│
Need to reference a design value?
├─ Color / Spacing / Typography?
│   └─ Use semantic token (--color-primary, --space-md, --text-size-body)
│       NEVER use core tokens directly
│
Need to show different states?
├─ Boolean state (open/closed, active/inactive)?
│   └─ Use data-attribute: &[data-open="true"]
├─ Enum state (primary/secondary/ghost)?
│   └─ Use CSS classes with cva for type-safety
│
Need to manipulate colors?
├─ Transparency?
│   └─ rgb(from var(--color-primary) r g b / 0.5)
├─ Color mixing?
│   └─ color-mix(in srgb, var(--color-primary), black 5%)
├─ NEVER use Sass color functions (darken, lighten)
│
Need dark mode support?
├─ In component styles?
│   └─ Use semantic tokens (they adapt automatically)
│       NO theme checks in component logic
├─ In design-tokens.scss?
│   └─ Override semantic tokens in .dark { @include dark-theme; }
│
Need to reuse a pattern?
├─ Used in 3+ components?
│   └─ Create SCSS mixin in mixins.scss
├─ Used in 1-2 components?
│   └─ Keep it in component (don't abstract early)
│
Need spacing between elements?
├─ Small (4px)?  → --space-sm
├─ Medium (8px)? → --space-md
├─ Large (12px)? → --space-lg
├─ Extra large?  → --space-xlg, --space-xxlg, --space-xxxlg
│
Need to size text?
├─ Body text? → --text-size-body
├─ Larger body? → --text-size-body2
├─ Heading? → --text-size-heading
├─ Icon? → --text-size-icon
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ **Using core tokens directly in components** - Components must use semantic tokens only (e.g., `--color-primary` not `--color-gray-900`), breaks theming
- ❌ **Component styles not wrapped in `@layer components {}`** - UI package components must use layers for predictable precedence across monorepo
- ❌ **Using Sass color functions** - No `darken()`, `lighten()`, `transparentize()` - use CSS color functions (`color-mix()`, relative color syntax)
- ❌ **Hardcoded color/spacing values** - Must use design tokens, breaks consistency and theming
- ❌ **Theme logic in components** - Components should use semantic tokens and remain theme-agnostic

**Medium Priority Issues:**

- ⚠️ **Creating comprehensive utility class library** - Keep utilities minimal, use Tailwind if you need comprehensive utilities
- ⚠️ **Not using mixins for focus states** - Inconsistent accessibility, use `@include focus-ring`
- ⚠️ **Redeclaring design tokens as component variables** - Usually unnecessary, use semantic tokens directly
- ⚠️ **App overrides wrapped in layers** - App styles should be unlayered for highest precedence
- ⚠️ **Using hex colors instead of HSL** - Use HSL format for better CSS color function compatibility

**Common Mistakes:**

- Not importing `layers.scss` before layered content - Layer declarations must come first
- Creating variables for values used only once - Use design tokens directly instead
- Missing import of design-tokens or mixins in component SCSS - Components need access to tokens
- Deep nesting (4+ levels) - Keep nesting shallow (max 3 levels) for maintainability
- Conditional className for theme instead of semantic tokens - Let tokens handle theming
- Using utilities instead of component styles - SCSS Modules are primary, utilities are supplementary

**Gotchas & Edge Cases:**

- **CSS Cascade Layers loading order:** Unlayered styles always override layered styles, regardless of loading order. This is intentional for app overrides.
- **Color format in tokens:** Store HSL without `hsl()` wrapper (`--color: 222 47% 11%`), apply wrapper when using (`hsl(var(--color))`)
- **Mixin vs utility class:** Mixins are for use in SCSS, utility classes are for use in HTML/JSX. Extract utilities from mixins for consistency.
- **Component variables timing:** Only create component-specific CSS variables when you need variant logic or runtime modification. Most components should use design tokens directly.
- **Dark mode token overrides:** Only override Tier 2 semantic tokens in `.dark` class, never override Tier 1 core tokens
- **Data-attribute syntax:** Use string values (`data-state="open"`) not boolean attributes, works better with CSS selectors
- **:has() browser support:** Modern CSS feature, ensure you have fallbacks for older browsers if needed
- **Layer precedence:** Within a layer, normal specificity rules apply. Layers only affect inter-layer precedence.

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap ALL UI package component styles in `@layer components {}` for proper cascade precedence)**

**(You MUST use semantic tokens ONLY in components - NEVER use core tokens directly)**

**(You MUST use HSL format for colors with CSS color functions - NO Sass color functions like darken/lighten)**

**(You MUST use data-attributes for state styling - NOT className toggling)**

**(You MUST use `#### SubsectionName` markdown headers within patterns - NOT separator comments)**

**Failure to follow these rules will break theming, create cascade precedence issues, and violate design system conventions.**

</critical_reminders>
