# React - Error Boundary Examples

> Error boundary implementation, custom fallbacks, and recovery patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [core.md](core.md) - Component architecture, variants, event handlers
- [icons.md](icons.md) - lucide-react usage, accessibility, color inheritance
- [hooks.md](hooks.md) - usePagination, useDebounce, useLocalStorage

---

## Error Boundary with Retry and Logging

### Good Example - Complete error boundary implementation

```typescript
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: "red", marginTop: "1rem" }}>{this.state.error.message}</pre>
          <Button onClick={this.reset} style={{ marginTop: "1rem" }}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Why good:** catches render errors preventing full app crashes, retry capability allows recovery from transient errors, custom fallback prop enables branded error UI, onError callback enables error tracking integration

---

## Custom Fallback with Error Tracking

### Good Example - Error boundary with custom fallback and logging

```typescript
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h1>Oops!</h1>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
  onError={(error) => {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    console.error("Error tracked:", error);
  }}
>
  <App />
</ErrorBoundary>
```

**Why good:** custom fallback provides branded error experience, onError integration sends errors to monitoring service, retry button improves UX for transient failures

---

## Anti-Pattern: No Error Boundary

### Bad Example - Application without error boundaries

```typescript
function App() {
  return <MainContent />; // One error crashes entire app
}
```

**Why bad:** unhandled render errors crash entire React app, no user feedback when errors occur, no way to recover without page reload

---

## Placement Guidelines

**When to use:** Place error boundaries around feature sections, not just the root. Consider separate error boundaries for data fetching vs render errors.

**When not to use:** Error boundaries don't catch event handler errors, async errors, or SSR errors - use try/catch for those.

**Recommended placement:**

```typescript
function App() {
  return (
    <ErrorBoundary onError={logToService}>
      <Header />
      <ErrorBoundary fallback={<DashboardFallback />}>
        <Dashboard />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SidebarFallback />}>
        <Sidebar />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

**Why good:** granular error boundaries prevent one broken feature from crashing the entire app, each section can have its own fallback UI
