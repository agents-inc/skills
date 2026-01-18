# Error Boundaries Examples

> Complete code examples for error boundary patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [react-19-hooks.md](react-19-hooks.md) - **React 19+ error hooks** (`onCaughtError`, `onUncaughtError`, `captureOwnerStack`)
- [testing.md](testing.md) - Testing patterns for error boundaries
- [typescript.md](typescript.md) - TypeScript patterns and HOC
- [nested-boundaries.md](nested-boundaries.md) - Layered error handling architecture
- [fallback-ui.md](fallback-ui.md) - Advanced fallback UI patterns
- [recovery.md](recovery.md) - Retry limits and error classification

---

## Pattern 1: Class-Based Error Boundary

### Good Example - Complete Error Boundary Implementation

```typescript
// src/components/error-boundary/error-boundary.tsx
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Static fallback UI */
  fallback?: ReactNode;
  /** Function that receives error and reset function */
  fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called before boundary resets */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Render phase - update state to show fallback
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Commit phase - side effects allowed
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Call error callback for logging
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, fallbackRender } = this.props;

    if (hasError && error) {
      // Priority: fallbackRender > fallback > default
      if (fallbackRender) {
        return fallbackRender({
          error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <div role="alert" style={{ padding: "1rem", textAlign: "center" }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
            {error.message}
          </pre>
          <button
            onClick={this.resetErrorBoundary}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}
```

**Why good:** Complete implementation with all common features, supports multiple fallback patterns, proper lifecycle method separation, TypeScript types exported for consumers

---

## Pattern 2: react-error-boundary Library Usage

### Good Example - Basic Usage with FallbackComponent

```typescript
// src/app.tsx
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
        {error.message}
      </pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function logError(error: Error, info: { componentStack?: string | null }) {
  // Send to your error tracking service
  console.error("Error boundary caught:", error);
  console.error("Component stack:", info.componentStack);
}

export function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
      onReset={() => {
        // Reset application state if needed
      }}
    >
      <MainContent />
    </ErrorBoundary>
  );
}
```

**Why good:** Uses typed FallbackProps from library, separates error logging into dedicated function, provides reset capability

---

### Good Example - Using resetKeys for Automatic Reset

```typescript
// src/features/user-profile/user-profile.tsx
import { ErrorBoundary } from "react-error-boundary";
import { useParams } from "react-router-dom";

export function UserProfile() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <ErrorBoundary
      FallbackComponent={ProfileErrorFallback}
      resetKeys={[userId]}
      onResetKeysChange={(prevKeys, currentKeys) => {
        console.log("Reset triggered by key change:", prevKeys, "->", currentKeys);
      }}
    >
      <ProfileContent userId={userId} />
    </ErrorBoundary>
  );
}

function ProfileErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Failed to load profile</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

**Why good:** Boundary automatically resets when userId changes, prevents stale error state when navigating between users

---

### Good Example - useErrorBoundary Hook for Async Errors

```typescript
// src/features/data-loader/data-loader.tsx
import { useState } from "react";
import { useErrorBoundary, ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const API_ENDPOINT = "/api/items";

interface Item {
  id: string;
  name: string;
}

function DataLoaderContent() {
  const { showBoundary } = useErrorBoundary();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Failed to fetch: HTTP ${response.status}`);
      }
      const data = await response.json();
      setItems(data);
    } catch (error) {
      // Propagate to nearest error boundary
      showBoundary(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleLoadData} disabled={isLoading}>
        {isLoading ? "Loading..." : "Load Data"}
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

function DataLoaderFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Failed to load data: {error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

export function DataLoader() {
  return (
    <ErrorBoundary FallbackComponent={DataLoaderFallback}>
      <DataLoaderContent />
    </ErrorBoundary>
  );
}
```

**Why good:** useErrorBoundary hook propagates async errors to boundary, consistent error UI for both sync and async failures, named constant for API endpoint

---

## Pattern 3: Granular Boundary Placement

### Good Example - Dashboard with Isolated Widgets

```typescript
// src/features/dashboard/multi-boundary-dashboard.tsx
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

function WidgetFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="widget-error">
      <p>Widget unavailable</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

function logWidgetError(widgetName: string) {
  return (error: Error, info: { componentStack?: string | null }) => {
    // Log with widget context
    console.error(`${widgetName} error:`, error, info.componentStack);
  };
}

export function Dashboard() {
  return (
    <div className="dashboard">
      <header>
        <h1>Dashboard</h1>
      </header>

      <div className="widgets-grid">
        <ErrorBoundary
          FallbackComponent={WidgetFallback}
          onError={logWidgetError("RevenueChart")}
        >
          <RevenueChart />
        </ErrorBoundary>

        <ErrorBoundary
          FallbackComponent={WidgetFallback}
          onError={logWidgetError("UserStats")}
        >
          <UserStats />
        </ErrorBoundary>

        <ErrorBoundary
          FallbackComponent={WidgetFallback}
          onError={logWidgetError("ActivityFeed")}
        >
          <ActivityFeed />
        </ErrorBoundary>

        <ErrorBoundary
          FallbackComponent={WidgetFallback}
          onError={logWidgetError("RecentOrders")}
        >
          <RecentOrders />
        </ErrorBoundary>
      </div>
    </div>
  );
}
```

**Why good:** Each widget has isolated failure domain, reusable fallback component, error logging includes widget context

---

## Pattern 4: Minimal Accessible Fallback

### Good Example - Basic Accessible Fallback

```typescript
// src/components/fallbacks/minimal-fallback.tsx
import type { FallbackProps } from "react-error-boundary";

export function MinimalFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" aria-live="assertive">
      <p>Failed to load content</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

**Why good:** Minimal but functional, role="alert" announces to screen readers, aria-live ensures immediate announcement

---

## Anti-Pattern Examples

### Bad Example - Single Root Boundary Only

```typescript
// BAD: Single boundary for entire app
function App() {
  return (
    <ErrorBoundary fallback={<div>App crashed</div>}>
      <Header />
      <Sidebar />
      <MainContent />
      <Dashboard />
      <Footer />
    </ErrorBoundary>
  );
}
```

**Why bad:** One error anywhere crashes the entire app, no isolation between features, poor user experience

---

### Bad Example - No Retry Functionality

```typescript
// BAD: No way to recover
function BadFallback() {
  return <div>Error occurred. Please refresh the page.</div>;
}
```

**Why bad:** Forces full page refresh to recover, loses user state, poor UX for transient errors

---

### Bad Example - Missing Accessibility

```typescript
// BAD: No accessibility attributes
function InaccessibleFallback() {
  return (
    <div>
      <p>Something went wrong</p>
      <span onClick={reset}>Click to retry</span>
    </div>
  );
}
```

**Why bad:** No role="alert" means screen readers don't announce error, span with onClick is not keyboard accessible, screen reader users don't know an error occurred

---

> **See also:**
> - [testing.md](testing.md) - Testing error boundary behavior
> - [typescript.md](typescript.md) - TypeScript patterns and HOC
> - [fallback-ui.md](fallback-ui.md) - Advanced fallback UI patterns
> - [recovery.md](recovery.md) - Retry limits and error classification
