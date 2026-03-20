# Error Boundaries Reference

> Decision frameworks, checklists, and quick-reference tables. See [SKILL.md](SKILL.md) for red flags and core concepts, [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Error Boundary

```
Is this a React rendering error?
├─ NO → Use try/catch instead
│   ├─ Event handler error → try/catch in handler
│   ├─ Async/Promise error → try/catch or .catch()
│   ├─ setTimeout/callback error → try/catch in callback
│   └─ SSR error → Handle at framework level
└─ YES → Use Error Boundary
    ├─ Should failure crash entire feature?
    │   ├─ YES → Single boundary around feature
    │   └─ NO → Multiple granular boundaries
    └─ Is recovery possible?
        ├─ YES → Provide resetErrorBoundary
        └─ NO → Show static fallback
```

### Choosing Fallback Pattern

```
What type of fallback do you need?
├─ Static UI (no props) → Use `fallback` prop
├─ Need error info → Use `fallbackRender` or `FallbackComponent`
├─ Reusable across boundaries → Use `FallbackComponent`
├─ Inline/one-off → Use `fallbackRender`
└─ Context-specific → Create dedicated FallbackComponent
```

### Class vs Library

```
Should you use react-error-boundary library?
├─ Need useErrorBoundary hook → YES, use library
├─ Need resetKeys auto-reset → YES, use library
├─ Minimal dependencies required → NO, write class component
├─ Just need basic boundary → Either works
└─ Production app → YES, use library (more features, maintained)
```

### React 19+ createRoot Error Options

```
Which createRoot error handler to use?
├─ Error caught by ErrorBoundary → onCaughtError (logged + UI handled)
├─ Error NOT caught by any boundary → onUncaughtError (fatal, log immediately)
└─ React auto-recovered (hydration mismatch) → onRecoverableError (warning-level)

Should you use both ErrorBoundary AND createRoot options?
├─ YES → ErrorBoundary for UI, createRoot options for logging
├─ They serve different purposes and complement each other
└─ createRoot options catch errors that escape ALL boundaries
```

### Boundary Placement

```
Where should boundaries be placed?
├─ App root → YES, as last-resort catch-all
├─ Route level → YES, isolate route failures
├─ Feature/widget level → YES, isolate feature failures
├─ Individual component → MAYBE, only for risky components
└─ Every component → NO, too much overhead
```

### When to Use resetKeys

```
Should error boundary auto-reset?
├─ User navigates to different route → YES, resetKeys=[pathname]
├─ User views different item → YES, resetKeys=[itemId]
├─ User explicitly retries → NO, use resetErrorBoundary
├─ Timer/automatic retry → YES, resetKeys=[retryCount]
└─ App state changes → MAYBE, depends on error cause
```

---

> **Red flags and anti-patterns:** See [SKILL.md](SKILL.md) `<red_flags>` section and [examples/core.md](examples/core.md) anti-pattern examples.

---

## Quick Reference

### Error Boundary Checklist

- [ ] Uses class component with `getDerivedStateFromError` and/or `componentDidCatch`
- [ ] No side effects in `getDerivedStateFromError`
- [ ] Has `onError` callback for logging integration
- [ ] Provides reset/retry functionality
- [ ] Fallback UI has `role="alert"`
- [ ] Fallback UI uses button elements (not clickable spans/divs)
- [ ] Error details hidden in production
- [ ] Placed strategically (not just root, not every component)

### Fallback UI Checklist

- [ ] Has `role="alert"` for accessibility
- [ ] Has retry/reset button
- [ ] Provides context about what failed
- [ ] Shows error details in development only
- [ ] Matches visual style of application
- [ ] Uses semantic HTML (buttons, not clickable divs)

### Testing Checklist

- [ ] Test renders children when no error
- [ ] Test renders fallback when error occurs
- [ ] Test calls onError callback
- [ ] Test reset functionality works
- [ ] Test resetKeys triggers reset
- [ ] Suppress console.error in tests

### What Boundaries Catch

| Scenario                          | Caught by Boundary?               |
| --------------------------------- | --------------------------------- |
| Error in render()                 | Yes                               |
| Error in constructor              | Yes                               |
| Error in lifecycle methods        | Yes                               |
| Error in getDerivedStateFromProps | Yes                               |
| Error in event handler            | No - use try/catch                |
| Error in setTimeout callback      | No - use try/catch                |
| Error in async/await              | No - use showBoundary             |
| Error in Promise                  | No - use .catch() or showBoundary |
| Error during SSR                  | No - handle at framework level    |

### Lifecycle Method Summary

| Method                     | Phase  | Use For                      | Side Effects |
| -------------------------- | ------ | ---------------------------- | ------------ |
| `getDerivedStateFromError` | Render | Update state for fallback UI | NOT allowed  |
| `componentDidCatch`        | Commit | Logging, error reporting     | Allowed      |

### react-error-boundary Props

| Prop                | Type                           | Purpose                         |
| ------------------- | ------------------------------ | ------------------------------- |
| `fallback`          | `ReactNode`                    | Static fallback UI              |
| `FallbackComponent` | `ComponentType<FallbackProps>` | Component for fallback          |
| `fallbackRender`    | `(props) => ReactNode`         | Render prop for fallback        |
| `onError`           | `(error, info) => void`        | Error logging callback          |
| `onReset`           | `(details) => void`            | Called when boundary resets     |
| `resetKeys`         | `unknown[]`                    | Dependencies that trigger reset |

### React 19+ createRoot Error Options

| Option               | Type                         | When Called                                |
| -------------------- | ---------------------------- | ------------------------------------------ |
| `onCaughtError`      | `(error, errorInfo) => void` | Error caught by an ErrorBoundary           |
| `onUncaughtError`    | `(error, errorInfo) => void` | Error NOT caught by any boundary (fatal)   |
| `onRecoverableError` | `(error, errorInfo) => void` | React auto-recovered (hydration, suspense) |

**errorInfo parameter contains:**

- `componentStack: string | null` - Component tree at error time

**captureOwnerStack() (React 19+, dev only):**

- Returns owner stack as string or `null`
- Shows which components CREATED the element (not just tree position)
- Only available in development mode
