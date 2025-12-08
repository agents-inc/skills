# Photoroom Webapp Profile

This profile is configured for the Photoroom webapp codebase.

## Tech Stack

- **Framework:** React with TypeScript
- **State Management:** MobX with RootStore pattern
- **Data Fetching:** React Query + Axios
- **Styling:** Tailwind CSS + clsx
- **Testing:** Karma + Mocha + Chai (unit), Playwright (E2E)
- **Mocking:** Sinon with sandbox pattern
- **Router:** TanStack Router
- **Icons:** @photoroom/icons (internal package)
- **UI Components:** @photoroom/ui (internal package)

## Key Conventions

### TypeScript
- Use `type` instead of `interface` (ESLint enforced)
- Named exports only (no default exports except App.tsx)
- Strict mode enabled with `noUncheckedIndexedAccess`

### MobX Stores
- Arrow functions for ALL public store methods
- `runInAction()` after all `await` calls
- `reaction()` for side effects (NOT useEffect)
- Dependency injection via constructor
- Private `#` prefix for dependencies

### React Components
- Wrap with `observer()` when reading MobX state
- Use `useTranslation()` for all user-facing text
- Add `displayName` for debugging
- Extend HTML attributes for composability

### Styling
- Tailwind CSS as primary approach
- `clsx()` for class composition
- Design tokens from `@photoroom/ui` preset
- `@photoroom/icons` for icons (NOT lucide-react)

### Testing
- **Chai syntax:** `expect(x).to.equal(y)` (NOT Jest `.toBe()`)
- Sinon sandbox with `afterEach` cleanup
- Mock store factories with partial dependencies
- Import from `fixtures` not `@playwright/test` for E2E

## Documentation

For detailed patterns, see:
- `apps/webapp/.ai-docs/WORK-STANDARDS.md` - Primary standards
- `apps/webapp/.ai-docs/PITFALLS.md` - Anti-patterns
- `apps/webapp/.ai-docs/_decisions/ADR-005-mobx-store-patterns.md` - MobX patterns
