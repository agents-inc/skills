# Error Boundaries — Core Examples

> Full code for the patterns in [SKILL.md](../SKILL.md).

**Extended examples:**

- [react-19-hooks.md](react-19-hooks.md) — `createRoot` error options, `captureOwnerStack()`, filtering
- [recovery.md](recovery.md) — retry limits, exponential backoff, error classification
- [testing.md](testing.md) — what makes a boundary testable

---

## Pattern 1: Class-based boundary

```typescript
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Static fallback UI */
  fallback?: ReactNode;
  /** Receives the error and a reset function */
  fallbackRender?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
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

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
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
      if (fallbackRender) {
        return fallbackRender({ error, resetErrorBoundary: this.resetErrorBoundary });
      }
      if (fallback) return fallback;

      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          <pre>{error.message}</pre>
          <button onClick={this.resetErrorBoundary}>Try again</button>
        </div>
      );
    }

    return children;
  }
}
```

**Why good:** the two phases stay separate, `onError` keeps the boundary independent of any
reporting client, and the three fallback forms cover static UI, a render prop and a default.

---

## Pattern 2: `react-error-boundary`

```typescript
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function logError(error: Error, info: { componentStack?: string | null }) {
  reportToMonitoring(error, info.componentStack);
}

export function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={logError} onReset={clearStaleState}>
      <MainContent />
    </ErrorBoundary>
  );
}
```

**Why good:** `FallbackProps` types the fallback for you, and `onReset` is where state that caused
the error gets cleared before the children mount again.

---

## Pattern 3: `showBoundary()` for async failures

```typescript
import { useState } from "react";
import { useErrorBoundary, ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

const ITEMS_ENDPOINT = "/api/items";

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
      const response = await fetch(ITEMS_ENDPOINT);
      if (!response.ok) throw new Error(`Failed to fetch: HTTP ${response.status}`);
      setItems(await response.json());
    } catch (error) {
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

**Why good:** the component that throws and the boundary that catches are separate — `showBoundary`
has to be called from inside the boundary, so the content is its own component.

---

## Pattern 4: `resetKeys`

```typescript
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

export function UserProfile({ userId }: { userId: string }) {
  return (
    <ErrorBoundary FallbackComponent={ProfileErrorFallback} resetKeys={[userId]}>
      <ProfileContent userId={userId} />
    </ErrorBoundary>
  );
}

function ProfileErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Failed to load profile</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

**Why good:** switching user clears the previous user's error without the reader having to press
anything, and `userId` is a primitive so the shallow compare behaves.

---

## Pattern 5: Granular placement

```typescript
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

function WidgetFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Widget unavailable</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

const logWidgetError =
  (widgetName: string) => (error: Error, info: { componentStack?: string | null }) =>
    reportToMonitoring(`${widgetName}: ${error.message}`, info.componentStack);

export function Dashboard() {
  return (
    <div>
      <ErrorBoundary FallbackComponent={WidgetFallback} onError={logWidgetError("RevenueChart")}>
        <RevenueChart />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={WidgetFallback} onError={logWidgetError("UserStats")}>
        <UserStats />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={WidgetFallback} onError={logWidgetError("ActivityFeed")}>
        <ActivityFeed />
      </ErrorBoundary>
    </div>
  );
}
```

**Why good:** one shared fallback component, one failure domain per widget, and the widget name
reaches the report without the fallback knowing anything about it.

```typescript
// Bad — one boundary for the whole page
function App() {
  return (
    <ErrorBoundary fallback={<div>App crashed</div>}>
      <Header />
      <Sidebar />
      <Dashboard />
      <Footer />
    </ErrorBoundary>
  );
}
```

**Why bad:** any error anywhere replaces the header, the sidebar and the footer too, and the message
cannot say which of them failed.

---

## Pattern 6: Fallback UI

```typescript
import type { FallbackProps } from "react-error-boundary";

export function MinimalFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Failed to load content</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

**Why good:** `role="alert"` announces the swap, and the retry is a real button — reachable by Tab
and activated by Enter or Space.

```typescript
// Bad — silent and unreachable
function InaccessibleFallback() {
  return (
    <div>
      <p>Something went wrong</p>
      <span onClick={reset}>Click to retry</span>
    </div>
  );
}
```

**Why bad:** no announcement when the subtree disappears, and the only way to recover is a mouse
click on a `<span>` that never receives focus.

```typescript
// Bad — no way back at all
function BadFallback() {
  return <div>Error occurred. Please refresh the page.</div>;
}
```

**Why bad:** a reload throws away everything the user had entered, for what may have been a single
transient failure.
