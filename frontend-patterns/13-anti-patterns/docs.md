# 13. Anti-Patterns Observed

> **Quick Guide:** Common mistakes across different domains. Review these to avoid pitfalls in your implementation.

## 13.1 State Management Anti-Patterns

- Server data in client state stores
- Client state in React Query
- Not using `shallow` with Zustand
- Prop drilling instead of state management

## 13.2 TypeScript Anti-Patterns

- `any` usage without justification
- Type assertions hiding errors
- Missing null checks
- Unused imports

## 13.3 Component Anti-Patterns

- God components
- Missing ref forwarding
- No className exposure
- Prop drilling
- Inline styles instead of tokens

## 13.4 Performance Anti-Patterns

- Unnecessary React.memo usage
- Missing memoization for expensive operations
- Inline function definitions in JSX
- Large bundle sizes

## 13.5 Testing Anti-Patterns

- Testing implementation details
- Brittle selectors
- Missing MSW setup
- Incomplete coverage
