# Styling Reference

Decision frameworks, anti-patterns, and red flags for the Styling & Design System skill.

---

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

---

## Anti-Patterns

### Using Core Tokens Directly in Components

Never use Tier 1 core tokens (`--color-gray-900`, `--core-space-4`) in component styles. Components must use Tier 2 semantic tokens (`--color-primary`, `--space-md`) to maintain theme flexibility.

```scss
// ❌ WRONG - Using core token
.button {
  background: var(--color-gray-900);
}

// ✅ CORRECT - Using semantic token
.button {
  background: var(--color-surface-base);
}
```

### Component Styles Without Layer Wrapper

All UI package component styles must be wrapped in `@layer components {}`. Missing the layer wrapper causes loading order dependencies and makes app-level overrides unpredictable.

```scss
// ❌ WRONG - No layer wrapper
.button {
  padding: var(--space-md);
}

// ✅ CORRECT - Wrapped in layer
@layer components {
  .button {
    padding: var(--space-md);
  }
}
```

### Sass Color Functions

Avoid `darken()`, `lighten()`, `transparentize()` and other Sass color functions. These require build-time processing and prevent runtime theming. Use CSS color functions instead.

```scss
// ❌ WRONG - Sass function
.hover {
  background: darken($primary, 10%);
}

// ✅ CORRECT - CSS color function
.hover {
  background: color-mix(in srgb, var(--color-primary), black 10%);
}
```

### Theme Logic in Components

Don't add conditional theme checks in component code. Components should use semantic tokens only and remain theme-agnostic. The `.dark` class and token overrides handle theming automatically.

### Hardcoded Values

Never use hardcoded pixel values, hex colors, or raw numbers. All design values must come from design tokens to ensure consistency and enable theming.

```scss
// ❌ WRONG - Hardcoded values
.card {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

// ✅ CORRECT - Design tokens
.card {
  padding: var(--space-lg);
  background: var(--color-surface-subtle);
  border-radius: var(--radius-md);
}
```

---

## RED FLAGS

**High Priority Issues:**

- **Using core tokens directly in components** - Components must use semantic tokens only (e.g., `--color-primary` not `--color-gray-900`), breaks theming
- **Component styles not wrapped in `@layer components {}`** - UI package components must use layers for predictable precedence across monorepo
- **Using Sass color functions** - No `darken()`, `lighten()`, `transparentize()` - use CSS color functions (`color-mix()`, relative color syntax)
- **Hardcoded color/spacing values** - Must use design tokens, breaks consistency and theming
- **Theme logic in components** - Components should use semantic tokens and remain theme-agnostic

**Medium Priority Issues:**

- Creating comprehensive utility class library - Keep utilities minimal, use Tailwind if you need comprehensive utilities
- Not using mixins for focus states - Inconsistent accessibility, use `@include focus-ring`
- Redeclaring design tokens as component variables - Usually unnecessary, use semantic tokens directly
- App overrides wrapped in layers - App styles should be unlayered for highest precedence
- Using hex colors instead of HSL - Use HSL format for better CSS color function compatibility

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
