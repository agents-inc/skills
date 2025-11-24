# Quick Reference for AI

> **Quick Guide:** Essential patterns, critical do's and don'ts, and file-scoped commands for fast feedback. This is a condensed reference of all previous sections.

---

## Essential Code Patterns

### Component Template (Recommended Structure)

```typescript
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import styles from './button.module.scss';

// Variants using cva (only when multiple variants exist)
const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      primary: styles.primary,
      secondary: styles.secondary,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

// Props type
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    // Custom props
  };

// Component with ref forwarding
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### API Client Hook Template

```typescript
// React Query pattern for data fetching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Query hook
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.getProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hook
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductData) => apiClient.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

### Zustand Store Template

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

interface UIStore {
  // State
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        isSidebarOpen: false,
        theme: 'light',

        // Actions
        toggleSidebar: () =>
          set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        setTheme: (theme) => set({ theme }),
      }),
      { name: 'ui-store' }
    )
  )
);

// Usage with shallow for multiple selects
const { isSidebarOpen, toggleSidebar } = useUIStore(
  (state) => ({ isSidebarOpen: state.isSidebarOpen, toggleSidebar: state.toggleSidebar }),
  shallow
);
```

### Form Handling with React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema
const formSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof formSchema>;

// Component
function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    await login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Login
      </button>
    </form>
  );
}
```

---

## Critical Do's ✅

**State Management:**
- ✅ Use React Query (TanStack Query) for server state
- ✅ Use Zustand for client UI state
- ✅ Use `shallow` when selecting multiple Zustand values
- ✅ Invalidate queries after mutations

**TypeScript:**
- ✅ Enable strict mode
- ✅ Use `type` for component props
- ✅ Use `interface` for API contracts
- ✅ Annotate function return types
- ✅ Use `unknown` instead of `any` when type is truly unknown

**Components:**
- ✅ Forward refs on interactive elements
- ✅ Expose `className` prop for customization
- ✅ Use data-attributes for state-based styling
- ✅ Keep components under 300 lines
- ✅ Use named exports (not default)

**API & Data:**
- ✅ Use hey-api (@hey-api/openapi-ts) for API client generation
- ✅ Validate environment variables with Zod
- ✅ Use MSW for API mocking in tests
- ✅ Handle loading, error, and empty states

**Testing:**
- ✅ Use React Testing Library queries (getByRole, getByLabelText)
- ✅ Test user behavior, not implementation
- ✅ Aim for > 80% code coverage
- ✅ Test accessibility (keyboard navigation, ARIA)

**Performance:**
- ✅ Lazy load routes
- ✅ Code split heavy components
- ✅ Optimize images (WebP/AVIF, lazy loading)
- ✅ Use Next.js Image component when available
- ✅ Monitor bundle size (< 200KB main bundle)

**Styling:**
- ✅ Use SCSS Modules (not CSS-in-JS)
- ✅ Use three-tier design token system (primitives → semantic → component)
- ✅ Use `cva` for components with multiple variants
- ✅ Use Ladle for component stories

**Security:**
- ✅ Store secrets in environment variables
- ✅ Rotate secrets quarterly
- ✅ Run security audits (Dependabot, Snyk)
- ✅ Use CSP headers
- ✅ Sanitize user input with DOMPurify if rendering HTML

**Build & Tooling:**
- ✅ Use Turborepo for monorepo builds
- ✅ Enable remote caching (Vercel)
- ✅ Use affected detection in CI
- ✅ Use lucide-react for icons (import specific icons)
- ✅ Use named constants (no magic numbers)

---

## Critical Don'ts ❌

**State Management:**
- ❌ Never store server data in Zustand (use React Query)
- ❌ Never store UI state in React Query (use Zustand)
- ❌ Never skip `shallow` for multiple Zustand selects (causes re-renders)
- ❌ Never mutate state directly (use immutable updates)

**TypeScript:**
- ❌ Never use `any` without justification comment
- ❌ Never use `@ts-ignore` without explanation
- ❌ Never skip function return type annotations
- ❌ Never use `I` prefix for interfaces (e.g., `IUser`)
- ❌ Never use `interface` for component props (use `type`)

**Components:**
- ❌ Never create God components (> 300 lines, > 10 props)
- ❌ Never skip ref forwarding on interactive elements
- ❌ Never skip className exposure
- ❌ Never use inline styles (use design tokens)
- ❌ Never use default exports in libraries
- ❌ Never use cva for components with no variants

**API & Data:**
- ❌ Never hardcode API URLs (use environment variables)
- ❌ Never skip error handling for API calls
- ❌ Never skip loading states
- ❌ Never mutate cache directly (use React Query helpers)
- ❌ Never fetch on every render (use caching)

**Testing:**
- ❌ Never test implementation details
- ❌ Never use brittle selectors (querySelector)
- ❌ Never skip MSW setup for API tests
- ❌ Never skip integration tests
- ❌ Never skip accessibility testing
- ❌ Never mock too much (test real behavior)

**Performance:**
- ❌ Never memoize everything (premature optimization)
- ❌ Never import entire libraries (`import _ from 'lodash'`)
- ❌ Never import entire lucide-react package
- ❌ Never skip lazy loading for routes
- ❌ Never skip image optimization
- ❌ Never optimize without measuring first

**Styling:**
- ❌ Never use CSS-in-JS (styled-components, Emotion)
- ❌ Never use inline styles except for dynamic values
- ❌ Never hardcode colors/spacing (use design tokens)
- ❌ Never use className toggling for state (use data-attributes)
- ❌ Never use Tailwind classes directly (use design tokens)

**Accessibility:**
- ❌ Never remove focus outlines without replacement
- ❌ Never use `div` or `span` for buttons/links
- ❌ Never use color-only error indicators
- ❌ Never use placeholder as label replacement
- ❌ Never disable form submit buttons (show errors instead)
- ❌ Never skip keyboard navigation support

**Security:**
- ❌ Never commit secrets to repository
- ❌ Never use `dangerouslySetInnerHTML` with user input
- ❌ Never hardcode API keys in code
- ❌ Never use production secrets in development
- ❌ Never skip environment variable validation
- ❌ Never expose secrets in client-side code

**Build & Tooling:**
- ❌ Never use PascalCase for file names (use kebab-case)
- ❌ Never mix casing (Button.tsx and button.module.scss)
- ❌ Never modify generated files manually
- ❌ Never skip TypeScript strict mode
- ❌ Never skip pre-commit hooks
- ❌ Never use multiple icon libraries

---

## File-Scoped Commands

**Fast Feedback (Single File Operations):**

```bash
# Type check single file
bun tsc --noEmit path/to/file.ts

# Format single file
bun prettier --write path/to/file.ts

# Lint single file
bun eslint path/to/file.ts --fix

# Run single test file
bun vitest run path/to/file.test.ts

# Run test file in watch mode
bun vitest watch path/to/file.test.ts
```

**Package-Scoped Operations:**

```bash
# Run tests in specific package
bun --filter @repo/ui test

# Build specific package
bun --filter @repo/ui build

# Type check specific package
bun --filter @repo/ui type-check

# Lint specific package
bun --filter @repo/ui lint
```

**Affected Detection (Turborepo):**

```bash
# Test only affected packages
bun turbo test --filter=...[origin/main]

# Build only affected packages
bun turbo build --filter=...[origin/main]

# Lint only affected packages
bun turbo lint --filter=...[origin/main]

# Type check only affected packages
bun turbo type-check --filter=...[origin/main]
```

**Git Operations:**

```bash
# Stage specific file
git add path/to/file.ts

# Commit with message
git commit -m "feat: add new feature"

# Create new branch
git checkout -b feature/new-feature

# Push to remote
git push -u origin feature/new-feature

# Amend last commit (ONLY if not pushed)
git commit --amend --no-edit
```

**Dependency Management:**

```bash
# Install package in specific workspace
bun add package-name --filter @repo/ui

# Install dev dependency
bun add -d package-name --filter @repo/ui

# Remove package
bun remove package-name --filter @repo/ui

# Update all dependencies (check for updates)
bun update

# Audit dependencies
bun audit

# Check for outdated packages
bun outdated
```

---

## Common Code Snippets

### Environment Variable Validation

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

export function getEnv() {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    throw new Error('Invalid environment configuration');
  }
}
```

### MSW Handler Setup

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ]);
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: '3', ...body }, { status: 201 });
  }),

  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'John Doe' });
  }),

  // Error simulation
  http.get('/api/error', () => {
    return new HttpResponse(null, { status: 500 });
  }),
];

// src/mocks/server.ts (for Node/tests)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Debounce Hook

```typescript
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data } = useQuery({
    queryKey: ['search', debouncedSearchTerm],
    queryFn: () => searchAPI(debouncedSearchTerm),
    enabled: debouncedSearchTerm.length > 0,
  });

  return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
}
```

### Local Storage Hook

```typescript
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

---

## Decision Tree

**"Where should I put this state?"**

```
Is it server data (from API)?
├─ YES → React Query
└─ NO → Is it needed across multiple components?
    ├─ YES → Zustand
    └─ NO → Is it form data?
        ├─ YES → React Hook Form
        └─ NO → useState in component
```

**"How should I style this component?"**

```
Does component have variants (primary/secondary, sm/md/lg)?
├─ YES → SCSS Modules + cva
└─ NO → SCSS Modules only

Are values dynamic (runtime values)?
├─ YES → CSS custom properties or inline styles
└─ NO → Design tokens in SCSS
```

**"Should I memoize this?"**

```
Is it slow (> 5ms)?
├─ YES → Use useMemo/useCallback
└─ NO → Does it cause child re-renders?
    ├─ YES → Use React.memo on child + useCallback for props
    └─ NO → Don't memoize (premature optimization)
```

**"How should I test this?"**

```
Is it a component?
├─ YES → React Testing Library + MSW
└─ NO → Is it a hook?
    ├─ YES → @testing-library/react-hooks
    └─ NO → Is it a utility function?
        ├─ YES → Vitest unit test
        └─ NO → Integration test
```

---

## Quick Checklist

**Before Committing Code:**

- [ ] No `any` without justification
- [ ] No magic numbers (use named constants)
- [ ] No hardcoded values (use config/env vars)
- [ ] Named exports only (no default exports in libraries)
- [ ] kebab-case file names
- [ ] Ref forwarding on interactive components
- [ ] className prop exposed
- [ ] No God components (< 300 lines)
- [ ] Data-attributes for state styling (not className toggling)
- [ ] Design tokens (no hardcoded colors/spacing)
- [ ] Tests written and passing
- [ ] Type check passes (`bun tsc --noEmit`)
- [ ] Lint passes (`bun eslint .`)
- [ ] Format applied (`bun prettier --write .`)

**Before Submitting PR:**

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Code formatted
- [ ] Branch up to date with main
- [ ] Meaningful commit messages
- [ ] PR description explains changes
- [ ] Screenshots/videos for UI changes
- [ ] No console.logs left in code
- [ ] No commented-out code
- [ ] Bundle size checked (if applicable)
- [ ] Accessibility tested (keyboard nav)

---

## Documentation Map

**Core Patterns** (.claude-src/core patterns/):
- package-architecture - Monorepo structure, package naming, dependency boundaries, UI library organization
- code-conventions - Component patterns, TypeScript strictness, file naming, constants, error handling, icons
- design-system - Design tokens, color system, spacing, typography, SCSS modules, iconography

**Skills** (.claude-src/skills/):
- api-client - API client architecture and patterns
- state-management - State management with React Query and Zustand
- testing - Testing standards with Vitest and React Testing Library
- accessibility - WCAG compliance and accessibility patterns
- build-tooling - Build configuration and tooling (Turborepo, Vite, etc.)
- ci-cd - CI/CD pipeline patterns
- env-management - Environment variable management
- performance - Performance optimization patterns
- security - Security patterns and best practices
- anti-patterns - Common anti-patterns to avoid
