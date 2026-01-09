# Project Memory for Claude

## Decision Trees

### State Management

```
Is it server data (from API)?
├─ YES → React Query
└─ NO → Is it needed across multiple components?
    ├─ YES → Zustand
    └─ NO → Is it form data?
        ├─ YES → React Hook Form
        └─ NO → useState in component
```

### Styling

```
Does component have variants (primary/secondary, sm/md/lg)?
├─ YES → SCSS Modules + cva
└─ NO → SCSS Modules only

Are values dynamic (runtime values)?
├─ YES → CSS custom properties or inline styles
└─ NO → Design tokens in SCSS
```

### Memoization

```
Is it slow (> 5ms)?
├─ YES → Use useMemo/useCallback
└─ NO → Does it cause child re-renders?
    ├─ YES → Use React.memo on child + useCallback for props
    └─ NO → Don't memoize (premature optimization)
```

### Testing

```
Is it a component?
├─ YES → React Testing Library + MSW
└─ NO → Is it a hook?
    ├─ YES → @testing-library/react-hooks
    └─ NO → Is it a utility function?
        ├─ YES → Vitest unit test
        └─ NO → Integration test
```

## Code Conventions

### File and Directory Naming

**MANDATORY: kebab-case for ALL files and directories**

- Component files: `button.tsx` (NOT `Button.tsx`)
- Style files: `button.module.scss`
- Test files: `button.test.tsx`
- Utility files: `format-date.ts`
- Directories: `client-next/`, `api-mocks/`

### Import/Export Patterns

**MANDATORY: Named exports ONLY (no default exports in libraries)**

**Import ordering:**

1. React imports
2. External dependencies
3. Internal workspace packages (`@repo/*`)
4. Relative imports
5. Styles (`.module.scss`)

**Use `import type { }` for type-only imports**

```typescript
// Example
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/button";
import { Shell } from "./shell";
import styles from "./page.module.scss";
```

### Constants and Magic Numbers

**RULE: No magic numbers anywhere in code**

- All numbers must be named constants
- Constant naming: `SCREAMING_SNAKE_CASE`
- Configuration objects over scattered constants

```typescript
// GOOD
export const API_TIMEOUT_MS = 30000;
export const MAX_RETRY_ATTEMPTS = 3;

// BAD
setTimeout(() => {}, 300); // What's 300?
```

### TypeScript Enforcement

- Zero `any` without explicit justification comment
- No `@ts-ignore` or `@ts-expect-error` without explaining comment
- All function parameters and return types explicit for public APIs
- Null/undefined handling explicit

---

## Quick Checklists

### Before Committing Code

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

### Before Submitting PR

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
