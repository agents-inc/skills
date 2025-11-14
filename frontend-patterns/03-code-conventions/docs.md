# 03. Code Conventions

> **Quick Guide:** Building components? See §3.1. TypeScript setup? See §3.6. Need constants? See §3.5 (no magic numbers!). Error handling? See §3.7.

## 3.1 Component Architecture

- Functional components (no class components)
- Composition patterns (children, render props, slots)
- Props interface conventions
- Component file structure
- **Ref forwarding** - all interactive components must forward refs
- **className prop exposure** - allow style customization from parent
- **Design system component patterns**:
  - Components expose `className` for overrides
  - Components use `forwardRef` for ref access
  - Props are well-typed with JSDoc descriptions
  - Components are composable (not monolithic)

> See [examples.md](./examples.md#31-component-architecture) for code examples

**RED FLAGS:**

- ❌ Components don't expose className for customization
- ❌ Missing ref forwarding on interactive elements
- ❌ Props spreading without type safety
- ❌ God components (>300 lines, >10 props)
- ❌ Inline styles instead of using design tokens

## 3.2 File and Directory Naming

- Component naming (PascalCase: `Button.tsx`)
- Utility file naming (kebab-case: `format-date.ts`)
- Test file naming (`*.test.ts` or `*.spec.ts` - be consistent)
- Directory organization (feature-based or type-based)
- Consistent casing across entire codebase

## 3.3 Import/Export Patterns

- **Named exports preferred** (better for tree-shaking)
- Import ordering: React → external → internal → types
- Re-exports and barrel files (index.ts usage)
- Avoiding circular dependencies
- Type-only imports: `import type { User } from './types'`

## 3.4 Type Definitions

- Interface for objects that can be extended
- Type for unions, intersections, mapped types
- Generic type conventions
- Utility type patterns (Pick, Omit, Partial, Required)
- Type inference over explicit typing (when safe)
- Shared type organization

## 3.5 Constants and Magic Numbers

**RULE: No magic numbers anywhere in code.**

- All numbers must be named constants
- Constant naming: `SCREAMING_SNAKE_CASE`
- Where to define:
  - File-level constants at top of file
  - Shared constants in `constants.ts` file
  - Design tokens for UI values
- Configuration objects over scattered constants

> See [examples.md](./examples.md#35-constants-and-magic-numbers) for code examples

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

## 3.6 TypeScript Strictness

**MANDATORY: Strict mode enabled in tsconfig.json**

> See [examples.md](./examples.md#36-typescript-strictness) for required tsconfig.json settings

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

## 3.7 Error Handling Patterns

- Try/catch conventions (where/when to use)
- Error boundary usage (React components)
- Error type definitions (custom error classes)
- Logging standards (what to log, how to log)
- User-facing error messages (friendly, actionable)
- Error recovery strategies
- Network error handling
- Async error handling patterns

> See [examples.md](./examples.md#37-error-handling-patterns) for code examples

## 3.8 Form Patterns and Validation

- Controlled vs uncontrolled components
- Form library usage (React Hook Form, Formik, or none)
- Validation patterns (yup, zod, custom)
- Error message display
- Submit handling
- Loading/disabled states
- Field-level vs form-level validation
- Async validation patterns

## 3.9 Performance Optimization

- When to use `React.memo`
- When to use `useMemo`
- When to use `useCallback`
- Lazy loading components
- Code splitting strategies
- Bundle size awareness
- Re-render optimization
- Virtual scrolling for long lists

**RED FLAGS:**

- ❌ Premature optimization (memo everywhere)
- ❌ Missing optimization on expensive renders
- ❌ Inline function definitions in JSX props (causes re-renders)
- ❌ Large bundle sizes without analysis
