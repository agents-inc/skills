# Standards Extraction Categories & Subcategories - CUSTOMIZED

## What Changed

**Removed:**

- ❌ Architecture Decisions (ADRs)
- ❌ AI Agent Optimization
- ❌ Git Workflow

**Added/Enhanced:**

- ✅ **API Client Architecture** (hey-api, OpenAPI, type generation)
- ✅ **Strict TypeScript enforcement** (in Code Conventions 3.6)
- ✅ **Library-specific pitfalls** (Zustand shallow, React Query gotchas)
- ✅ **Design system component APIs** (className, ref forwarding in 3.1)
- ✅ **Magic number elimination** (in Code Conventions 3.5)
- ✅ **Error handling patterns** (in Code Conventions 3.7)
- ✅ **Form patterns** (in Code Conventions 3.8)
- ✅ **Performance optimization** (in Code Conventions 3.9)

---

## 1. Package Architecture

### 1.1 Workspace Structure

- Workspace organization (packages/, apps/, tools/)
- Directory naming conventions
- Monorepo tool identification (Turborepo/Nx/Lerna)

### 1.2 Package Naming Conventions

- Internal package prefixes (@repo/, @app/, etc.)
- Naming patterns (kebab-case, PascalCase)
- Scoping strategies

### 1.3 Dependency Boundaries

- Package dependency rules
- ESLint enforcement (@nx/enforce-module-boundaries)
- Circular dependency prevention
- Type tags (type:ui, type:util, type:data-access, type:feature)

### 1.4 Import Conventions

- Package names vs path aliases
- Import path standards
- Barrel exports (index.ts usage)

### 1.5 Versioning Strategy

- Changesets, Lerna, or manual versioning
- Version bumping workflow
- Changelog generation

---

## 2. API Client Architecture ✨ NEW

### 2.1 OpenAPI/Swagger Integration

- Schema-first development approach
- **Using hey-api (@hey-api/client-fetch)** or openapi-typescript
- Type generation from OpenAPI specs
- Keeping schemas in sync with backend
- Automated client regeneration in CI

### 2.2 Client Configuration

- Base URL configuration (environment-specific)
- Authentication handling (tokens, refresh logic)
- Request/response interceptors
- Timeout configuration
- Retry logic for failed requests
- Rate limiting handling

### 2.3 Type Safety

- **Generated types from OpenAPI** (never manual)
- Type guards for runtime validation (zod, yup)
- Discriminated unions for response types
- Error type definitions
- Type inference from API client methods

### 2.4 Error Handling

- Consistent error response structure
- Error mapping (API errors → UI-friendly messages)
- Network error handling
- Timeout handling
- Retry strategies (exponential backoff)
- Global error handlers

### 2.5 Integration with React Query

- Query function patterns using API client
- Mutation patterns
- Error handling in queries/mutations
- Type inference from API client
- Query key factories matching API structure

**RED FLAGS:**

- ❌ Manual API type definitions (should be generated from OpenAPI)
- ❌ Inconsistent error handling across endpoints
- ❌ No request/response interceptors
- ❌ Hardcoded API URLs
- ❌ Missing retry logic for network failures
- ❌ API client methods not typed properly

---

## 3. Code Conventions

### 3.1 Component Architecture ✨ ENHANCED

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

**Good Design System Component Example:**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(styles[variant], styles[size], className)}
        {...props}
      />
    );
  }
);
```

**RED FLAGS:**

- ❌ Components don't expose className for customization
- ❌ Missing ref forwarding on interactive elements
- ❌ Props spreading without type safety
- ❌ God components (>300 lines, >10 props)
- ❌ Inline styles instead of using design tokens

### 3.2 File and Directory Naming

- Component naming (PascalCase: `Button.tsx`)
- Utility file naming (kebab-case: `format-date.ts`)
- Test file naming (`*.test.ts` or `*.spec.ts` - be consistent)
- Directory organization (feature-based or type-based)
- Consistent casing across entire codebase

### 3.3 Import/Export Patterns

- **Named exports preferred** (better for tree-shaking)
- Import ordering: React → external → internal → types
- Re-exports and barrel files (index.ts usage)
- Avoiding circular dependencies
- Type-only imports: `import type { User } from './types'`

### 3.4 Type Definitions

- Interface for objects that can be extended
- Type for unions, intersections, mapped types
- Generic type conventions
- Utility type patterns (Pick, Omit, Partial, Required)
- Type inference over explicit typing (when safe)
- Shared type organization

### 3.5 Constants and Magic Numbers ✨ NEW

**RULE: No magic numbers anywhere in code.**

- All numbers must be named constants
- Constant naming: `SCREAMING_SNAKE_CASE`
- Where to define:
  - File-level constants at top of file
  - Shared constants in `constants.ts` file
  - Design tokens for UI values
- Configuration objects over scattered constants

**Examples:**

```typescript
// ❌ BAD - Magic numbers
setTimeout(callback, 3000);
<div style={{ padding: '16px', zIndex: 999 }} />
if (items.length > 50) { /* ... */ }

// ✅ GOOD - Named constants
const TOAST_DURATION_MS = 3000;
const SPACING_MD = '16px';
const Z_INDEX_MODAL = 1000;
const MAX_ITEMS_PER_PAGE = 50;

setTimeout(callback, TOAST_DURATION_MS);
<div style={{ padding: SPACING_MD, zIndex: Z_INDEX_MODAL }} />
if (items.length > MAX_ITEMS_PER_PAGE) { /* ... */ }

// ✅ BEST - Design system tokens
<div style={{
  padding: 'var(--space-4)',
  zIndex: 'var(--z-modal)'
}} />
```

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

### 3.6 TypeScript Strictness ✨ NEW

**MANDATORY: Strict mode enabled in tsconfig.json**

**Required settings:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

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

### 3.7 Error Handling Patterns ✨ NEW

- Try/catch conventions (where/when to use)
- Error boundary usage (React components)
- Error type definitions (custom error classes)
- Logging standards (what to log, how to log)
- User-facing error messages (friendly, actionable)
- Error recovery strategies
- Network error handling
- Async error handling patterns

**Pattern example:**

```typescript
// Custom error types
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Consistent error handling
try {
  const data = await apiClient.getUser(userId);
  return data;
} catch (error) {
  if (error instanceof APIError) {
    // Handle API errors
    logger.error("API Error", { endpoint: error.endpoint, status: error.statusCode });
    toast.error(getFriendlyErrorMessage(error));
  } else {
    // Handle unknown errors
    logger.error("Unexpected error", error);
    toast.error("Something went wrong. Please try again.");
  }
  throw error;
}
```

### 3.8 Form Patterns and Validation ✨ NEW

- Controlled vs uncontrolled components
- Form library usage (React Hook Form, Formik, or none)
- Validation patterns (yup, zod, custom)
- Error message display
- Submit handling
- Loading/disabled states
- Field-level vs form-level validation
- Async validation patterns

### 3.9 Performance Optimization ✨ NEW

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

---

## 4. State Management

### 4.1 Server State vs Client State ✨ CRITICAL

**STRICT SEPARATION REQUIRED:**

**Server State = React Query (or similar)**

- Data from APIs
- Database records
- Remote data of any kind
- User profiles, posts, comments, etc.

**Client State = Zustand/Context (or similar)**

- UI state (modals, dropdowns, selected items)
- Form input values (before submission)
- Filter selections
- Theme preferences
- Local-only data

**CRITICAL RED FLAG:**

- ❌ **NEVER store server data in Zustand/Context**
- ❌ **NEVER store UI state in React Query**
- ❌ Duplicating server data in client state
- ❌ Syncing server data manually to client state

**Example violations:**

```typescript
// ❌ BAD - Server data in Zustand
const useUserStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// ✅ GOOD - Server data in React Query
const useUser = (id) => {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchUser(id),
  });
};

// ❌ BAD - UI state in React Query
const useModalState = () => {
  return useQuery({
    queryKey: ["modal"],
    queryFn: () => ({ isOpen: false }),
  });
};

// ✅ GOOD - UI state in Zustand
const useModalStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

### 4.2 React Query Patterns

**Query Key Factories** (hierarchical structure):

```typescript
export const postsQueryKeys = {
  all: ["posts"] as const,
  lists: () => [...postsQueryKeys.all, "list"] as const,
  list: (filters: Filters) => [...postsQueryKeys.lists(), { filters }] as const,
  details: () => [...postsQueryKeys.all, "detail"] as const,
  detail: (id: number) => [...postsQueryKeys.details(), id] as const,
};
```

**Patterns to extract:**

- Query key structure (generic → specific)
- Custom hooks wrapping useQuery/useMutation
- Error handling strategies
- Retry configuration
- Cache time and stale time defaults
- Optimistic updates
- Loading and error state management
- Query client configuration
- Prefetching strategies
- Infinite queries

**RED FLAGS:**

- ❌ Inconsistent query key structure
- ❌ String-only query keys (should be arrays)
- ❌ Missing error handling
- ❌ No loading states
- ❌ Stale data not being refetched

### 4.3 Zustand Patterns ✨ ENHANCED

**Critical Pattern: shallow comparison for multiple selections**

```typescript
// ❌ BAD - Without shallow (causes unnecessary re-renders)
const { user, settings, theme } = useStore();

// ✅ GOOD - With shallow
import { shallow } from "zustand/shallow";
const { user, settings, theme } = useStore(
  (state) => ({
    user: state.user,
    settings: state.settings,
    theme: state.theme,
  }),
  shallow,
);

// ✅ ALTERNATIVE - Select only what you need
const user = useStore((state) => state.user);
const theme = useStore((state) => state.theme);
```

**Other patterns:**

- Store structure (slices vs monolithic)
- Action naming conventions
- Middleware usage (persist, devtools)
- Derived state (selectors)
- Store testing patterns

**RED FLAGS:**

- ❌ **Not using `shallow` when selecting multiple pieces of state**
- ❌ Stores that are too large (>200 lines)
- ❌ Actions that mutate state directly
- ❌ Server data in Zustand stores

### 4.4 Context API Usage

- When to use Context vs Zustand
- Context + useReducer patterns
- Performance considerations
- Provider composition

### 4.5 Cache Invalidation

- Invalidation strategies after mutations
- Prefix matching patterns
- Optimistic updates
- Refetch on window focus
- Background refetch strategies

---

## 5. Testing Standards

### 5.1 Test Organization

- Test file location (co-located vs separate tests/)
- Naming conventions (_.test.ts vs _.spec.ts)
- Directory structure

### 5.2 Unit Testing

- Testing framework (Vitest/Jest)
- What requires unit tests:
  - Business logic functions
  - Custom hooks
  - Utility functions
  - Complex component behavior
- What doesn't need tests:
  - Type definitions
  - Simple presentational components
  - Third-party library wrappers
- Test structure patterns (Arrange-Act-Assert)
- Mock strategies

### 5.3 Integration Testing

- **API mocking with MSW (Mock Service Worker)** ✨
- MSW handler patterns
- Database testing approaches
- Component integration tests
- Testing API interactions

**MSW Pattern Example:**

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "John Doe",
      email: "john@example.com",
    });
  }),
];

// src/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

**RED FLAGS:**

- ❌ Mocking at the module level instead of network level
- ❌ Inconsistent mock data across tests
- ❌ Mocks that don't match actual API responses
- ❌ No MSW setup for consistent API mocking

### 5.4 E2E Testing

- Framework (Playwright/Cypress)
- Test organization
- What to test end-to-end (critical user flows only)
- Test data management
- CI integration
- Parallel test execution

### 5.5 Coverage Requirements

- Minimum thresholds:
  - Branches: 80%
  - Functions: 80%
  - Lines: 80%
  - Statements: 80%
- Per-package requirements
- Quality gates in CI

### 5.6 Mock Data Patterns ✨ ENHANCED

- **MSW for API mocking** (preferred)
- Mock data location (`_mocks/`, `fixtures/`)
- Factory functions vs static mocks
- Realistic vs minimal mocks
- Mock data reuse across tests
- **Keeping mocks in sync with OpenAPI spec**
- Test data builders

---

## 6. Design System

### 6.1 Token Architecture

- **Three-tier system:**
  - Base tokens (primitives: `--base-color-blue-500`)
  - Semantic tokens (purpose: `--color-primary`, `--color-success`)
  - Component tokens (specific: `--button-primary-bg`)
- Token naming conventions
- Token organization (separate files or monolithic)

### 6.2 Color System

- Color token structure
- Scale (50, 100, 200...900)
- Semantic color naming
- Component-specific colors
- Accessibility (contrast ratios)

### 6.3 Spacing System

- Base unit (4px, 8px, rem-based)
- Scale (1, 2, 4, 8, 12, 16, 24, 32, 48, 64...)
- Margin/padding conventions
- Gap usage in layouts

### 6.4 Typography

- Font size scale
- Font weight conventions
- Line height system (1.2, 1.5, 1.75, 2)
- Font family tokens
- Responsive typography

### 6.5 Theme Implementation

- Light/dark mode approach
- Theme switching mechanism
- CSS variable usage
- Component theming
- Persistent theme preference

---

## 7. Accessibility

### 7.1 Keyboard Navigation Standards

- Tab order (logical flow)
- Keyboard shortcuts
- Focus management
- Skip links
- Focus trapping in modals

### 7.2 ARIA Patterns

- Required ARIA per component type
- Accessible name calculation
- State communication (aria-pressed, aria-expanded, aria-checked)
- Live regions (aria-live)
- Roles and landmarks

### 7.3 Color Contrast Requirements

- WCAG level (AA minimum, AAA preferred)
- Contrast ratios:
  - Text: 4.5:1 (AA), 7:1 (AAA)
  - Large text: 3:1 (AA), 4.5:1 (AAA)
  - UI components: 3:1
- Testing tools (axe, Stark)

### 7.4 Testing Approach

- Automated testing (axe-core, jest-axe)
- Manual testing checklist
- Screen reader testing (NVDA, VoiceOver, TalkBack)
- Keyboard-only navigation testing

### 7.5 Touch Target Sizes

- Minimum sizes (44×44px per WCAG)
- Spacing between targets
- Mobile considerations

---

## 8. Build & Tooling

### 8.1 Turborepo/Nx Configuration

- Task pipeline (dependsOn, outputs, inputs)
- Caching strategies (what gets cached)
- Remote caching setup
- Parallel execution optimization
- Environment variables (env, passThroughEnv, globalEnv)

### 8.2 Linting Configuration

- ESLint vs Biome (2025 trend: Biome for speed)
- Rule sets (recommended, strict)
- Plugin configuration
- Shared configs across packages
- Custom rules for project-specific patterns

### 8.3 Formatting

- Prettier vs Biome
- Format settings:
  - Line width (100/120)
  - Semi/no-semi
  - Single/double quotes
  - Trailing commas
- Editor integration (.editorconfig)

### 8.4 Pre-commit Hooks

- Husky configuration
- lint-staged setup
- What runs pre-commit:
  - Linting
  - Formatting
  - Type checking (fast with --noEmit)
  - Running affected tests
- Preventing commits with issues

---

## 9. CI/CD Pipelines

### 9.1 Pipeline Configuration

- CI platform (GitHub Actions, GitLab CI, CircleCI)
- Workflow structure
- Job dependencies
- Caching strategies

### 9.2 Affected Detection

- How changes are detected (git diff, Turborepo filter)
- Filter strategies (--filter=[HEAD^1])
- Optimization for monorepos
- Only building/testing changed packages

### 9.3 Remote Caching

- Cache provider (Vercel, S3, custom)
- Authentication
- Cache hit optimization
- Cache invalidation strategies

### 9.4 Quality Gates

- Required checks before merge:
  - All tests pass
  - Coverage thresholds met
  - No linting errors
  - No TypeScript errors
  - Build succeeds
- Automated vs manual gates

### 9.5 Deployment Workflows

- Branch deployment strategy (main → prod, develop → staging)
- Environment promotion
- Rollback procedures
- Preview deployments for PRs

---

## 10. Environment Management

### 10.1 File Hierarchy

- `.env.defaults` - Default values (committed)
- `.env` - Local overrides (gitignored)
- `.env.local` - Package-specific (gitignored)
- `.env.production` - Production values (in CI secrets)
- Loading order and precedence

### 10.2 Naming Conventions

- **Public variables:** `NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`
- **Secret variables:** Never prefixed with public markers
- Consistent naming: `SCREAMING_SNAKE_CASE`
- Descriptive names

### 10.3 Template

- Maintain `.env.template` with all variables (no values)
- Documentation for each variable
- Required vs optional variables
- Onboarding process for new developers

### 10.4 Security

- Secret management (never commit secrets)
- Rotation strategies
- Access control
- Audit logging

---

## 11. Performance Standards

### 11.1 Build Performance

- Target build times:
  - Full build: < 2 minutes
  - Incremental build: < 30 seconds
- Cache hit ratios (> 80%)
- Parallel execution effectiveness

### 11.2 Bundle Size Budgets

- Per-package limits
- Total bundle targets (e.g., main bundle < 200kb)
- Monitoring and alerts
- Code splitting strategies

### 11.3 Runtime Performance

- Core Web Vitals targets:
  - LCP (Largest Contentful Paint): < 2.5s
  - FID (First Input Delay): < 100ms
  - CLS (Cumulative Layout Shift): < 0.1
  - FCP (First Contentful Paint): < 1.8s
  - TTI (Time to Interactive): < 3.8s
- Performance monitoring
- Performance budgets in CI

---

## 12. Security Patterns

### 12.1 Secret Management

- How secrets are handled (environment variables, secret management services)
- Rotation policies
- Access control
- Never committing secrets

### 12.2 Dependency Security

- Vulnerability scanning (Dependabot, Snyk)
- Update policies
- Automated security checks
- Patch management

### 12.3 Code Ownership

- CODEOWNERS file
- Review requirements for sensitive code
- Security-sensitive areas
- Approval workflows

---

## 13. Anti-Patterns Observed

### 13.1 State Management Anti-Patterns

- Server data in client state stores
- Client state in React Query
- Not using `shallow` with Zustand
- Prop drilling instead of state management

### 13.2 TypeScript Anti-Patterns

- `any` usage without justification
- Type assertions hiding errors
- Missing null checks
- Unused imports

### 13.3 Component Anti-Patterns

- God components
- Missing ref forwarding
- No className exposure
- Prop drilling
- Inline styles instead of tokens

### 13.4 Performance Anti-Patterns

- Unnecessary React.memo usage
- Missing memoization for expensive operations
- Inline function definitions in JSX
- Large bundle sizes

### 13.5 Testing Anti-Patterns

- Testing implementation details
- Brittle selectors
- Missing MSW setup
- Incomplete coverage

---

## 14. Quick Reference for AI

### 14.1 Essential Patterns

- Most common code patterns
- Copy-paste ready examples
- Component boilerplate
- Hook patterns

### 14.2 Critical Do's

✅ Use hey-api for API client generation
✅ Enforce strict TypeScript
✅ Use MSW for API mocking
✅ Keep server state in React Query
✅ Keep client state in Zustand
✅ Use `shallow` when selecting multiple Zustand values
✅ Forward refs on interactive components
✅ Expose className on all components
✅ Use named constants (no magic numbers)
✅ Three-tier design token system

### 14.3 Critical Don'ts

❌ Never store server data in Zustand
❌ Never use `any` without justification
❌ Never hardcode API URLs
❌ Never skip MSW setup for tests
❌ Never use magic numbers
❌ Never skip ref forwarding
❌ Never skip className prop
❌ Never commit secrets
❌ Never skip `shallow` for multiple Zustand selects

### 14.4 File-Scoped Commands

```bash
# Fast feedback commands
pnpm tsc --noEmit path/to/file.ts
pnpm prettier --write path/to/file.ts
pnpm eslint path/to/file.ts
pnpm vitest run path/to/file.test.ts
```

---

## Additional Suggestions

Here are other categories you might want to add:

**A. Loading & Empty States**

- Loading skeleton patterns
- Empty state designs
- Error state displays
- Retry mechanisms

**B. Data Fetching Patterns**

- Parallel fetching
- Sequential fetching
- Dependent queries
- Waterfall prevention

**C. Route/Navigation Patterns**

- Route structure
- Protected routes
- Navigation guards
- Deep linking

**D. Internationalization (i18n)**

- Translation key conventions
- Pluralization
- Date/number formatting
- RTL support

**E. Analytics & Tracking**

- Event naming conventions
- What to track
- PII handling
- Analytics providers

**F. Feature Flags**

- Flag naming
- Rollout strategies
- A/B testing patterns

**G. Component Documentation**

- Storybook usage
- Prop documentation
- Usage examples
- Accessibility notes
