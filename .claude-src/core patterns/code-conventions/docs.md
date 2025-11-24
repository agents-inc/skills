# Code Conventions

> **Quick Guide:** Building components? See Component Architecture. TypeScript setup? See TypeScript Strictness. Need constants? See Constants and Magic Numbers (no magic numbers!). Icons? See Icon Library (lucide-react). Error handling? See Error Handling Patterns.

---

## Component Architecture

- Functional components with TypeScript (no class components)
- **Variant system**: Use `class-variance-authority` (cva) **ONLY when component has multiple variants** (e.g., button with sizes/styles)
- **Props pattern**: Extend native HTML element props with `React.ComponentProps<"element">`
- **Polymorphic components**: Use `asChild` prop pattern for flexibility (design system components)
- **Ref forwarding**: All interactive components must use `React.forwardRef`
- **className prop exposure**: Allow style customization from parent
- **Always use type for props**: Use `type` for all component props (enables intersections, unions, and VariantProps integration)
- **Design system component patterns**:
  - Components expose `className` for overrides
  - Components use `forwardRef` for ref access
  - Props are well-typed with variant safety via `VariantProps` (when using cva)
  - Components use `clsx` for className merging
  - Variants defined with `cva` **only when multiple variants exist**
  - Components are composable (not monolithic)

**When to use cva:**

- ✅ Component has multiple variant options (size, variant, color, etc.)
- ✅ Building design system primitives/components
- ✅ Need type-safe variant combinations

**When NOT to use cva:**

- ❌ Simple component with no variants (just use className directly)
- ❌ Single styling option
- ❌ Feature/pattern components that don't need variants

**RED FLAGS:**

- ❌ Components don't expose className for customization
- ❌ Missing ref forwarding on interactive elements
- ❌ Props spreading without type safety
- ❌ God components (>300 lines, >10 props)
- ❌ Inline styles instead of using design tokens
- ❌ Using cva for components with no variants (over-engineering)
- ❌ Using `interface` instead of `type` for component props
- ❌ Missing display names on forwardRef components

---

## File and Directory Naming

**MANDATORY: kebab-case for ALL files and directories**

- Component files: kebab-case (`button.tsx`, NOT `Button.tsx`)
- Style files: kebab-case with `.module.scss` extension (`button.module.scss`)
- Story files: kebab-case (`button.stories.tsx`)
- Test files: kebab-case (`button.test.tsx` or `features.test.tsx`)
- Utility files: kebab-case (`format-date.ts`)
- Directories: kebab-case (`client-next/`, `api-mocks/`, `eslint-config/`)
- **Component directory structure**:
  ```
  components/button/
  ├── button.tsx              # Component implementation
  ├── button.module.scss      # SCSS Module styles
  └── button.stories.tsx      # Ladle stories
  ```

**Enforcement - Add ESLint plugin:**

```bash
bun add -D eslint-plugin-check-file
```

**Configure in ESLint config:**

```javascript
// eslint.config.js (flat config) or .eslintrc.js
{
  plugins: ['check-file'],
  rules: {
    'check-file/filename-naming-convention': [
      'error',
      {
        '**/*.{ts,tsx,js,jsx}': 'KEBAB_CASE',
      },
      {
        ignoreMiddleExtensions: true, // Allows button.module.scss
      },
    ],
    'check-file/folder-naming-convention': [
      'error',
      {
        'src/**/': 'KEBAB_CASE',
        'apps/**/': 'KEBAB_CASE',
        'packages/**/': 'KEBAB_CASE',
      },
    ],
  },
}
```

**Add to CI/pre-commit:**

```bash
# Runs automatically with your existing lint command
bun run lint
```

**RED FLAGS:**

- ❌ Mixed casing (Button.tsx and button.module.scss)
- ❌ PascalCase for files
- ❌ Using `.module.css` instead of `.module.scss`
- ❌ Missing story files for components
- ❌ No automated file naming enforcement

---

## Import/Export Patterns

**MANDATORY: Named exports ONLY (no default exports in libraries)**

- **Named exports for everything**: Components, types, utilities, constants
- **Package exports**: Define explicit exports in `package.json` for packages
- **Import ordering**:
  1. React imports
  2. External dependencies
  3. Internal workspace packages (`@repo/*`)
  4. Relative imports (components, utils)
  5. Styles (`.module.scss` files)
- **Type-only imports**: Use `import type { }` for type-only imports
- **Avoid barrel files** in components (use package.json exports instead)
- **Avoiding circular dependencies**

**Example package.json exports pattern:**

```json
{
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx",
    "./hooks": "./src/hooks/index.ts"
  }
}
```

**RED FLAGS:**

- ❌ Default exports in library components
- ❌ Importing from internal paths instead of package exports
- ❌ Missing package.json exports for shared components
- ❌ Barrel file with all exports (bad for tree-shaking)

---

## Type Definitions

**RULE: Always use `type` for component props**

- **Always use `type` for component props**: Enables intersections, unions, and VariantProps integration
- **Type for unions, intersections, mapped types**
- **Co-located type definitions**: Types live with their components
- **Exported types**: Export both component and its props type
- **Generic type conventions**
- **Utility type patterns**: `Pick`, `Omit`, `Partial`, `Required`, `VariantProps`
- **Type inference over explicit typing** (when safe)
- **No `I` prefix for interfaces** (avoid IProduct, use Product)

### Standard Components

**Pattern:**

```typescript
export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => {
    return <button ref={ref} {...props} />
  }
)
Button.displayName = "Button"
```

### Radix UI Components

**Pattern:** Extract types from Radix primitives using utility types

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog"

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={clsx(styles.overlay, className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName
```

**Type Extraction Utilities:**
- `React.ElementRef<T>` - Extracts the ref type (e.g., `HTMLDivElement`)
- `React.ComponentPropsWithoutRef<T>` - Extracts all props except ref
- Ensures type safety without duplicating Radix type definitions
- Automatically stays in sync with library updates

**Why this pattern:**
- No manual type duplication
- Stays in sync with Radix primitive updates
- Type-safe prop spreading
- Proven in production components

**Rationale:** `type` allows intersection with VariantProps from cva and complex type operations. Co-location makes types easier to find and maintain.

**RED FLAGS:**

- ❌ Using `interface` for component props
- ❌ Using `I` prefix for interfaces (IProduct)
- ❌ Types far from their usage
- ❌ Not exporting prop types alongside components
- ❌ Manually duplicating Radix primitive types

---

## Constants and Magic Numbers

**RULE: No magic numbers anywhere in code.**

- All numbers must be named constants
- Constant naming: `SCREAMING_SNAKE_CASE`
- Where to define:
  - File-level constants at top of file
  - Shared constants in `constants.ts` file
  - Design tokens for UI values
- Configuration objects over scattered constants

**Common areas with magic numbers:**

- Timeouts and intervals
- Z-index values
- Padding/margin values (use design tokens)
- Array/string length limits
- Pagination limits
- Animation durations
- Breakpoint values
- API retry attempts

**RED FLAGS:**

- ❌ Numeric literals scattered in code
- ❌ Hardcoded timeouts
- ❌ Hardcoded spacing values
- ❌ Z-index values without scale definition

---

## TypeScript Strictness

**MANDATORY: Strict mode enabled in tsconfig.json**

**Enforcement:**

- Zero `any` usage without explicit `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and comment explaining WHY
- No `@ts-ignore` without explaining comment
- No `@ts-expect-error` without explaining comment
- All function parameters and return types explicit (no inference for public APIs)
- Null/undefined handling explicit

**RED FLAGS:**

- ❌ `any` usage without justification
- ❌ `@ts-ignore` or `@ts-expect-error` without comments
- ❌ Optional properties without null checks
- ❌ Unused imports/variables not cleaned up
- ❌ Implicit return types on exported functions

---

## Error Handling Patterns

- Try/catch conventions (where/when to use)
- Error boundary usage (React components)
- Error type definitions (custom error classes)
- Logging standards (what to log, how to log)
- User-facing error messages (friendly, actionable)
- Error recovery strategies
- Network error handling
- Async error handling patterns

---

## Form Patterns and Validation

- Controlled vs uncontrolled components
- Form library usage (React Hook Form, Formik, or none)
- Validation patterns (yup, zod, custom)
- Error message display
- Submit handling
- Loading/disabled states
- Field-level vs form-level validation
- Async validation patterns

---

## Performance Optimization

- When to use `React.memo`
- When to use `useMemo`
- When to use `useCallback`
- Lazy loading components
- Code splitting strategies
- Bundle size awareness
- Re-render optimization
- Virtual scrolling for long lists

---

## Event Handlers

- Descriptive handler names
- Typing events explicitly
- Using `useCallback` for handlers passed to memoized children

**RED FLAGS:**

- ❌ Premature optimization (memo everywhere)
- ❌ Missing optimization on expensive renders
- ❌ Inline function definitions in JSX props (causes re-renders)
- ❌ Large bundle sizes without analysis

---

## Component State Styling

**PATTERN: Use data-attributes for state-based styling (not className toggling)**

- Use `data-*` attributes to represent component state
- Style based on data-attributes in CSS/SCSS
- Makes state visible in DevTools
- Cleaner than conditional className strings
- Better separation of concerns

**Example:**

```typescript
<div data-expanded={isExpanded} data-variant="primary">
  {/* content */}
</div>
```

```scss
.component {
  // Default styles

  &[data-expanded="true"] {
    // Expanded state styles
  }

  &[data-variant="primary"] {
    // Primary variant styles
  }
}
```

**RED FLAGS:**

- ❌ Using className toggling for state (e.g., `className={isExpanded ? 'expanded' : ''}`)
- ❌ Inline style objects for state changes
- ❌ Complex conditional className logic

---

## Component Documentation (Ladle Stories)

**MANDATORY: Design system components must have a `.stories.tsx` file**

- Use Ladle for **design system component documentation** (primitives, components, shared patterns)
- **Not required** for app-specific features or one-off components
- Show all variants and states
- Demonstrate common use cases
- Helps designers and developers understand components
- Serves as visual regression testing base

**Where stories are REQUIRED:**

```
packages/ui/src/
├── primitives/     # ✅ Stories required
├── components/     # ✅ Stories required
├── patterns/       # ✅ Stories required
└── templates/      # ✅ Stories required
```

**Where stories are OPTIONAL:**

```
apps/client-next/
apps/client-react/
  # ❌ App-specific features don't need stories
```

**Story file pattern (design system):**

```
components/button/
├── button.tsx
├── button.module.scss
└── button.stories.tsx    # Required for design system!
```

**RED FLAGS:**

- ❌ Design system components without story files
- ❌ Incomplete variant coverage in stories
- ❌ No usage examples in stories
- ❌ Creating stories for app-specific features (unnecessary)

---

## Component Display Names

**MANDATORY: Set displayName on all forwardRef components**

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} {...props} />
  }
)
Button.displayName = "Button"

// For Radix wrappers, use primitive's displayName
const DialogOverlay = React.forwardRef<...>(...)
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName
```

**Benefits:**
- Better React DevTools experience
- Shows `<Button>` instead of `<ForwardRef>`
- Maintains Radix component names in tree
- Easier debugging and inspection

**RED FLAGS:**

- ❌ forwardRef components without displayName
- ❌ Generic displayName like "Component" or "Wrapper"
- ❌ Not using primitive's displayName for Radix wrappers

---

## Icon Library

**MANDATORY: Use lucide-react for all icons**

**Library:** `lucide-react` (installed in `packages/ui/package.json`)

**Import Pattern:**

```typescript
import { IconName } from "lucide-react";
```

**Usage Pattern:**

- Import icons as named imports from `lucide-react`
- Use icons as JSX components: `<IconName />`
- Icons are tree-shakeable (only imported icons are bundled)
- Icons automatically use `currentColor` for fill/stroke

**Component Integration:**

- Icons can receive `className` prop for styling
- Use design tokens for consistent sizing
- Always provide accessibility labels for icon-only buttons

**When to use lucide-react:**

- ✅ Standard UI icons (arrows, checkmarks, navigation, etc.)
- ✅ Consistent icon set across the application
- ✅ Icons that need to match design system

**When to use custom SVGs:**

- ❌ Brand logos or custom graphics
- ❌ Complex illustrations
- ❌ Icons not available in lucide-react

**RED FLAGS:**

- ❌ Using multiple icon libraries
- ❌ Importing entire lucide-react package
- ❌ Icon-only buttons without aria-label
- ❌ Hardcoded icon sizes instead of design tokens
