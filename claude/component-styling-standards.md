## Brief overview

Guidelines for creating and refactoring UI component styles to ensure consistency with the design system. These rules apply to SCSS module files and component styling.

## Component structure standards

- Use design tokens directly from design-tokens.scss in component styles
- Create component-specific variables only when they add value (see criteria below)
- Define any component-specific variables at the top using `--component-[property]` format
- Structure components with logical nesting and clear separation of parts
- Use semantic class names that describe purpose, not appearance

### When to create component CSS variables

**✅ CREATE variables for:**

- Values used multiple times within the component
- Values that change based on variants/states (sizes, themes)
- Complex calculated values that would be repeated
- Values that might need runtime modification via JavaScript
- Component-specific sizing systems (e.g., avatar sizes: sm, md, lg, xl)

**❌ DON'T CREATE variables for:**

- Simple, single-use values like `1px`, `2px` for borders
- Standard font-weights like `600`, `500` used once
- Values that already exist as design tokens (avoid redeclaration)
- One-off calculations that aren't reused

## Design token integration

- Always use design tokens from design-tokens.scss directly for visual properties
- Avoid redeclaring existing design tokens as component variables to reduce maintenance overhead
- Consider semantic meaning of tokens (e.g., `--color-background-base` instead of `--color-white`)
- Only create component variables for values not available in the design token system
- Ensure dark mode compatibility is handled through design tokens, not manual overrides

## Color management requirements

- Use RGB format for all colors: `rgb(255, 255, 255)` instead of hex `#FFFFFF` or `rgba()`
- Use CSS color functions for derived colors:
  - `rgb(0 0 0 / var(--opacity-medium))` for transparency
  - `color-mix(in srgb, var(--color-primary), black 5%)` for variations
- Never use Sass color functions (darken, lighten, etc.)
- Avoid hard-coding color values directly in component styles

## Spacing and units

- Use REM-based spacing tokens: `var(--space-4)` instead of `8px`
- Use semantic spacing tokens appropriately:
  - Contained spacing (padding): `var(--space-X)`
  - External spacing (margin): `var(--space-X)`
  - Element sizing: `var(--space-X)`
- For borders and fine details, px units are acceptable: `1px solid var(--component-border-color)`

## Typography standards

- Use font size tokens: `var(--font-size-body)` instead of hard-coded values
- Define component-specific font weight variables
- Reference typography tokens from the design system

## Advanced CSS features

- Use `:has()` for conditional styling when appropriate
- Use `:global()` for handling global classes
- Use proper nesting with `&` for modifiers and states
- Create variants using CSS classes rather than duplicating styles
- Use data-attributes for state-based styling: `&[data-state="open"]`

## Implementation checklist

When creating component styles, ensure:

- Design tokens used directly from design-tokens.scss wherever possible
- Component-specific variables created only when they add value (reuse, variants, calculations)
- Any component variables defined at top of file with `--component-[property]` format
- All colors use RGB format (including transparency with space-separated syntax)
- Pixel units replaced with REM-based spacing tokens where appropriate
- CSS color functions used instead of Sass color functions
- Simple values (1px borders, standard font-weights) used directly without variables
- Proper nesting structure implemented
- Responsive behavior handled appropriately
- Dark mode compatibility ensured through design tokens
- Avoid unnecessary redeclaration of existing design tokens
- Keep it simple - don't over-engineer with unnecessary abstractions

## File naming and organization

- Use `.module.scss` extension for component styles
- Place component styles adjacent to component files
- Use hyphens in filenames: `component-name.module.scss`
- Organize styles with clear hierarchy and logical grouping
