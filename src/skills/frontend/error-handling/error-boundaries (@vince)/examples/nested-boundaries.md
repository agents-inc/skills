# Error Boundaries - Nested Boundaries Architecture

> Layered error handling patterns for complex applications. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand the basic ErrorBoundary component and granular boundary placement from core examples first.

---

## Pattern 8: Layered Error Handling

### Good Example - Root and Feature-Level Boundaries

```typescript
// src/app-with-nested-boundaries.tsx
import { ErrorBoundary } from "react-error-boundary";

function AppErrorFallback() {
  return (
    <div role="alert" style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Application Error</h1>
      <p>Something unexpected happened.</p>
      <button onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

function FeatureErrorFallback({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  return (
    <div role="alert">
      <p>This feature is temporarily unavailable</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <Header />

      <main>
        <ErrorBoundary
          fallbackRender={({ resetErrorBoundary }) => (
            <FeatureErrorFallback resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <Sidebar />
        </ErrorBoundary>

        <ErrorBoundary
          fallbackRender={({ resetErrorBoundary }) => (
            <FeatureErrorFallback resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <MainContent />
        </ErrorBoundary>
      </main>

      <Footer />
    </ErrorBoundary>
  );
}
```

**Why good:** Root boundary as last resort catches any unhandled errors, feature boundaries allow recovery without full app reload, nested structure provides graceful degradation

---

### Good Example - Three-Tier Boundary Architecture

```typescript
// src/app-three-tier.tsx
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";

// Tier 1: Application-level (fatal errors only)
function AppCrashFallback() {
  return (
    <div role="alert" className="app-crash">
      <h1>Application Error</h1>
      <p>The application encountered a critical error.</p>
      <button onClick={() => window.location.reload()}>
        Reload Application
      </button>
    </div>
  );
}

// Tier 2: Route-level (page failures)
function PageErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="page-error">
      <h2>Page Error</h2>
      <p>This page could not be loaded.</p>
      <button onClick={resetErrorBoundary}>Retry</button>
      <button onClick={() => window.history.back()}>Go Back</button>
    </div>
  );
}

// Tier 3: Component-level (isolated failures)
function ComponentErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="component-error">
      <p>Component unavailable</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

export function App() {
  return (
    // Tier 1: Catches unhandled errors from anywhere
    <ErrorBoundary FallbackComponent={AppCrashFallback}>
      <Layout>
        {/* Tier 2: Catches page-level errors */}
        <ErrorBoundary FallbackComponent={PageErrorFallback}>
          <Routes>
            <Route path="/dashboard" element={
              <DashboardPage />
            } />
            <Route path="/settings" element={
              <SettingsPage />
            } />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  );
}

// Inside DashboardPage - Tier 3 boundaries
function DashboardPage() {
  return (
    <div className="dashboard">
      <ErrorBoundary FallbackComponent={ComponentErrorFallback}>
        <RevenueWidget />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={ComponentErrorFallback}>
        <UserActivityWidget />
      </ErrorBoundary>

      <ErrorBoundary FallbackComponent={ComponentErrorFallback}>
        <NotificationsWidget />
      </ErrorBoundary>
    </div>
  );
}
```

**Why good:** Clear hierarchy of error handling, each tier has appropriate recovery options, errors bubble up only when unhandled at lower tiers

---

### Good Example - Error Propagation Control

```typescript
// src/components/error-boundary/controlled-boundary.tsx
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ControlledBoundaryProps {
  children: ReactNode;
  /** If true, re-throws error to parent boundary */
  propagate?: boolean;
  /** Error types to propagate regardless of propagate setting */
  propagateTypes?: Array<new (...args: never[]) => Error>;
  fallback: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ControlledBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ControlledBoundary extends Component<
  ControlledBoundaryProps,
  ControlledBoundaryState
> {
  state: ControlledBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ControlledBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { propagate, propagateTypes, onError } = this.props;

    // Check if this error type should propagate
    const shouldPropagate =
      propagate ||
      propagateTypes?.some((ErrorType) => error instanceof ErrorType);

    if (shouldPropagate) {
      // Re-throw to parent boundary
      throw error;
    }

    // Handle locally
    onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Custom error types for propagation control
class CriticalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticalError";
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

// Usage: Widget handles most errors, but auth errors propagate up
function DashboardWidget() {
  return (
    <ControlledBoundary
      fallback={<div>Widget error</div>}
      propagateTypes={[CriticalError, AuthenticationError]}
    >
      <WidgetContent />
    </ControlledBoundary>
  );
}
```

**Why good:** Fine-grained control over error propagation, critical errors reach root boundary, non-critical errors handled locally

---
