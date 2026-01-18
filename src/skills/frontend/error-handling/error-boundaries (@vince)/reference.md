# Error Boundaries Reference

> Decision frameworks, anti-patterns, and red flags for error boundary implementation. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

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

## RED FLAGS

### High Priority Issues

- **Missing error boundaries** - App crashes completely on any render error
- **Single root boundary only** - One error crashes entire app, no isolation
- **No reset functionality** - Users must refresh page to recover
- **Missing `role="alert"`** - Screen readers don't announce error state
- **Side effects in getDerivedStateFromError** - Violates React phase rules, causes bugs

### Medium Priority Issues

- **Catching async errors without showBoundary** - Async errors silently fail
- **Same fallback for all boundaries** - No context about what failed
- **No error logging callback** - Errors not reported to monitoring
- **Overly granular boundaries** - Performance overhead, code complexity
- **Static fallback without retry** - No recovery without page refresh

### Common Mistakes

- Using function component for error boundary (must be class component)
- Expecting boundary to catch event handler errors (it won't)
- Expecting boundary to catch async errors (use showBoundary hook)
- Not testing error boundary behavior
- Showing raw error messages in production (security/UX risk)

### Gotchas & Edge Cases

- `getDerivedStateFromError` runs during render - no side effects allowed
- `componentDidCatch` runs during commit - side effects OK
- Error boundaries don't catch errors in themselves
- Nested boundaries - innermost boundary catches first
- Hot reload can trigger boundaries in development (expected)
- `resetKeys` comparison is shallow - objects/arrays need stable references
- SSR hydration errors may not be caught by client-side boundaries

**React 19+ Specific Gotchas:**

- `captureOwnerStack()` returns `null` in production - always check `process.env.NODE_ENV`
- `onCaughtError` runs AFTER boundary's `componentDidCatch`, not before
- React 19 logs single consolidated error message (not duplicate console.error calls like React 18)
- `onRecoverableError` error may have `error.cause` with original thrown error
- SSR hydration mismatches trigger `onRecoverableError`, not `onUncaughtError`
- createRoot error options are silently ignored on React 18 (check version before relying on them)

---

## Anti-Patterns

### Missing createRoot Error Options (React 19+)

In React 19+, not configuring `createRoot` error options means you miss centralized error logging. Errors caught by boundaries are logged only if the boundary has an `onError` callback, and uncaught errors have no unified handling.

```typescript
// WRONG - No centralized error logging in React 19
const root = createRoot(container);
root.render(<App />);

// CORRECT - Centralized error logging
const root = createRoot(container, {
  onCaughtError: (error, errorInfo) => {
    sendToMonitoring("caught", error, errorInfo);
  },
  onUncaughtError: (error, errorInfo) => {
    sendToMonitoring("uncaught", error, errorInfo);
  },
  onRecoverableError: (error, errorInfo) => {
    sendToMonitoring("recoverable", error, errorInfo);
  },
});
root.render(<App />);
```

---

### No Error Boundary

Applications without error boundaries crash entirely when any component throws during rendering. Users see a blank screen or React's default error overlay.

```typescript
// WRONG - No error handling
function App() {
  return <MainContent />; // One error crashes everything
}

// CORRECT - Error boundary protects app
function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <MainContent />
    </ErrorBoundary>
  );
}
```

### Side Effects in getDerivedStateFromError

`getDerivedStateFromError` runs during the render phase where side effects are forbidden. Logging, API calls, and state mutations outside the return value will cause bugs.

```typescript
// WRONG - Side effects in render phase
static getDerivedStateFromError(error: Error) {
  console.log("Error caught:", error); // Side effect!
  sendToAnalytics(error); // Side effect!
  return { hasError: true, error };
}

// CORRECT - Side effects in commit phase
static getDerivedStateFromError(error: Error) {
  return { hasError: true, error };
}

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.log("Error caught:", error); // OK here
  sendToAnalytics(error); // OK here
}
```

### Expecting Boundaries to Catch Async Errors

Error boundaries only catch errors during React rendering. Async operations, event handlers, and setTimeout callbacks are not caught automatically.

```typescript
// WRONG - Expecting boundary to catch async error
function DataLoader() {
  const loadData = async () => {
    throw new Error("API failed"); // NOT caught by boundary
  };

  return <button onClick={loadData}>Load</button>;
}

// CORRECT - Using useErrorBoundary for async errors
function DataLoader() {
  const { showBoundary } = useErrorBoundary();

  const loadData = async () => {
    try {
      await fetchData();
    } catch (error) {
      showBoundary(error); // Manually propagate to boundary
    }
  };

  return <button onClick={loadData}>Load</button>;
}
```

### Inaccessible Fallback UI

Fallback UI must be accessible. Missing `role="alert"` means screen readers won't announce the error. Non-button elements for retry break keyboard navigation.

```typescript
// WRONG - Inaccessible fallback
function BadFallback({ resetErrorBoundary }) {
  return (
    <div>
      <p>Error occurred</p>
      <span onClick={resetErrorBoundary}>Retry</span> {/* Not keyboard accessible */}
    </div>
  );
}

// CORRECT - Accessible fallback
function GoodFallback({ resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Error occurred</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

### Single Monolithic Boundary

One boundary for the entire app means any error crashes everything. Users lose access to all features, even those unrelated to the error.

```typescript
// WRONG - Single boundary for everything
<ErrorBoundary>
  <Header />
  <Sidebar />
  <MainContent />
  <Dashboard />
</ErrorBoundary>

// CORRECT - Granular boundaries for isolation
<ErrorBoundary FallbackComponent={AppFallback}>
  <Header />
  <ErrorBoundary FallbackComponent={SidebarFallback}>
    <Sidebar />
  </ErrorBoundary>
  <ErrorBoundary FallbackComponent={ContentFallback}>
    <MainContent />
  </ErrorBoundary>
  <ErrorBoundary FallbackComponent={DashboardFallback}>
    <Dashboard />
  </ErrorBoundary>
</ErrorBoundary>
```

### Exposing Error Details in Production

Showing raw error messages and stack traces in production is a security risk and poor UX. Technical details should only appear in development.

```typescript
// WRONG - Raw errors in production
function BadFallback({ error }) {
  return (
    <div>
      <pre>{error.message}</pre>
      <pre>{error.stack}</pre> {/* Exposes internals */}
    </div>
  );
}

// CORRECT - Environment-aware fallback
function GoodFallback({ error, resetErrorBoundary }) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div role="alert">
      <p>Something went wrong</p>
      {isDev && (
        <details>
          <summary>Error details</summary>
          <pre>{error.message}</pre>
          <pre>{error.stack}</pre>
        </details>
      )}
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

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

| Scenario | Caught by Boundary? |
|----------|---------------------|
| Error in render() | Yes |
| Error in constructor | Yes |
| Error in lifecycle methods | Yes |
| Error in getDerivedStateFromProps | Yes |
| Error in event handler | No - use try/catch |
| Error in setTimeout callback | No - use try/catch |
| Error in async/await | No - use showBoundary |
| Error in Promise | No - use .catch() or showBoundary |
| Error during SSR | No - handle at framework level |

### Lifecycle Method Summary

| Method | Phase | Use For | Side Effects |
|--------|-------|---------|--------------|
| `getDerivedStateFromError` | Render | Update state for fallback UI | NOT allowed |
| `componentDidCatch` | Commit | Logging, error reporting | Allowed |

### react-error-boundary Props

| Prop | Type | Purpose |
|------|------|---------|
| `fallback` | `ReactNode` | Static fallback UI |
| `FallbackComponent` | `ComponentType<FallbackProps>` | Component for fallback |
| `fallbackRender` | `(props) => ReactNode` | Render prop for fallback |
| `onError` | `(error, info) => void` | Error logging callback |
| `onReset` | `(details) => void` | Called when boundary resets |
| `resetKeys` | `unknown[]` | Dependencies that trigger reset |

### React 19+ createRoot Error Options

| Option | Type | When Called |
|--------|------|-------------|
| `onCaughtError` | `(error, errorInfo) => void` | Error caught by an ErrorBoundary |
| `onUncaughtError` | `(error, errorInfo) => void` | Error NOT caught by any boundary (fatal) |
| `onRecoverableError` | `(error, errorInfo) => void` | React auto-recovered (hydration, suspense) |

**errorInfo parameter contains:**
- `componentStack: string | null` - Component tree at error time

**captureOwnerStack() (React 19+, dev only):**
- Returns owner stack as string or `null`
- Shows which components CREATED the element (not just tree position)
- Only available in development mode
